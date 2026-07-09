<?php
// =====================================================================
// Controleur CRUD generique, configure par ressource.
// Utilise pour les tables "mecaniques" (pays, villes, services, ...).
// =====================================================================

class ResourceController
{
    /**
     * @param Model    $model
     * @param array    $filters   liste des query params autorises comme filtres d'egalite
     * @param string[] $required  colonnes obligatoires a la creation
     * @param bool     $paginate  active la pagination (?page=&per_page=)
     * @param string   $orderBy   tri SQL par defaut
     */
    public function __construct(
        private Model  $model,
        private array  $filters = [],
        private array  $required = [],
        private bool   $paginate = true,
        private ?string $orderBy = null
    ) {}

    public function index(Request $req): void
    {
        $filters = [];
        foreach ($this->filters as $f) {
            $val = $req->queryParam($f);
            if ($val !== null && $val !== '') {
                $filters[$f] = $val;
            }
        }

        if ($this->paginate) {
            $page    = max(1, (int) $req->queryParam('page', 1));
            $perPage = min(200, max(1, (int) $req->queryParam('per_page', 25)));
            $items   = $this->model->all($filters, $page, $perPage, $this->orderBy);
            $total   = $this->model->count($filters);
            Response::paginated($items, $total, $page, $perPage);
        }

        Response::ok($this->model->all($filters, null, 25, $this->orderBy));
    }

    public function show(Request $req, array $params): void
    {
        $row = $this->model->find($params['id']);
        if (!$row) {
            Response::error('Ressource introuvable.', 404);
        }
        Response::ok($row);
    }

    public function store(Request $req): void
    {
        $data = $req->body();
        $this->validateRequired($data);
        try {
            $created = $this->model->create($data);
        } catch (PDOException $e) {
            Response::error($this->friendlyDbError($e), 422);
        }
        Response::ok($created, 201);
    }

    public function update(Request $req, array $params): void
    {
        if (!$this->model->find($params['id'])) {
            Response::error('Ressource introuvable.', 404);
        }
        try {
            $updated = $this->model->update($params['id'], $req->body());
        } catch (PDOException $e) {
            Response::error($this->friendlyDbError($e), 422);
        }
        Response::ok($updated);
    }

    public function destroy(Request $req, array $params): void
    {
        if (!$this->model->find($params['id'])) {
            Response::error('Ressource introuvable.', 404);
        }
        try {
            $this->model->delete($params['id']);
        } catch (PDOException $e) {
            Response::error('Suppression impossible (ressource liee a d\'autres donnees).', 409);
        }
        Response::noContent();
    }

    private function validateRequired(array $data): void
    {
        $missing = [];
        foreach ($this->required as $field) {
            if (!isset($data[$field]) || $data[$field] === '') {
                $missing[] = $field;
            }
        }
        if ($missing) {
            Response::error('Champs obligatoires manquants.', 422, ['champs' => $missing]);
        }
    }

    private function friendlyDbError(PDOException $e): string
    {
        $code = $e->errorInfo[1] ?? 0;
        return match ($code) {
            1062    => 'Valeur en doublon : cette entree existe deja.',
            1452    => 'Reference invalide : un identifiant lie n\'existe pas.',
            default => 'Donnees invalides : ' . $e->getMessage(),
        };
    }
}
