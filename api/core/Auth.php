<?php
// =====================================================================
// Authentification par jeton signe (HMAC-SHA256, format type JWT).
// Pragmatique : pas de dependance externe.
// =====================================================================

class Auth
{
    private static array $config;
    private static ?array $currentUser = null;

    public static function init(array $config): void
    {
        self::$config = $config;
    }

    private static function b64(string $data): string
    {
        return rtrim(strtr(base64_encode($data), '+/', '-_'), '=');
    }

    private static function b64decode(string $data): string
    {
        return base64_decode(strtr($data, '-_', '+/')) ?: '';
    }

    // Genere un jeton pour un utilisateur donne.
    public static function issueToken(array $utilisateur): string
    {
        $header  = ['alg' => 'HS256', 'typ' => 'JWT'];
        $now     = time();
        $payload = [
            'sub'   => (int) $utilisateur['id'],
            'email' => $utilisateur['email'],
            'role'  => $utilisateur['role_id'] ?? null,
            'iat'   => $now,
            'exp'   => $now + self::$config['jwt_ttl'],
        ];

        $segments = [
            self::b64(json_encode($header)),
            self::b64(json_encode($payload)),
        ];
        $signature  = hash_hmac('sha256', implode('.', $segments), self::$config['jwt_secret'], true);
        $segments[] = self::b64($signature);

        return implode('.', $segments);
    }

    // Valide un jeton et retourne le payload, ou null si invalide/expire.
    public static function decodeToken(?string $token): ?array
    {
        if (!$token || substr_count($token, '.') !== 2) {
            return null;
        }
        [$h, $p, $s] = explode('.', $token);

        $expected = self::b64(hash_hmac('sha256', "$h.$p", self::$config['jwt_secret'], true));
        if (!hash_equals($expected, $s)) {
            return null;
        }

        $payload = json_decode(self::b64decode($p), true);
        if (!is_array($payload) || ($payload['exp'] ?? 0) < time()) {
            return null;
        }
        return $payload;
    }

    // Resout l'utilisateur courant depuis l'entete Authorization (optionnel).
    public static function resolve(Request $request): ?array
    {
        $payload = self::decodeToken($request->bearerToken());
        self::$currentUser = $payload;
        return $payload;
    }

    // A appeler dans un handler pour exiger un jeton valide.
    public static function requireAuth(Request $request): array
    {
        $payload = self::$currentUser ?? self::resolve($request);
        if (!$payload) {
            Response::error('Authentification requise ou jeton invalide.', 401);
        }
        return $payload;
    }

    public static function currentUser(): ?array
    {
        return self::$currentUser;
    }

    // =================================================================
    // CLOISONNEMENT PAR PAYS
    // Le contexte (role + perimetre) est charge une fois par requete.
    // =================================================================

    private static ?array $ctx = null;

    /**
     * Contexte de l'utilisateur connecte :
     *   ['id', 'email', 'role', 'pays_ids' => int[], 'ville_ids' => int[]]
     *
     * Perimetres :
     *   SuperAdmin  -> tout
     *   Admin Pays  -> ses pays          (utilisateur_pays)
     *   Commercial  -> ses villes        (utilisateur_ville = son portefeuille)
     */
    public static function context(Request $request): array
    {
        if (self::$ctx !== null) {
            return self::$ctx;
        }
        $payload = self::requireAuth($request);
        $pdo = Database::pdo();

        $stmt = $pdo->prepare(
            'SELECT u.id, u.email, r.libelle_role AS role
             FROM utilisateurs u JOIN roles r ON r.id = u.role_id
             WHERE u.id = ? AND u.actif = 1 LIMIT 1'
        );
        $stmt->execute([$payload['sub']]);
        $user = $stmt->fetch();
        if (!$user) {
            Response::error('Compte introuvable ou desactive.', 401);
        }

        $ps = $pdo->prepare('SELECT pays_id FROM utilisateur_pays WHERE utilisateur_id = ?');
        $ps->execute([$user['id']]);
        $paysIds = array_map('intval', $ps->fetchAll(PDO::FETCH_COLUMN));

        $vs = $pdo->prepare('SELECT ville_id FROM utilisateur_ville WHERE utilisateur_id = ?');
        $vs->execute([$user['id']]);
        $villeIds = array_map('intval', $vs->fetchAll(PDO::FETCH_COLUMN));

        // Pour un Commercial, le pays decoule de son portefeuille de villes.
        if ($user['role'] === 'Commercial' && $villeIds) {
            $in = implode(',', $villeIds);
            $dp = $pdo->query("SELECT DISTINCT pays_id FROM villes WHERE id IN ($in)");
            $paysIds = array_map('intval', $dp->fetchAll(PDO::FETCH_COLUMN));
        }

        self::$ctx = [
            'id'        => (int) $user['id'],
            'email'     => $user['email'],
            'role'      => $user['role'],
            'pays_ids'  => $paysIds,
            'ville_ids' => $villeIds,
        ];
        return self::$ctx;
    }

