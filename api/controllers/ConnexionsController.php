<?php
// =====================================================================
// Connexions / activites : historique cloisonne.
//   SuperAdmin  -> toutes les activites
//   Autres      -> uniquement les siennes
// Le nom de l'utilisateur est joint (la liste /utilisateurs est reservee
// au SuperAdmin, le front ne peut donc pas resoudre les noms lui-meme).
// =====================================================================

class ConnexionsController
{
    public function index(Request $req): void
    {
        $ctx = Auth::context($req);

        $where  = [];
        $params = [];
        if ($ctx['role'] !== 'SuperAdmin') {
            $where[]  = 'c.utilisateur_id = ?';
            $params[] = $ctx['id'];
        } elseif ($uid = $req->queryParam('utilisateur_id')) {
            $where[]  = 'c.utilisateur_id = ?';
            $params[] = $uid;
        }
        if ($a = $req->queryParam('action')) {
            $where[]  = 'c.action = ?';
            $params[] = $a;
        }
        $whereSql = $where ? ' WHERE ' . implode(' AND ', $where) : '';

        $page    = max(1, (int) $req->queryParam('page', 1));
        $perPage = min(200, max(1, (int) $req->queryParam('per_page', 25)));
        $offset  = ($page - 1) * $perPage;

        $countStmt = Database::pdo()->prepare("SELECT COUNT(*) FROM connexions c $whereSql");
        $countStmt->execute($params);
        $total = (int) $countStmt->fetchColumn();

        $stmt = Database::pdo()->prepare(
            "SELECT c.*, CONCAT(u.prenom, ' ', u.nom) AS utilisateur, r.libelle_role AS role
             FROM connexions c
             JOIN utilisateurs u ON u.id = c.utilisateur_id
             JOIN roles r        ON r.id = u.role_id
             $whereSql
             ORDER BY c.date_connexion DESC
             LIMIT $perPage OFFSET $offset"
        );
        $stmt->execute($params);

        $items = array_map(fn ($c) => [
            'id'             => (int) $c['id'],
            'utilisateur_id' => (int) $c['utilisateur_id'],
            'utilisateur'    => $c['utilisateur'],
            'role'           => $c['role'],
            'date_connexion' => $c['date_connexion'],
            'adresse_ip'     => $c['adresse_ip'],
            'duree_secondes' => $c['duree_secondes'] !== null ? (int) $c['duree_secondes'] : null,
            'action'         => $c['action'],
        ], $stmt->fetchAll());

        Response::paginated($items, $total, $page, $perPage);
    }

    // POST /connexions : journalise une action pour l'utilisateur courant.
    public function store(Request $req): void
    {
        $ctx = Auth::context($req);
        $now = date('Y-m-d H:i:s');

        Database::pdo()->prepare(
            'INSERT INTO connexions (utilisateur_id, date_connexion, adresse_ip, duree_secondes, action, created_at)
             VALUES (?,?,?,?,?,?)'
        )->execute([
            $ctx['id'],
            $req->input('date_connexion', $now),
            $req->input('adresse_ip', $_SERVER['REMOTE_ADDR'] ?? '0.0.0.0'),
            $req->input('duree_secondes'),
            $req->input('action', 'action'),
            $now,
        ]);

        Response::ok(['id' => (int) Database::pdo()->lastInsertId()], 201);
    }
}
