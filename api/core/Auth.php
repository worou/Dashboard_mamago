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
}
