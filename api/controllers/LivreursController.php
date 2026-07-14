<?php
// =====================================================================
// Livreurs : liste (avec nb de courses / CA cumules) + CRUD
// =====================================================================

class LivreursController
{
    private function model(): Model
    {
        return new Model(
            'livreurs',
            ['ville_id', 'nom', 'prenom', 'telephone', 'note_moyenne', 'statut'],
            ['id' => 'int', 'ville_id' => 'int', 'note_moyenne' => 'float']
        );
    }

    private function paysOfLivreur($id): ?int
    {
        $stmt = Database::pdo()->prepare(
            'SELECT v.pays_id FROM livreurs l JOIN villes v ON v.id = l.ville_id WHERE l.id = ?'
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
        if ($v = $req->queryParam('ville_id')) { $where[] = 'l.ville_id = ?'; $params[] = $v; }
        if ($p = $req->queryParam('pays_id'))  {
            Auth::requirePaysAccess($req, (int) $p);
            $where[] = 'v.pays_id = ?';  $params[] = $p;
        }
        if ($s = $req->queryParam('statut'))   { $where[] = 'l.statut = ?';   $params[] = $s; }
        $scopeSql = Auth::paysScopeSql($req, 'v.pays_id');
        $whereSql = ' WHERE 1 = 1' . $scopeSql . ($where ? ' AND ' . implode(' AND ', $where) : '');

        $stmt = Database::pdo()->prepare(
            "SELECT l.*, v.nom_ville, v.pays_id,
                    COALESCE(agg.nb_courses,0) AS nb_courses_total,
                    COALESCE(agg.ca,0)         AS ca_total
             FROM livreurs l
             JOIN villes v ON v.id = l.ville_id
             LEFT JOIN (
                SELECT livreur_id, COUNT(*) nb_courses, SUM(montant) ca
                FROM courses WHERE statut='terminee' GROUP BY livreur_id
             ) agg ON agg.livreur_id = l.id
             $whereSql
             ORDER BY nb_courses_total DESC, l.note_moyenne DESC"
        );
        $stmt->execute($params);

        Response::ok(array_map(fn ($r) => [
            'id'               => (int) $r['id'],
            'ville_id'         => (int) $r['ville_id'],
            'pays_id'          => (int) $r['pays_id'],
            'nom_ville'        => $r['nom_ville'],
            'nom'              => $r['nom'],
            'prenom'           => $r['prenom'],
            'telephone'        => $r['telephone'],
            'note_moyenne'     => (float) $r['note_moyenne'],
            'statut'           => $r['statut'],
            'nb_courses_total' => (int) $r['nb_courses_total'],
            'ca_total'         => round((float) $r['ca_total'], 2),
        ], $stmt->fetchAll()));
    }

    public function show(Request $req, array $params): void
    {
        $pays = $this->paysOfLivreur($params['id']);
        if ($pays === null) { Response::error('Livreur introuvable.', 404); }
        Auth::requirePaysAccess($req, $pays);
        Response::ok($this->model()->find($params['id']));
    }

    public function store(Request $req): void
    {
        Auth::requireWrite($req);
        foreach (['ville_id', 'nom', 'prenom'] as $f) {
            if (empty($req->input($f))) { Response::error("Champ obligatoire manquant : $f", 422); }
        }
        $pays = $this->paysOfVille($req->input('ville_id'));
        if ($pays === null) { Response::error('Ville invalide.', 422); }
        Auth::requirePaysAccess($req, $pays);
        try {
            Response::ok($this->model()->create($req->body()), 201);
        } catch (PDOException $e) {
            Response::error(($e->errorInfo[1] ?? 0) === 1062 ? 'Telephone deja utilise.' : $e->getMessage(), 422);
        }
    }

    public function update(Request $req, array $params): void
    {
        Auth::requireWrite($req);
        $pays = $this->paysOfLivreur($params['id']);
        if ($pays === null) { Response::error('Livreur introuvable.', 404); }
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
        $pays = $this->paysOfLivreur($params['id']);
        if ($pays === null) { Response::error('Livreur introuvable.', 404); }
        Auth::requirePaysAccess($req, $pays);
        try {
            $this->model()->delete($params['id']);
        } catch (PDOException $e) {
            Response::error('Livreur lie a des courses : suppression impossible.', 409);
        }
        Response::noContent();
    }
}
