<?php
// =====================================================================
// Paiements : liste filtrable (type / statut / pays / dates) + CRUD
// =====================================================================

class PaiementsController
{
    private function model(): Model
    {
        return new Model(
            'paiements',
            ['course_id', 'type_paiement', 'montant', 'statut', 'date_paiement'],
            ['id' => 'int', 'course_id' => 'int', 'montant' => 'float']
        );
    }

    public function index(Request $req): void
    {
        $where  = [];
        $params = [];
        if ($t = $req->queryParam('type'))    { $where[] = 'pa.type_paiement = ?'; $params[] = $t; }
        if ($s = $req->queryParam('statut'))  { $where[] = 'pa.statut = ?';        $params[] = $s; }
        if ($p = $req->queryParam('pays_id')) {
            Auth::requirePaysAccess($req, (int) $p);
            $where[] = 'v.pays_id = ?';        $params[] = $p;
        }
        if ($f = $req->queryParam('from'))    { $where[] = 'pa.date_paiement >= ?'; $params[] = $f . ' 00:00:00'; }
        if ($to = $req->queryParam('to'))     { $where[] = 'pa.date_paiement <= ?'; $params[] = $to . ' 23:59:59'; }
        $scopeSql = Auth::paysScopeSql($req, 'v.pays_id');
        $whereSql = ' WHERE 1 = 1' . $scopeSql . ($where ? ' AND ' . implode(' AND ', $where) : '');

        $page    = max(1, (int) $req->queryParam('page', 1));
        $perPage = min(200, max(1, (int) $req->queryParam('per_page', 25)));
        $offset  = ($page - 1) * $perPage;

        $total = (int) $this->run(
            "SELECT COUNT(*) FROM paiements pa
             JOIN courses co ON co.id=pa.course_id JOIN villes v ON v.id=co.ville_id $whereSql",
            $params
        )->fetchColumn();

        $stmt = $this->run(
            "SELECT pa.*, co.date_course, v.pays_id, v.nom_ville
             FROM paiements pa
             JOIN courses co ON co.id = pa.course_id
             JOIN villes v   ON v.id = co.ville_id
             $whereSql ORDER BY pa.date_paiement DESC LIMIT $perPage OFFSET $offset",
            $params
        );
        $items = array_map(function ($r) {
            $r['id']        = (int) $r['id'];
            $r['course_id'] = (int) $r['course_id'];
            $r['pays_id']   = (int) $r['pays_id'];
            $r['montant']   = (float) $r['montant'];
            return $r;
        }, $stmt->fetchAll());

        Response::paginated($items, $total, $page, $perPage);
    }

    // Pays d'un paiement (via sa course) et pays d'une course.
    private function paysOfPaiement($id): ?int
    {
        $stmt = Database::pdo()->prepare(
            'SELECT v.pays_id FROM paiements pa
             JOIN courses co ON co.id = pa.course_id
             JOIN villes v   ON v.id = co.ville_id WHERE pa.id = ?'
        );
        $stmt->execute([$id]);
        $p = $stmt->fetchColumn();
        return $p === false ? null : (int) $p;
    }

    private function paysOfCourse($courseId): ?int
    {
        $stmt = Database::pdo()->prepare(
            'SELECT v.pays_id FROM courses co JOIN villes v ON v.id = co.ville_id WHERE co.id = ?'
        );
        $stmt->execute([$courseId]);
        $p = $stmt->fetchColumn();
        return $p === false ? null : (int) $p;
    }

    public function show(Request $req, array $params): void
    {
        $pays = $this->paysOfPaiement($params['id']);
        if ($pays === null) { Response::error('Paiement introuvable.', 404); }
        Auth::requirePaysAccess($req, $pays);
        Response::ok($this->model()->find($params['id']));
    }

    public function store(Request $req): void
    {
        Auth::requireWrite($req);
        foreach (['course_id', 'type_paiement', 'montant', 'date_paiement'] as $f) {
            if ($req->input($f) === null || $req->input($f) === '') {
                Response::error("Champ obligatoire manquant : $f", 422);
            }
        }
        $pays = $this->paysOfCourse($req->input('course_id'));
        if ($pays === null) { Response::error('Course invalide.', 422); }
        Auth::requirePaysAccess($req, $pays);
        try {
            Response::ok($this->model()->create($req->body()), 201);
        } catch (PDOException $e) {
            $msg = ($e->errorInfo[1] ?? 0) === 1062
                ? 'Cette course possede deja un paiement.'
                : 'Reference course invalide.';
            Response::error($msg, 422);
        }
    }

    public function update(Request $req, array $params): void
    {
        Auth::requireWrite($req);
        $pays = $this->paysOfPaiement($params['id']);
        if ($pays === null) { Response::error('Paiement introuvable.', 404); }
        Auth::requirePaysAccess($req, $pays);
        Response::ok($this->model()->update($params['id'], $req->body()));
    }

    public function destroy(Request $req, array $params): void
    {
        Auth::requireWrite($req);
        $pays = $this->paysOfPaiement($params['id']);
        if ($pays === null) { Response::error('Paiement introuvable.', 404); }
        Auth::requirePaysAccess($req, $pays);
        $this->model()->delete($params['id']);
        Response::noContent();
    }

    private function run(string $sql, array $params): PDOStatement
    {
        $stmt = Database::pdo()->prepare($sql);
        $stmt->execute($params);
        return $stmt;
    }
}
