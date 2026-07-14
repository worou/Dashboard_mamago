<?php
// =====================================================================
// Villes : CRUD cloisonne au perimetre pays de l'utilisateur.
// =====================================================================

class VillesController
{
    private function model(): Model
    {
        return new Model('villes', ['pays_id', 'nom_ville'], ['id' => 'int', 'pays_id' => 'int']);
    }

    // Pays d'une ville existante (pour verifier l'acces avant modif/suppression).
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
        if ($p = $req->queryParam('pays_id')) {
            Auth::requirePaysAccess($req, (int) $p);
            $where[]  = 'v.pays_id = ?';
            $params[] = $p;
        }
        $scopeSql = Auth::paysScopeSql($req, 'v.pays_id');
        $whereSql = $where ? ' AND ' . implode(' AND ', $where) : '';

        $stmt = Database::pdo()->prepare(
            "SELECT v.*, p.nom_pays,
                    (SELECT COUNT(*) FROM clients c  WHERE c.ville_id  = v.id) AS nb_clients,
                    (SELECT COUNT(*) FROM livreurs l WHERE l.ville_id  = v.id) AS nb_livreurs
             FROM villes v JOIN pays p ON p.id = v.pays_id
             WHERE 1 = 1 $scopeSql $whereSql
             ORDER BY v.nom_ville ASC"
        );
        $stmt->execute($params);

        Response::ok(array_map(fn ($v) => [
            'id'          => (int) $v['id'],
            'pays_id'     => (int) $v['pays_id'],
            'nom_pays'    => $v['nom_pays'],
            'nom_ville'   => $v['nom_ville'],
            'nb_clients'  => (int) $v['nb_clients'],
            'nb_livreurs' => (int) $v['nb_livreurs'],
        ], $stmt->fetchAll()));
    }

    public function show(Request $req, array $params): void
    {
        $pays = $this->paysOfVille($params['id']);
        if ($pays === null) {
            Response::error('Ville introuvable.', 404);
        }
        Auth::requirePaysAccess($req, $pays);
        Response::ok($this->model()->find($params['id']));
    }

    public function store(Request $req): void
    {
        Auth::requireWrite($req);
        $b = $req->body();
        foreach (['pays_id', 'nom_ville'] as $f) {
            if (empty($b[$f])) {
                Response::error("Champ obligatoire manquant : $f", 422);
            }
        }
        Auth::requirePaysAccess($req, (int) $b['pays_id']);
        try {
            Response::ok($this->model()->create($b), 201);
        } catch (PDOException $e) {
            Response::error('Creation impossible : pays invalide.', 422);
        }
    }

    public function update(Request $req, array $params): void
    {
        Auth::requireWrite($req);
        $pays = $this->paysOfVille($params['id']);
        if ($pays === null) {
            Response::error('Ville introuvable.', 404);
        }
        Auth::requirePaysAccess($req, $pays);

        $b = $req->body();
        // Interdit de deplacer une ville vers un pays hors perimetre
        if (isset($b['pays_id'])) {
            Auth::requirePaysAccess($req, (int) $b['pays_id']);
        }
        Response::ok($this->model()->update($params['id'], $b));
    }

    public function destroy(Request $req, array $params): void
    {
        Auth::requireWrite($req);
        $pays = $this->paysOfVille($params['id']);
        if ($pays === null) {
            Response::error('Ville introuvable.', 404);
        }
        Auth::requirePaysAccess($req, $pays);
        try {
            $this->model()->delete($params['id']);
        } catch (PDOException $e) {
            Response::error('Suppression impossible : la ville contient des clients ou livreurs.', 409);
        }
        Response::noContent();
    }
}
