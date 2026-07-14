<?php
// =====================================================================
// Courses : liste filtrable (pays/ville/service/client/livreur/statut/dates)
// avec libelles joints + paiement, + CRUD.
// =====================================================================

class CoursesController
{
    private function model(): Model
    {
        return new Model(
            'courses',
            ['client_id', 'livreur_id', 'ville_id', 'service_id', 'date_course', 'montant', 'duree_minutes', 'statut'],
            ['id' => 'int', 'client_id' => 'int', 'livreur_id' => 'int', 'ville_id' => 'int',
             'service_id' => 'int', 'montant' => 'float', 'duree_minutes' => 'int']
        );
    }

    private function paysOfCourse($id): ?int
    {
        $stmt = Database::pdo()->prepare(
            'SELECT v.pays_id FROM courses co JOIN villes v ON v.id = co.ville_id WHERE co.id = ?'
        );
        $stmt->execute([$id]);
        $p = $stmt->fetchColumn();
        return $p === false ? null : (int) $p;
    }

    private function paysOfVille($villeId): ?int
    {
        $stmt = Database::pdo()->prepare('SELECT pays_id FROM villes WHERE id = ?');
        $stmt->execute([$villeId]);
        $p = $stmt->fetchColumn();
        return $p === false ? null : (int) $p;
    }

    public function index(Request $req): void
    {
        $where  = [];
        $params = [];
        if ($p = $req->queryParam('pays_id'))    {
            Auth::requirePaysAccess($req, (int) $p);
            $where[] = 'v.pays_id = ?';    $params[] = $p;
        }
        if ($v = $req->queryParam('ville_id'))   { $where[] = 'co.ville_id = ?';   $params[] = $v; }
        if ($s = $req->queryParam('service_id')) { $where[] = 'co.service_id = ?'; $params[] = $s; }
        if ($c = $req->queryParam('client_id'))  { $where[] = 'co.client_id = ?';  $params[] = $c; }
        if ($l = $req->queryParam('livreur_id')) { $where[] = 'co.livreur_id = ?'; $params[] = $l; }
        if ($st = $req->queryParam('statut'))    { $where[] = 'co.statut = ?';     $params[] = $st; }
        if ($f = $req->queryParam('from'))       { $where[] = 'co.date_course >= ?'; $params[] = $f . ' 00:00:00'; }
        if ($t = $req->queryParam('to'))         { $where[] = 'co.date_course <= ?'; $params[] = $t . ' 23:59:59'; }
        $scopeSql = Auth::paysScopeSql($req, 'v.pays_id');
        $whereSql = ' WHERE 1 = 1' . $scopeSql . ($where ? ' AND ' . implode(' AND ', $where) : '');

        $page    = max(1, (int) $req->queryParam('page', 1));
        $perPage = min(200, max(1, (int) $req->queryParam('per_page', 25)));
        $offset  = ($page - 1) * $perPage;

        $total = (int) $this->run(
            "SELECT COUNT(*) FROM courses co JOIN villes v ON v.id=co.ville_id $whereSql", $params
        )->fetchColumn();

        $stmt = $this->run(
            "SELECT co.*, v.nom_ville, v.pays_id, s.nom_service,
                    CONCAT(cl.prenom,' ',cl.nom) AS client_nom,
                    CONCAT(COALESCE(li.prenom,''),' ',COALESCE(li.nom,'')) AS livreur_nom,
                    pa.type_paiement, pa.statut AS paiement_statut
             FROM courses co
             JOIN villes v   ON v.id = co.ville_id
             JOIN services s ON s.id = co.service_id
             JOIN clients cl ON cl.id = co.client_id
             LEFT JOIN livreurs li ON li.id = co.livreur_id
             LEFT JOIN paiements pa ON pa.course_id = co.id
             $whereSql
             ORDER BY co.date_course DESC LIMIT $perPage OFFSET $offset",
            $params
        );

        $items = array_map(function ($r) {
            $r['id']         = (int) $r['id'];
            $r['ville_id']   = (int) $r['ville_id'];
            $r['pays_id']    = (int) $r['pays_id'];
            $r['service_id'] = (int) $r['service_id'];
            $r['client_id']  = (int) $r['client_id'];
            $r['livreur_id'] = $r['livreur_id'] !== null ? (int) $r['livreur_id'] : null;
            $r['montant']    = (float) $r['montant'];
            $r['duree_minutes'] = $r['duree_minutes'] !== null ? (int) $r['duree_minutes'] : null;
            $r['client_nom']  = trim($r['client_nom']);
            $r['livreur_nom'] = trim($r['livreur_nom']) ?: null;
            return $r;
        }, $stmt->fetchAll());

        Response::paginated($items, $total, $page, $perPage);
    }

    public function show(Request $req, array $params): void
    {
        $pays = $this->paysOfCourse($params['id']);
        if ($pays === null) { Response::error('Course introuvable.', 404); }
        Auth::requirePaysAccess($req, $pays);
        Response::ok($this->model()->find($params['id']));
    }

    public function store(Request $req): void
    {
        Auth::requireWrite($req);
        foreach (['client_id', 'ville_id', 'service_id', 'date_course'] as $f) {
            if (empty($req->input($f))) { Response::error("Champ obligatoire manquant : $f", 422); }
        }
        $pays = $this->paysOfVille($req->input('ville_id'));
        if ($pays === null) { Response::error('Ville invalide.', 422); }
        Auth::requirePaysAccess($req, $pays);
        try {
            Response::ok($this->model()->create($req->body()), 201);
        } catch (PDOException $e) {
            Response::error('Reference invalide (client / ville / service).', 422);
        }
    }

    public function update(Request $req, array $params): void
    {
        Auth::requireWrite($req);
        $pays = $this->paysOfCourse($params['id']);
        if ($pays === null) { Response::error('Course introuvable.', 404); }
        Auth::requirePaysAccess($req, $pays);

        $b = $req->body();
        if (isset($b['ville_id'])) {
            $cible = $this->paysOfVille($b['ville_id']);
            if ($cible === null) { Response::error('Ville invalide.', 422); }
            Auth::requirePaysAccess($req, $cible);
        }
        Response::ok($this->model()->update($params['id'], $b));
    }

    public function destroy(Request $req, array $params): void
    {
        Auth::requireWrite($req);
        $pays = $this->paysOfCourse($params['id']);
        if ($pays === null) { Response::error('Course introuvable.', 404); }
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
