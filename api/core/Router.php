<?php
// =====================================================================
// Routeur simple avec parametres nommes : /pays/{id}
// =====================================================================

class Router
{
    private array $routes = [];

    public function add(string $method, string $pattern, callable $handler): void
    {
        $this->routes[] = [
            'method'  => strtoupper($method),
            'regex'   => $this->compile($pattern),
            'handler' => $handler,
        ];
    }

    public function get(string $p, callable $h): void    { $this->add('GET', $p, $h); }
    public function post(string $p, callable $h): void   { $this->add('POST', $p, $h); }
    public function put(string $p, callable $h): void    { $this->add('PUT', $p, $h); }
    public function patch(string $p, callable $h): void  { $this->add('PATCH', $p, $h); }
    public function delete(string $p, callable $h): void { $this->add('DELETE', $p, $h); }

    // Transforme /pays/{id} en une regex avec groupes nommes.
    private function compile(string $pattern): string
    {
        $regex = preg_replace('#\{([a-zA-Z_][a-zA-Z0-9_]*)\}#', '(?P<$1>[^/]+)', $pattern);
        return '#^' . $regex . '$#';
    }

    public function dispatch(Request $request): void
    {
        $matchedPath = false;

        foreach ($this->routes as $route) {
            if (preg_match($route['regex'], $request->path, $matches)) {
                $matchedPath = true;
                if ($route['method'] === $request->method) {
                    $params = array_filter($matches, 'is_string', ARRAY_FILTER_USE_KEY);
                    call_user_func($route['handler'], $request, $params);
                    return;
                }
            }
        }

        if ($matchedPath) {
            Response::error('Methode non autorisee pour cette ressource.', 405);
        }
        Response::error('Ressource introuvable : ' . $request->path, 404);
    }
}
