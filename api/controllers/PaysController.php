<?php
// =====================================================================
// Pays : liste cloisonnee au perimetre de l'utilisateur + creation d'un
// pays avec provisionnement automatique de son compte "Admin Pays".
// =====================================================================

class PaysController
{
    private function model(): Model
    {
        return new Model('pays', ['nom_pays', 'code_iso', 'devise'], ['id' => 'int', 'ca_global' => 'float']);
    }

    // GET /pays  (SuperAdmin : tous / Admin Pays : les siens)
    public function index(Request $req): void
    {
        $scopeSql = Auth::paysScopeSql($req, 'p.id');
        $stmt = Database::pdo()->prepare(
            "SELECT p.*,
                    (SELECT COUNT(*) FROM villes v WHERE v.pays_id = p.id) AS nb_villes,
                    (SELECT COUNT(*) FROM utilisateur_pays up WHERE up.pays_id = p.id) AS nb_admins
             FROM pays p
             WHERE 1 = 1 $scopeSql
             ORDER BY p.nom_pays ASC"
        );
        $stmt->execute();

        Response::ok(array_map(fn ($p) => [
            'id'        => (int) $p['id'],
            'nom_pays'  => $p['nom_pays'],
            'code_iso'  => $p['code_iso'],
            'devise'    => $p['devise'],
            'ca_global' => (float) $p['ca_global'],
            'nb_villes' => (int) $p['nb_villes'],
            'nb_admins' => (int) $p['nb_admins'],
        ], $stmt->fetchAll()));
    }

    public function show(Request $req, array $params): void
    {
        Auth::requirePaysAccess($req, (int) $params['id']);
        $p = $this->model()->find($params['id']);
        if (!$p) {
            Response::error('Pays introuvable.', 404);
        }
        Response::ok($p);
    }

    /**
     * POST /pays  (SuperAdmin uniquement)
     * Cree le pays et, si demande, son interface admin : compte "Admin Pays"
     * rattache au pays via utilisateur_pays.
     *
     * Corps :
     * {
     *   "nom_pays":"Niger", "code_iso":"NE", "devise":"XOF",
     *   "creer_admin": true,
     *   "admin": { "nom":"Sow", "prenom":"Aminata",
     *              "email":"admin.ne@mamago.com", "mot_de_passe":"secret" }
     * }
     */
    public function store(Request $req): void
    {
        Auth::requireSuperAdmin($req);

        $b = $req->body();
        if (empty($b['nom_pays'])) {
            Response::error('Le nom du pays est obligatoire.', 422);
        }

        $creerAdmin = !empty($b['creer_admin']);
        $admin      = is_array($b['admin'] ?? null) ? $b['admin'] : [];

        if ($creerAdmin) {
            foreach (['nom', 'prenom', 'mot_de_passe'] as $f) {
                if (empty($admin[$f])) {
                    Response::error("Compte admin : champ obligatoire manquant : $f", 422);
                }
            }
        }

        $pdo = Database::pdo();
        $now = date('Y-m-d H:i:s');
        $pdo->beginTransaction();

        try {
            // 1. Le pays
            $st = $pdo->prepare(
                'INSERT INTO pays (nom_pays, code_iso, devise, ca_global, created_at, updated_at)
                 VALUES (?,?,?,0,?,?)'
            );
            $code = strtoupper(substr((string) ($b['code_iso'] ?? ''), 0, 2)) ?: null;
            $st->execute([$b['nom_pays'], $code, $b['devise'] ?? 'XOF', $now, $now]);
            $paysId = (int) $pdo->lastInsertId();

            // 2. Son interface admin : le compte "Admin Pays"
            $adminCree = null;
            if ($creerAdmin) {
                $roleId = $pdo->query("SELECT id FROM roles WHERE libelle_role = 'Admin Pays' LIMIT 1")->fetchColumn();
                if (!$roleId) {
                    throw new RuntimeException("Le role 'Admin Pays' n'existe pas.");
                }

                // Email par defaut : admin.<code>@mamago.com
                $email = trim((string) ($admin['email'] ?? ''));
                if ($email === '') {
                    $slug  = strtolower($code ?: preg_replace('/[^a-z]/i', '', $b['nom_pays']));
                    $email = 'admin.' . $slug . '@mamago.com';
                }

                $su = $pdo->prepare(
                    'INSERT INTO utilisateurs
                        (role_id, nom, prenom, email, mot_de_passe_hash, theme_pref, couleur_pref, actif, created_at, updated_at)
                     VALUES (?,?,?,?,?,?,?,1,?,?)'
                );
                $su->execute([
                    (int) $roleId, $admin['nom'], $admin['prenom'], $email,
                    password_hash($admin['mot_de_passe'], PASSWORD_DEFAULT),
                    'clair', 'vert', $now, $now,
                ]);
                $userId = (int) $pdo->lastInsertId();

                // Rattachement au perimetre du pays
                $pdo->prepare('INSERT INTO utilisateur_pays (utilisateur_id, pays_id) VALUES (?, ?)')
                    ->execute([$userId, $paysId]);

                $adminCree = [
                    'id'     => $userId,
                    'nom'    => $admin['nom'],
                    'prenom' => $admin['prenom'],
                    'email'  => $email,
                    'role'   => 'Admin Pays',
                ];
            }

            $pdo->commit();

            Response::ok([
                'pays'  => $this->model()->find($paysId),
                'admin' => $adminCree,
            ], 201);

        } catch (PDOException $e) {
            $pdo->rollBack();
            $code = $e->errorInfo[1] ?? 0;
            $msg  = $code === 1062
                ? 'Doublon : ce pays ou cet email existe deja.'
                : 'Creation impossible : ' . $e->getMessage();
            Response::error($msg, 422);
        } catch (Throwable $e) {
            $pdo->rollBack();
            Response::error('Creation impossible : ' . $e->getMessage(), 500);
        }
    }

    public function update(Request $req, array $params): void
    {
        Auth::requireSuperAdmin($req);
        if (!$this->model()->find($params['id'])) {
            Response::error('Pays introuvable.', 404);
        }
        try {
            Response::ok($this->model()->update($params['id'], $req->body()));
        } catch (PDOException $e) {
            Response::error('Modification impossible : donnees invalides.', 422);
        }
    }

    public function destroy(Request $req, array $params): void
    {
        Auth::requireSuperAdmin($req);
        if (!$this->model()->find($params['id'])) {
            Response::error('Pays introuvable.', 404);
        }
        try {
            $this->model()->delete($params['id']);
        } catch (PDOException $e) {
            Response::error('Suppression impossible : ce pays contient encore des donnees.', 409);
        }
        Response::noContent();
    }
}
