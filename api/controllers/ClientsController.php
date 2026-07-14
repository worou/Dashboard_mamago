<?php
// =====================================================================
// Clients : liste filtrable (ville / pays / statut / recherche) + CRUD
// =====================================================================

class ClientsController
{
    private function model(): Model
    {
        return new Model(
            'clients',
            ['ville_id', 'nom', 'prenom', 'email', 'telephone', 'date_inscription', 'statut'],
            ['id' => 'int', 'ville_id' => 'int']
        );
    }

    // Pays d'un client existant (via sa ville) — pour le controle d'acces.
    private function paysOfClient($id): ?int
    {
        $stmt = Database::pdo()->prepare(
            'SELECT v.pays_id FROM clients c JOIN villes v ON v.id = c.ville_id WHERE c.id = ?'
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
        if ($v = $req->queryParam('ville_id'))  { $where[] = 'c.ville_id = ?'; $params[] = $v; }
        if ($p = $req->queryParam('pays_id'))   {
            Auth::requirePaysAccess($req, (int) $p);
            $where[] = 'v.pays_id = ?';  $params[] = $p;
        }
        if ($s = $req->queryParam('statut'))    { $where[] = 'c.statut = ?';   $params[] = $s; }
        if ($q = $req->queryParam('q')) {
            $where[] = '(c.nom LIKE ? OR c.prenom LIKE ? OR c.email LIKE ? OR c.telephone LIKE ?)';
            array_push($params, "%$q%", "%$q%", "%$q%", "%$q%");
        }
        $scopeSql = Auth::paysScopeSql($req, 'v.pays_id');
        $whereSql = ' WHERE 1 = 1' . $scopeSql . ($where ? ' AND ' . implode(' AND ', $where) : '');

        $page    = max(1, (int) $req->queryParam('page', 1));
        $perPage = min(200, max(1, (int) $req->queryParam('per_page', 25)));
        $offset  = ($page - 1) * $perPage;

        $total = (int) $this->prepared(
            "SELECT COUNT(*) FROM clients c JOIN villes v ON v.id=c.ville_id $whereSql", $params
        )->fetchColumn();

        $stmt = $this->prepared(
            "SELECT c.*, v.nom_ville, v.pays_id
             FROM clients c JOIN villes v ON v.id = c.ville_id
             $whereSql ORDER BY c.id DESC LIMIT $perPage OFFSET $offset",
            $params
        );
        $items = array_map(function ($r) {
            $r['id']       = (int) $r['id'];
            $r['ville_id'] = (int) $r['ville_id'];
            $r['pays_id']  = (int) $r['pays_id'];
            return $r;
        }, $stmt->fetchAll());

        Response::paginated($items, $total, $page, $perPage);
    }

    public function show(Request $req, array $params): void
    {
        $pays = $this->paysOfClient($params['id']);
        if ($pays === null) { Response::error('Client introuvable.', 404); }
        Auth::requirePaysAccess($req, $pays);
        Response::ok($this->model()->find($params['id']));
    }

    public function store(Request $req): void
    {
        Auth::requireWrite($req);
        foreach (['ville_id', 'nom', 'prenom', 'date_inscription'] as $f) {
            if (empty($req->input($f))) { Response::error("Champ obligatoire manquant : $f", 422); }
        }
        $pays = $this->paysOfVille($req->input('ville_id'));
        if ($pays === null) { Response::error('Ville invalide.', 422); }
        Auth::requirePaysAccess($req, $pays);
        try {
            Response::ok($this->model()->create($req->body()), 201);
        } catch (PDOException $e) {
            Response::error($this->dbError($e), 422);
        }
    }

    public function update(Request $req, array $params): void
    {
        Auth::requireWrite($req);
        $pays = $this->paysOfClient($params['id']);
        if ($pays === null) { Response::error('Client introuvable.', 404); }
        Auth::requirePaysAccess($req, $pays);

        $b = $req->body();
        if (isset($b['ville_id'])) {
            $cible = $this->paysOfVille($b['ville_id']);
            if ($cible === null) { Response::error('Ville invalide.', 422); }
            Auth::requirePaysAccess($req, $cible);
        }
        try {
            Response::ok($this->model()->update($params['id'], $b));
        } catch (PDOException $e) {
            Response::error($this->dbError($e), 422);
        }
    }

    public function destroy(Request $req, array $params): void
    {
        Auth::requireWrite($req);
        $pays = $this->paysOfClient($params['id']);
        if ($pays === null) { Response::error('Client introuvable.', 404); }
        Auth::requirePaysAccess($req, $pays);
        try {
            $this->model()->delete($params['id']);
        } catch (PDOException $e) {
            Response::error('Client lie a des courses : suppression impossible.', 409);
        }
        Response::noContent();
    }

    private function prepared(string $sql, array $params): PDOStatement
    {
        $stmt = Database::pdo()->prepare($sql);
        $stmt->execute($params);
        return $stmt;
    }

    private function dbError(PDOException $e): string
    {
        return ($e->errorInfo[1] ?? 0) === 1062
            ? 'Email ou telephone deja utilise.'
            : 'Donnees invalides : ' . $e->getMessage();
    }
}
