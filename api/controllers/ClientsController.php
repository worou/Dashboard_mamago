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

    public function index(Request $req): void
    {
        $where  = [];
        $params = [];
        if ($v = $req->queryParam('ville_id'))  { $where[] = 'c.ville_id = ?'; $params[] = $v; }
        if ($p = $req->queryParam('pays_id'))   { $where[] = 'v.pays_id = ?';  $params[] = $p; }
        if ($s = $req->queryParam('statut'))    { $where[] = 'c.statut = ?';   $params[] = $s; }
        if ($q = $req->queryParam('q')) {
            $where[] = '(c.nom LIKE ? OR c.prenom LIKE ? OR c.email LIKE ? OR c.telephone LIKE ?)';
            array_push($params, "%$q%", "%$q%", "%$q%", "%$q%");
        }
        $whereSql = $where ? ' WHERE ' . implode(' AND ', $where) : '';

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
        $c = $this->model()->find($params['id']);
        if (!$c) { Response::error('Client introuvable.', 404); }
        Response::ok($c);
    }

    public function store(Request $req): void
    {
        foreach (['ville_id', 'nom', 'prenom', 'date_inscription'] as $f) {
            if (empty($req->input($f))) { Response::error("Champ obligatoire manquant : $f", 422); }
        }
        try {
            Response::ok($this->model()->create($req->body()), 201);
        } catch (PDOException $e) {
            Response::error($this->dbError($e), 422);
        }
    }

    public function update(Request $req, array $params): void
    {
        if (!$this->model()->find($params['id'])) { Response::error('Client introuvable.', 404); }
        try {
            Response::ok($this->model()->update($params['id'], $req->body()));
        } catch (PDOException $e) {
            Response::error($this->dbError($e), 422);
        }
    }

    public function destroy(Request $req, array $params): void
    {
        if (!$this->model()->find($params['id'])) { Response::error('Client introuvable.', 404); }
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
