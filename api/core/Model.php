<?php
// =====================================================================
// Passerelle generique vers une table (CRUD + cast + timestamps).
// Evite de repeter le meme code pour chaque table de reference.
// =====================================================================

class Model
{
    public function __construct(
        private string $table,
        private array  $fillable = [],     // colonnes modifiables
        private array  $casts = [],        // ['montant' => 'float', 'actif' => 'bool']
        private bool   $timestamps = true, // gere created_at / updated_at
        private string $pk = 'id'
    ) {}

    private function db(): PDO
    {
        return Database::pdo();
    }

    // Applique les casts pour renvoyer des types JSON corrects (DECIMAL -> number).
    public function cast(?array $row): ?array
    {
        if ($row === null) {
            return null;
        }
        foreach ($this->casts as $col => $type) {
            if (!array_key_exists($col, $row) || $row[$col] === null) {
                continue;
            }
            $row[$col] = match ($type) {
                'int'   => (int) $row[$col],
                'float' => (float) $row[$col],
                'bool'  => (bool) $row[$col],
                default => $row[$col],
            };
        }
        return $row;
    }

    public function castMany(array $rows): array
    {
        return array_map(fn ($r) => $this->cast($r), $rows);
    }

    /**
     * Liste filtree + paginee.
     * $filters : ['ville_id' => 3, 'statut' => 'actif']  (egalite stricte)
     */
    public function all(array $filters = [], ?int $page = null, int $perPage = 25, string $orderBy = null): array
    {
        $where  = [];
        $params = [];
        foreach ($filters as $col => $value) {
            if ($value === null || $value === '') {
                continue;
            }
            $where[]        = "`$col` = :$col";
            $params[":$col"] = $value;
        }

        $sql = "SELECT * FROM `{$this->table}`";
        if ($where) {
            $sql .= ' WHERE ' . implode(' AND ', $where);
        }
        $sql .= ' ORDER BY ' . ($orderBy ?: "`{$this->pk}` DESC");

        if ($page !== null) {
            $offset = ($page - 1) * $perPage;
            $sql   .= " LIMIT $perPage OFFSET $offset";
        }

        $stmt = $this->db()->prepare($sql);
        $stmt->execute($params);
        return $this->castMany($stmt->fetchAll());
    }

    public function count(array $filters = []): int
    {
        $where  = [];
        $params = [];
        foreach ($filters as $col => $value) {
            if ($value === null || $value === '') {
                continue;
            }
            $where[]        = "`$col` = :$col";
            $params[":$col"] = $value;
        }
        $sql = "SELECT COUNT(*) FROM `{$this->table}`";
        if ($where) {
            $sql .= ' WHERE ' . implode(' AND ', $where);
        }
        $stmt = $this->db()->prepare($sql);
        $stmt->execute($params);
        return (int) $stmt->fetchColumn();
    }

    public function find($id): ?array
    {
        $stmt = $this->db()->prepare("SELECT * FROM `{$this->table}` WHERE `{$this->pk}` = ? LIMIT 1");
        $stmt->execute([$id]);
        $row = $stmt->fetch();
        return $row ? $this->cast($row) : null;
    }

    public function create(array $data): array
    {
        $data = $this->onlyFillable($data);
        if ($this->timestamps) {
            $data['created_at'] = date('Y-m-d H:i:s');
            $data['updated_at'] = date('Y-m-d H:i:s');
        }

        $cols   = array_keys($data);
        $place  = array_map(fn ($c) => ":$c", $cols);
        $sql    = "INSERT INTO `{$this->table}` (`" . implode('`,`', $cols) . "`) VALUES (" . implode(',', $place) . ")";
        $stmt   = $this->db()->prepare($sql);
        $stmt->execute($this->bindable($data));

        return $this->find($this->db()->lastInsertId());
    }

    public function update($id, array $data): ?array
    {
        $data = $this->onlyFillable($data);
        if (empty($data)) {
            return $this->find($id);
        }
        if ($this->timestamps) {
            $data['updated_at'] = date('Y-m-d H:i:s');
        }

        $set  = implode(', ', array_map(fn ($c) => "`$c` = :$c", array_keys($data)));
        $data['__id'] = $id;
        $sql  = "UPDATE `{$this->table}` SET $set WHERE `{$this->pk}` = :__id";
        $stmt = $this->db()->prepare($sql);
        $stmt->execute($this->bindable($data));

        return $this->find($id);
    }

    public function delete($id): bool
    {
        $stmt = $this->db()->prepare("DELETE FROM `{$this->table}` WHERE `{$this->pk}` = ?");
        $stmt->execute([$id]);
        return $stmt->rowCount() > 0;
    }

    private function onlyFillable(array $data): array
    {
        if (empty($this->fillable)) {
            return $data;
        }
        return array_intersect_key($data, array_flip($this->fillable));
    }

    // Normalise les booleens en 0/1 pour MySQL.
    private function bindable(array $data): array
    {
        $out = [];
        foreach ($data as $k => $v) {
            if (is_bool($v)) {
                $v = $v ? 1 : 0;
            }
            $out[":$k"] = $v;
        }
        return $out;
    }
}