    public static function isSuperAdmin(Request $request): bool
    {
        return self::context($request)['role'] === 'SuperAdmin';
    }

    /**
     * Perimetre pays de l'utilisateur.
     * null  = acces total (SuperAdmin)
     * int[] = liste des pays autorises (peut etre vide)
     */
    public static function scopedPaysIds(Request $request): ?array
    {
        $ctx = self::context($request);
        return $ctx['role'] === 'SuperAdmin' ? null : $ctx['pays_ids'];
    }

    // Exige que l'utilisateur ait acces a ce pays (403 sinon).
    public static function requirePaysAccess(Request $request, int $paysId): void
    {
        $scope = self::scopedPaysIds($request);
        if ($scope === null) {
            return; // SuperAdmin
        }
        if (!in_array($paysId, $scope, true)) {
            Response::error('Acces refuse : ce pays est hors de votre perimetre.', 403);
        }
    }

    // Reserve aux SuperAdmin (creation de pays, utilisateurs, roles, droits).
    public static function requireSuperAdmin(Request $request): void
    {
        if (!self::isSuperAdmin($request)) {
            Response::error('Acces refuse : action reservee au SuperAdmin.', 403);
        }
    }

    // Les Commerciaux sont en lecture seule.
    public static function requireWrite(Request $request): void
    {
        if (self::context($request)['role'] === 'Commercial') {
            Response::error('Acces refuse : votre profil est en lecture seule.', 403);
        }
    }

    /**
     * Fragment SQL de restriction sur une colonne pays.
     * Vide pour un SuperAdmin ; " AND col IN (...)" sinon.
     */
    public static function paysScopeSql(Request $request, string $column): string
    {
        $scope = self::scopedPaysIds($request);
        if ($scope === null) {
            return '';
        }
        if (empty($scope)) {
            return ' AND 1 = 0'; // aucun pays attribue => aucun resultat
        }
        $ids = implode(',', array_map('intval', $scope));
        return " AND $column IN ($ids)";
    }

    // =================================================================
    // PORTEFEUILLE (VILLES) — specifique au role Commercial
    // =================================================================

    /**
     * Portefeuille de villes.
     * null  = aucune restriction de ville (SuperAdmin, Admin Pays)
     * int[] = villes du Commercial (peut etre vide)
     */
    public static function scopedVilleIds(Request $request): ?array
    {
        $ctx = self::context($request);
        return $ctx['role'] === 'Commercial' ? $ctx['ville_ids'] : null;
    }

    /**
     * Fragment SQL de restriction sur une colonne ville.
     * Ne s'applique qu'au Commercial : son perimetre est sa ville, et
     * selectionner une ville inclut d'office tous ses services.
     */
    public static function villeScopeSql(Request $request, string $column): string
    {
        $scope = self::scopedVilleIds($request);
        if ($scope === null) {
            return '';
        }
        if (empty($scope)) {
            return ' AND 1 = 0'; // portefeuille vide => aucun resultat
        }
        $ids = implode(',', array_map('intval', $scope));
        return " AND $column IN ($ids)";
    }

    // Exige que la ville soit dans le portefeuille (403 sinon).
    public static function requireVilleAccess(Request $request, int $villeId): void
    {
        $scope = self::scopedVilleIds($request);
        if ($scope === null) {
            return; // pas de restriction de ville pour ce role
        }
        if (!in_array($villeId, $scope, true)) {
            Response::error('Acces refuse : cette ville est hors de votre portefeuille.', 403);
        }
    }

    // Reserve au SuperAdmin ou a un Admin Pays (gestion des commerciaux).
    public static function requireAdmin(Request $request): void
    {
        $role = self::context($request)['role'];
        if ($role !== 'SuperAdmin' && $role !== 'Admin Pays') {
            Response::error('Acces refuse : action reservee aux administrateurs.', 403);
        }
    }
}
