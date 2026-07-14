<?php
// =====================================================================
// Roles + droits d'acces (spec "Gestion profil : droit d'acces")
// =====================================================================

class RolesController
{
    // GET /roles  (avec le nombre de droits)
    public function index(Request $req): void
    {
        $rows = Database::pdo()->query(
            'SELECT r.*, COUNT(rd.droit_acces_id) AS nb_droits
             FROM roles r
             LEFT JOIN role_droit_acces rd ON rd.role_id = r.id
             GROUP BY r.id ORDER BY r.id'
        )->fetchAll();
        Response::ok(array_map(fn ($r) => [
            'id'           => (int) $r['id'],
            'libelle_role' => $r['libelle_role'],
            'nb_droits'    => (int) $r['nb_droits'],
            'created_at'   => $r['created_at'],
            'updated_at'   => $r['updated_at'],
        ], $rows));
    }

    // GET /roles/{id}  (avec la liste des droits)
    public function show(Request $req, array $params): void
    {
        $role = (new Model('roles'))->find($params['id']);
        if (!$role) {
            Response::error('Role introuvable.', 404);
        }
        $role['id'] = (int) $role['id'];
        $role['droits'] = $this->droitsOf($params['id']);
        Response::ok($role);
    }

    public function store(Request $req): void
    {
        Auth::requireSuperAdmin($req);
        if (empty($req->input('libelle_role'))) {
            Response::error('libelle_role requis.', 422);
        }
        try {
            $role = (new Model('roles', ['libelle_role']))->create($req->body());
        } catch (PDOException $e) {
            Response::error('Ce role existe deja.', 422);
        }
        $role['id'] = (int) $role['id'];
        Response::ok($role, 201);
    }

    public function update(Request $req, array $params): void
    {
        Auth::requireSuperAdmin($req);
        $model = new Model('roles', ['libelle_role']);
        if (!$model->find($params['id'])) {
            Response::error('Role introuvable.', 404);
        }
        Response::ok($model->update($params['id'], $req->body()));
    }

    public function destroy(Request $req, array $params): void
    {
        Auth::requireSuperAdmin($req);
        $model = new Model('roles');
        if (!$model->find($params['id'])) {
            Response::error('Role introuvable.', 404);
        }
        try {
            $model->delete($params['id']);
        } catch (PDOException $e) {
            Response::error('Role utilise par des utilisateurs : suppression impossible.', 409);
        }
        Response::noContent();
    }

    // PUT /roles/{id}/droits   body: { "droit_ids": [1,2,3] }
    public function syncDroits(Request $req, array $params): void
    {
        Auth::requireSuperAdmin($req);
        if (!(new Model('roles'))->find($params['id'])) {
            Response::error('Role introuvable.', 404);
        }
        $ids = $req->input('droit_ids', []);
        if (!is_array($ids)) {
            Response::error('droit_ids doit etre un tableau.', 422);
        }
        $pdo = Database::pdo();
        $pdo->prepare('DELETE FROM role_droit_acces WHERE role_id = ?')->execute([$params['id']]);
        $ins = $pdo->prepare('INSERT INTO role_droit_acces (role_id, droit_acces_id) VALUES (?, ?)');
        foreach ($ids as $did) {
            $ins->execute([$params['id'], (int) $did]);
        }
        Response::ok(['role_id' => (int) $params['id'], 'droits' => $this->droitsOf($params['id'])]);
    }

    private function droitsOf($roleId): array
    {
        $stmt = Database::pdo()->prepare(
            'SELECT d.* FROM droits_acces d
             JOIN role_droit_acces rd ON rd.droit_acces_id = d.id
             WHERE rd.role_id = ? ORDER BY d.module_concerne, d.libelle_droit'
        );
        $stmt->execute([$roleId]);
        return array_map(fn ($d) => [
            'id'              => (int) $d['id'],
            'libelle_droit'   => $d['libelle_droit'],
            'module_concerne' => $d['module_concerne'],
        ], $stmt->fetchAll());
    }
}
