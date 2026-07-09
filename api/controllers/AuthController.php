<?php
// =====================================================================
// Authentification : login, profil courant
// =====================================================================

class AuthController
{
    public function login(Request $req): void
    {
        $email = trim((string) $req->input('email', ''));
        $pass  = (string) $req->input('mot_de_passe', '');

        if ($email === '' || $pass === '') {
            Response::error('Email et mot de passe requis.', 422);
        }

        $stmt = Database::pdo()->prepare(
            'SELECT * FROM utilisateurs WHERE email = ? AND actif = 1 LIMIT 1'
        );
        $stmt->execute([$email]);
        $user = $stmt->fetch();

        if (!$user || !password_verify($pass, $user['mot_de_passe_hash'])) {
            Response::error('Identifiants invalides.', 401);
        }

        // Mise a jour de la derniere connexion + trace
        $now = date('Y-m-d H:i:s');
        Database::pdo()->prepare('UPDATE utilisateurs SET derniere_connexion = ? WHERE id = ?')
            ->execute([$now, $user['id']]);

        Database::pdo()->prepare(
            'INSERT INTO connexions (utilisateur_id, date_connexion, adresse_ip, action, created_at)
             VALUES (?, ?, ?, ?, ?)'
        )->execute([
            $user['id'], $now, $_SERVER['REMOTE_ADDR'] ?? '0.0.0.0', 'connexion', $now,
        ]);

        $token = Auth::issueToken($user);

        Response::ok([
            'token'        => $token,
            'token_type'   => 'Bearer',
            'utilisateur'  => $this->publicUser($user),
        ]);
    }

    public function me(Request $req): void
    {
        $payload = Auth::requireAuth($req);
        $stmt = Database::pdo()->prepare('SELECT * FROM utilisateurs WHERE id = ? LIMIT 1');
        $stmt->execute([$payload['sub']]);
        $user = $stmt->fetch();
        if (!$user) {
            Response::error('Utilisateur introuvable.', 404);
        }

        // Pays geres + role
        $pays = Database::pdo()->prepare(
            'SELECT p.* FROM pays p
             JOIN utilisateur_pays up ON up.pays_id = p.id
             WHERE up.utilisateur_id = ?'
        );
        $pays->execute([$user['id']]);

        $data = $this->publicUser($user);
        $data['pays_geres'] = $pays->fetchAll();
        Response::ok($data);
    }

    private function publicUser(array $user): array
    {
        unset($user['mot_de_passe_hash']);
        $user['id']      = (int) $user['id'];
        $user['role_id'] = (int) $user['role_id'];
        $user['actif']   = (bool) $user['actif'];

        // Libelle du role pour le front
        $stmt = Database::pdo()->prepare('SELECT libelle_role FROM roles WHERE id = ?');
        $stmt->execute([$user['role_id']]);
        $user['role'] = $stmt->fetchColumn() ?: null;

        return $user;
    }
}
