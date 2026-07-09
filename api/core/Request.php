<?php
// =====================================================================
// Encapsule la requete HTTP entrante
// =====================================================================

class Request
{
    public string $method;
    public string $path;
    public array  $query;
    private ?array $body = null;

    public function __construct(string $basePath)
    {
        $this->method = strtoupper($_SERVER['REQUEST_METHOD'] ?? 'GET');
        $this->query  = $_GET;
        $this->path   = $this->resolvePath($basePath);
    }

    // Retire le prefixe (/mamago/api) de l'URI pour ne garder que la route.
    private function resolvePath(string $basePath): string
    {
        $uri = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH) ?? '/';
        $uri = rawurldecode($uri);

        $basePath = rtrim($basePath, '/');
        if ($basePath !== '' && str_starts_with($uri, $basePath)) {
            $uri = substr($uri, strlen($basePath));
        }

        $uri = '/' . trim($uri, '/');
        return $uri === '' ? '/' : $uri;
    }

    // Corps JSON decode (mis en cache).
    public function body(): array
    {
        if ($this->body === null) {
            $raw = file_get_contents('php://input');
            $decoded = json_decode($raw ?: '[]', true);
            $this->body = is_array($decoded) ? $decoded : [];
        }
        return $this->body;
    }

    public function input(string $key, $default = null)
    {
        $body = $this->body();
        return $body[$key] ?? $default;
    }

    public function queryParam(string $key, $default = null)
    {
        return $this->query[$key] ?? $default;
    }

    public function bearerToken(): ?string
    {
        // Apache retire parfois l'entete ou la prefixe (REDIRECT_) apres reecriture.
        $header = $_SERVER['HTTP_AUTHORIZATION']
            ?? $_SERVER['REDIRECT_HTTP_AUTHORIZATION']
            ?? '';
        if ($header === '' && function_exists('apache_request_headers')) {
            $headers = apache_request_headers();
            $header  = $headers['Authorization'] ?? $headers['authorization'] ?? '';
        }
        if (preg_match('/Bearer\s+(.+)/i', $header, $m)) {
            return trim($m[1]);
        }
        return null;
    }
}
