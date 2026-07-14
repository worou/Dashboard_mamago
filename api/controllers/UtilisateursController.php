<?php
// =====================================================================
// Utilisateurs : CRUD avec hachage du mot de passe et gestion des pays.
// =====================================================================

class UtilisateursController
{
    private function publicUser(array $u): array
    {
        unset($u['mot_de_passe_hash']);
        $u['id']      = (int) $u['id'];
        $u['role_id'] = (int) $u['role_id'];
        $u['actif']   = (bool) $u['actif'];
        return $u;
    }

    public function index(Request $req): void
    {
        Auth::requireSuperAdmin($req);
        $sql    = 'SELECT u.*, r.libelle_role AS role FROM utilisateurs u
                   JOIN roles r ON r.id = u.role_id';
        $where  = [];
        $params = [];
        if ($rid = $req->queryParam('role_id')) {
            $where[] = 'u.role_id = ?';
            $params[] = $rid;
        }
        if ($q = $req->queryParam('q')) {
            $where[] = '(u.nom LIKE ? OR u.prenom LIKE ? OR u.email LIKE ?)';
            array_push($params, "%$q%", "%$q%", "%$q%");
        }
        if ($where) {
            $sql .= ' WHERE ' . implode(' AND ', $where);
        }
        $sql .= ' ORDER BY u.id DESC';

        $stmt = Database::pdo()->prepare($sql);
        $stmt->execute($params);
        Response::ok(array_map([$this, 'publicUser'], $stmt->fetchAll()));
    }

    public function show(Request $req, array $params): void
    {
        Auth::requireSuperAdmin($req);
        $stmt = Database::pdo()->prepare('SELECT * FROM utilisateurs WHERE id = ?');
        $stmt->execute([$params['id']]);
        $u = $stmt->fetch();
        if (!$u) {
            Response::error('Utilisateur introuvable.', 404);
        }
        $data = $this->publicUser($u);
        $data['pays_ids'] = $this->paysIds($u['id']);
        Response::ok($data);
    }

    public function store(Request $req): void
    {
        Auth::requireSuperAdmin($req);
        $b = $req->body();
        foreach (['nom', 'prenom', 'email', 'mot_de_passe', 'role_id'] as $f) {
            if (empty($b[$f])) {
                Response::error("Champ obligatoire manquant : $f", 422);
            }
        }

        try {
            $stmt = Database::pdo()->prepare(
                'INSERT INTO utilisateurs
                   (role_id, nom, prenom, email, mot_de_passe_hash, theme_pref, couleur_pref, actif, created_at, updated_at)
                 VALUES (?,?,?,?,?,?,?,?,?,?)'
            );
            $now = date('Y-m-d H:i:s');
            $stmt->execute([
                (int) $b['role_id'], $b['nom'], $b['prenom'], $b['email'],
                password_hash($b['mot_de_passe'], PASSWORD_DEFAULT),
                $b['theme_pref']   ?? 'clair',
                $b['couleur_pref'] ?? 'vert',
                isset($b['actif']) ? (int) (bool) $b['actif'] : 1,
                $now, $now,
            ]);
        } catch (PDOException $e) {
            $msg = ($e->errorInfo[1] ?? 0) === 1062
                ? 'Cet email est deja utilise.'
                : 'Donnees invalides : ' . $e->getMessage();
            Response::error($msg, 422);
        }

        $id = Database::pdo()->lastInsertId();
        $this->syncPays($id, $b['pays_ids'] ?? []);
        $this->returnUser($id, 201);
    }

    public function update(Request $req, array $params): void
    {
        Auth::requireSuperAdmin($req);
        $id = $params['id'];
        $stmt = Database::pdo()->prepare('SELECT * FROM utilisateurs WHERE id = ?');
        $stmt->execute([$id]);
        if (!$stmt->fetch()) {
            Response::error('Utilisateur introuvable.', 404);
        }

        $b = $req->body();
        $fields = [];
        $vals   = [];
        foreach (['role_id', 'nom', 'prenom', 'email', 'theme_pref', 'couleur_pref'] as $f) {
            if (array_key_exists($f, $b)) {
                $fields[] = "$f = ?";
                $vals[]   = $b[$f];
            }
        }
        if (array_key_exists('actif', $b)) {
            $fields[] = 'actif = ?';
            $vals[]   = (int) (bool) $b['actif'];
        }
        if (!empty($b['mot_de_passe'])) {
            $fields[] = 'mot_de_passe_hash = ?';
            $vals[]   = password_hash($b['mot_de_passe'], PASSWORD_DEFAULT);
        }

        if ($fields) {
            $fields[] = 'updated_at = ?';
            $vals[]   = date('Y-m-d H:i:s');
            $vals[]   = $id;
            try {
                Database::pdo()->prepare(
                    'UPDATE utilisateurs SET ' . implode(', ', $fields) . ' WHERE id = ?'
                )->execute($vals);
            } catch (PDOException $e) {
                $msg = ($e->errorInfo[1] ?? 0) === 1062
                    ? 'Cet email est deja utilise.'
                    : 'Donnees invalides : ' . $e->getMessage();
                Response::error($msg, 422);
            }
        }

        if (array_key_exists('pays_ids', $b)) {
            $this->syncPays($id, $b['pays_ids'] ?? []);
        }
        $this->returnUser($id);
    }

    public function destroy(Request $req, array $params): void
    {
        Auth::requireSuperAdmin($req);
        $stmt = Database::pdo()->prepare('SELECT id FROM utilisateurs WHERE id = ?');
        $stmt->execute([$params['id']]);
        if (!$stmt->fetch()) {
            Response::error('Utilisateur introuvable.', 404);
        }
        Database::pdo()->prepare('DELETE FROM utilisateurs WHERE id = ?')->execute([$params['id']]);
        Response::noContent();
    }

    private function paysIds($userId): array
    {
        $stmt = Database::pdo()->prepare('SELECT pays_id FROM utilisateur_pays WHERE utilisateur_id = ?');
        $stmt->execute([$userId]);
        return array_map('intval', $stmt->fetchAll(PDO::FETCH_COLUMN));
    }

    private function syncPays($userId, $paysIds): void
    {
        if (!is_array($paysIds)) {
            return;
        }
        Database::pdo()->prepare('DELETE FROM utilisateur_pays WHERE utilisateur_id = ?')->execute([$userId]);
        $ins = Database::pdo()->prepare('INSERT INTO utilisateur_pays (utilisateur_id, pays_id) VALUES (?, ?)');
        foreach ($paysIds as $pid) {
            $ins->execute([$userId, (int) $pid]);
        }
    }

    private function returnUser($id, int $status = 200): void
    {
        $stmt = Database::pdo()->prepare(
            'SELECT u.*, r.libelle_role AS role FROM utilisateurs u
             JOIN roles r ON r.id = u.role_id WHERE u.id = ?'
        );
        $stmt->execute([$id]);
        $u = $stmt->fetch();
        $data = $this->publicUser($u);
        $data['pays_ids'] = $this->paysIds($id);
        Response::ok($data, $status);
    }
}
