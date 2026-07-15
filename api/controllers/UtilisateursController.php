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

    /**
     * Un SuperAdmin voit tous les comptes.
     * Un Admin Pays ne voit que les COMMERCIAUX de ses pays (ceux qu'il gere).
     * Un Commercial n'a pas acces a cette ressource.
     */
    private function assertPeutGerer(Request $req, ?array $cible = null): void
    {
        Auth::requireAdmin($req);   // 403 pour un Commercial
        if (Auth::isSuperAdmin($req)) {
            return;
        }
        if ($cible === null) {
            return; // simple listing : filtre applique dans la requete
        }
        // Un Admin Pays ne gere que les commerciaux de ses pays.
        if (($cible['role'] ?? null) !== 'Commercial') {
            Response::error('Acces refuse : vous ne gerez que les comptes commerciaux.', 403);
        }
        $scope = Auth::scopedPaysIds($req) ?? [];
        $paysDuCible = $this->paysIds($cible['id']);
        if (!array_intersect($scope, $paysDuCible)) {
            Response::error('Acces refuse : ce compte est hors de votre perimetre.', 403);
        }
    }

    public function index(Request $req): void
    {
        $this->assertPeutGerer($req);

        $sql    = 'SELECT u.*, r.libelle_role AS role FROM utilisateurs u
                   JOIN roles r ON r.id = u.role_id';
        $where  = [];
        $params = [];

        // Admin Pays : uniquement les commerciaux rattaches a ses pays.
        if (!Auth::isSuperAdmin($req)) {
            $scope = Auth::scopedPaysIds($req) ?: [0];
            $in = implode(',', array_map('intval', $scope));
            $where[] = "r.libelle_role = 'Commercial'";
            $where[] = "u.id IN (SELECT utilisateur_id FROM utilisateur_pays WHERE pays_id IN ($in))";
        }
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

        // On joint le portefeuille (villes) : c'est le perimetre d'un commercial.
        Response::ok(array_map(function ($u) {
            $data = $this->publicUser($u);
            $data['villes'] = $this->villes($u['id']);
            return $data;
        }, $stmt->fetchAll()));
    }

    public function show(Request $req, array $params): void
    {
        $stmt = Database::pdo()->prepare(
            'SELECT u.*, r.libelle_role AS role FROM utilisateurs u
             JOIN roles r ON r.id = u.role_id WHERE u.id = ?'
        );
        $stmt->execute([$params['id']]);
        $u = $stmt->fetch();
        if (!$u) {
            Response::error('Utilisateur introuvable.', 404);
        }
        $this->assertPeutGerer($req, ['id' => $u['id'], 'role' => $u['role']]);

        $data = $this->publicUser($u);
        $data['pays_ids']  = $this->paysIds($u['id']);
        $data['ville_ids'] = array_column($this->villes($u['id']), 'id');
        $data['villes']    = $this->villes($u['id']);
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
                   (role_id, nom, prenom, email, telephone, mot_de_passe_hash, theme_pref, couleur_pref, actif, created_at, updated_at)
                 VALUES (?,?,?,?,?,?,?,?,?,?,?)'
            );
            $now = date('Y-m-d H:i:s');
            $stmt->execute([
                (int) $b['role_id'], $b['nom'], $b['prenom'], $b['email'],
                $b['telephone'] ?? null,
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
        $this->syncVilles($req, $id, $b['ville_ids'] ?? []);
        $this->returnUser($id, 201);
    }

    /**
     * Modification : un SuperAdmin modifie n'importe quel compte.
     * Un Admin Pays modifie (et desactive) les commerciaux de son pays,
     * sans validation — la validation ne porte que sur la CREATION.
     * Il ne peut pas changer leur role.
     */
    public function update(Request $req, array $params): void
    {
        $id = $params['id'];
        $stmt = Database::pdo()->prepare(
            'SELECT u.*, r.libelle_role AS role FROM utilisateurs u
             JOIN roles r ON r.id = u.role_id WHERE u.id = ?'
        );
        $stmt->execute([$id]);
        $cible = $stmt->fetch();
        if (!$cible) {
            Response::error('Utilisateur introuvable.', 404);
        }
        $this->assertPeutGerer($req, ['id' => $cible['id'], 'role' => $cible['role']]);

        $b = $req->body();

        // Un Admin Pays ne peut pas changer le role d'un commercial.
        if (!Auth::isSuperAdmin($req) && isset($b['role_id'])
            && (int) $b['role_id'] !== (int) $cible['role_id']) {
            Response::error('Acces refuse : vous ne pouvez pas changer le role de ce compte.', 403);
        }

        $fields = [];
        $vals   = [];
        foreach (['role_id', 'nom', 'prenom', 'email', 'telephone', 'theme_pref', 'couleur_pref'] as $f) {
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
        // Portefeuille du commercial : ses villes (chaque ville inclut tous ses services)
        if (array_key_exists('ville_ids', $b)) {
            $this->syncVilles($req, $id, $b['ville_ids'] ?? []);
        }
        $this->returnUser($id);
    }

    public function destroy(Request $req, array $params): void
    {
        $stmt = Database::pdo()->prepare(
            'SELECT u.id, r.libelle_role AS role FROM utilisateurs u
             JOIN roles r ON r.id = u.role_id WHERE u.id = ?'
        );
        $stmt->execute([$params['id']]);
        $cible = $stmt->fetch();
        if (!$cible) {
            Response::error('Utilisateur introuvable.', 404);
        }
        $this->assertPeutGerer($req, ['id' => $cible['id'], 'role' => $cible['role']]);

        Database::pdo()->prepare('DELETE FROM utilisateurs WHERE id = ?')->execute([$params['id']]);
        Response::noContent();
    }

    private function paysIds($userId): array
    {
        $stmt = Database::pdo()->prepare('SELECT pays_id FROM utilisateur_pays WHERE utilisateur_id = ?');
        $stmt->execute([$userId]);
        return array_map('intval', $stmt->fetchAll(PDO::FETCH_COLUMN));
    }

    // Portefeuille : les villes attribuees a l'utilisateur (avec leur pays).
    private function villes($userId): array
    {
        $stmt = Database::pdo()->prepare(
            'SELECT v.id, v.nom_ville, v.pays_id, p.nom_pays
             FROM utilisateur_ville uv
             JOIN villes v ON v.id = uv.ville_id
             JOIN pays p   ON p.id = v.pays_id
             WHERE uv.utilisateur_id = ?
             ORDER BY v.nom_ville'
        );
        $stmt->execute([$userId]);
        return array_map(fn ($v) => [
            'id'        => (int) $v['id'],
            'nom_ville' => $v['nom_ville'],
            'pays_id'   => (int) $v['pays_id'],
            'nom_pays'  => $v['nom_pays'],
        ], $stmt->fetchAll());
    }

    // Remplace le portefeuille. Chaque ville doit etre dans le perimetre du demandeur.
    private function syncVilles(Request $req, $userId, $villeIds): void
    {
        if (!is_array($villeIds)) {
            return;
        }
        $pdo = Database::pdo();
        foreach ($villeIds as $vid) {
            $vs = $pdo->prepare('SELECT pays_id FROM villes WHERE id = ?');
            $vs->execute([(int) $vid]);
            $paysId = $vs->fetchColumn();
            if ($paysId === false) {
                Response::error('Ville invalide dans le portefeuille : ' . $vid, 422);
            }
            Auth::requirePaysAccess($req, (int) $paysId);
        }

        $pdo->prepare('DELETE FROM utilisateur_ville WHERE utilisateur_id = ?')->execute([$userId]);
        $ins = $pdo->prepare('INSERT INTO utilisateur_ville (utilisateur_id, ville_id) VALUES (?, ?)');
        foreach ($villeIds as $vid) {
            $ins->execute([$userId, (int) $vid]);
        }
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
