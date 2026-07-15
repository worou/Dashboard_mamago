<?php
// =====================================================================
// Demandes de creation de compte COMMERCIAL.
//
// Un Admin Pays ne peut pas creer un commercial directement : il soumet
// une demande, qu'un SuperAdmin valide ou refuse. Le compte n'existe
// qu'a la validation.
//
//   Admin Pays : POST /demandes           (soumettre)
//                GET  /demandes           (suivre les siennes)
//                DELETE /demandes/{id}    (annuler une demande en attente)
//   SuperAdmin : GET  /demandes           (toutes)
//                PUT  /demandes/{id}/valider
//                PUT  /demandes/{id}/refuser
// =====================================================================

class DemandesController
{
    // GET /demandes?statut=en_attente
    public function index(Request $req): void
    {
        $ctx = Auth::context($req);
        Auth::requireAdmin($req);   // SuperAdmin ou Admin Pays

        $where  = [];
        $params = [];

        // Un Admin Pays ne voit que ses propres demandes.
        if ($ctx['role'] !== 'SuperAdmin') {
            $where[]  = 'd.demandeur_id = ?';
            $params[] = $ctx['id'];
        }
        if ($s = $req->queryParam('statut')) {
            $where[]  = 'd.statut = ?';
            $params[] = $s;
        }
        $whereSql = $where ? ' WHERE ' . implode(' AND ', $where) : '';

        $stmt = Database::pdo()->prepare(
            "SELECT d.id, d.statut, d.nom, d.prenom, d.email, d.telephone,
                    d.motif_refus, d.date_traitement, d.created_at,
                    d.pays_id, p.nom_pays, d.ville_id, v.nom_ville,
                    d.demandeur_id, CONCAT(dem.prenom,' ',dem.nom) AS demandeur,
                    d.utilisateur_id
             FROM demandes_comptes d
             JOIN pays p          ON p.id = d.pays_id
             JOIN villes v        ON v.id = d.ville_id
             JOIN utilisateurs dem ON dem.id = d.demandeur_id
             $whereSql
             ORDER BY FIELD(d.statut,'en_attente','refusee','validee'), d.created_at DESC"
        );
        $stmt->execute($params);

        Response::ok(array_map(fn ($d) => [
            'id'              => (int) $d['id'],
            'statut'          => $d['statut'],
            'nom'             => $d['nom'],
            'prenom'          => $d['prenom'],
            'email'           => $d['email'],
            'telephone'       => $d['telephone'],
            'pays_id'         => (int) $d['pays_id'],
            'nom_pays'        => $d['nom_pays'],
            'ville_id'        => (int) $d['ville_id'],
            'nom_ville'       => $d['nom_ville'],   // le portefeuille demande
            'demandeur'       => $d['demandeur'],
            'motif_refus'     => $d['motif_refus'],
            'date_traitement' => $d['date_traitement'],
            'created_at'      => $d['created_at'],
            'utilisateur_id'  => $d['utilisateur_id'] !== null ? (int) $d['utilisateur_id'] : null,
        ], $stmt->fetchAll()));
    }

    /**
     * POST /demandes
     * Un Admin Pays demande la creation d'un commercial pour son pays.
     * Le portefeuille est une ville de son pays (tous ses services inclus).
     */
    public function store(Request $req): void
    {
        Auth::requireAdmin($req);
        $ctx = Auth::context($req);
        $b   = $req->body();

        foreach (['nom', 'prenom', 'email', 'mot_de_passe', 'ville_id'] as $f) {
            if (empty($b[$f])) {
                Response::error("Champ obligatoire manquant : $f", 422);
            }
        }

        // La ville doit exister et appartenir au perimetre du demandeur.
        $vs = Database::pdo()->prepare('SELECT pays_id FROM villes WHERE id = ?');
        $vs->execute([(int) $b['ville_id']]);
        $paysId = $vs->fetchColumn();
        if ($paysId === false) {
            Response::error('Ville introuvable.', 422);
        }
        Auth::requirePaysAccess($req, (int) $paysId);

        // Email deja pris (compte existant ou demande en attente) ?
        $ex = Database::pdo()->prepare('SELECT 1 FROM utilisateurs WHERE email = ? LIMIT 1');
        $ex->execute([$b['email']]);
        if ($ex->fetchColumn()) {
            Response::error('Un compte utilise deja cet email.', 422);
        }
        $ed = Database::pdo()->prepare(
            "SELECT 1 FROM demandes_comptes WHERE email = ? AND statut = 'en_attente' LIMIT 1"
        );
        $ed->execute([$b['email']]);
        if ($ed->fetchColumn()) {
            Response::error('Une demande en attente existe deja pour cet email.', 422);
        }

        $now = date('Y-m-d H:i:s');
        Database::pdo()->prepare(
            'INSERT INTO demandes_comptes
                (demandeur_id, pays_id, ville_id, nom, prenom, email, telephone,
                 mot_de_passe_hash, statut, created_at, updated_at)
             VALUES (?,?,?,?,?,?,?,?,?,?,?)'
        )->execute([
            $ctx['id'], (int) $paysId, (int) $b['ville_id'],
            $b['nom'], $b['prenom'], $b['email'], $b['telephone'] ?? null,
            password_hash($b['mot_de_passe'], PASSWORD_DEFAULT),
            'en_attente', $now, $now,
        ]);

        Response::ok([
            'id'      => (int) Database::pdo()->lastInsertId(),
            'statut'  => 'en_attente',
            'message' => 'Demande envoyee au SuperAdmin pour validation.',
        ], 201);
    }

    /**
     * PUT /demandes/{id}/valider  (SuperAdmin)
     * Cree le compte commercial et lui attribue son portefeuille.
     */
    public function valider(Request $req, array $params): void
    {
        Auth::requireSuperAdmin($req);
        $ctx = Auth::context($req);

        $d = $this->find($params['id']);
        if ($d['statut'] !== 'en_attente') {
            Response::error('Cette demande a deja ete traitee.', 409);
        }

        $pdo = Database::pdo();
        $now = date('Y-m-d H:i:s');
        $pdo->beginTransaction();

        try {
            $roleId = $pdo->query("SELECT id FROM roles WHERE libelle_role = 'Commercial' LIMIT 1")->fetchColumn();
            if (!$roleId) {
                throw new RuntimeException("Le role 'Commercial' n'existe pas.");
            }

            // 1. Le compte (le hash a ete conserve tel quel depuis la demande)
            $pdo->prepare(
                'INSERT INTO utilisateurs
                    (role_id, nom, prenom, email, telephone, mot_de_passe_hash,
                     theme_pref, couleur_pref, actif, created_at, updated_at)
                 VALUES (?,?,?,?,?,?,?,?,1,?,?)'
            )->execute([
                (int) $roleId, $d['nom'], $d['prenom'], $d['email'], $d['telephone'],
                $d['mot_de_passe_hash'], 'clair', 'vert', $now, $now,
            ]);
            $userId = (int) $pdo->lastInsertId();

            // 2. Son portefeuille : la ville (tous ses services sont inclus)
            $pdo->prepare('INSERT INTO utilisateur_ville (utilisateur_id, ville_id) VALUES (?,?)')
                ->execute([$userId, (int) $d['ville_id']]);

            // 3. Rattachement au pays (coherence avec les autres roles)
            $pdo->prepare('INSERT INTO utilisateur_pays (utilisateur_id, pays_id) VALUES (?,?)')
                ->execute([$userId, (int) $d['pays_id']]);

            // 4. Cloture de la demande
            $pdo->prepare(
                "UPDATE demandes_comptes
                 SET statut='validee', valideur_id=?, utilisateur_id=?, date_traitement=?, updated_at=?
                 WHERE id = ?"
            )->execute([$ctx['id'], $userId, $now, $now, $d['id']]);

            $pdo->commit();
        } catch (PDOException $e) {
            $pdo->rollBack();
            $msg = ($e->errorInfo[1] ?? 0) === 1062
                ? 'Cet email est deja utilise par un compte.'
                : 'Validation impossible : ' . $e->getMessage();
            Response::error($msg, 422);
        } catch (Throwable $e) {
            $pdo->rollBack();
            Response::error('Validation impossible : ' . $e->getMessage(), 500);
        }

        Response::ok([
            'statut'      => 'validee',
            'utilisateur' => [
                'id'     => $userId,
                'nom'    => $d['nom'],
                'prenom' => $d['prenom'],
                'email'  => $d['email'],
                'role'   => 'Commercial',
            ],
            'message' => 'Compte commercial cree et portefeuille attribue.',
        ]);
    }

    // PUT /demandes/{id}/refuser   body: { "motif": "..." }
    public function refuser(Request $req, array $params): void
    {
        Auth::requireSuperAdmin($req);
        $ctx = Auth::context($req);

        $d = $this->find($params['id']);
        if ($d['statut'] !== 'en_attente') {
            Response::error('Cette demande a deja ete traitee.', 409);
        }

        $now = date('Y-m-d H:i:s');
        Database::pdo()->prepare(
            "UPDATE demandes_comptes
             SET statut='refusee', motif_refus=?, valideur_id=?, date_traitement=?, updated_at=?
             WHERE id = ?"
        )->execute([
            $req->input('motif') ?: null, $ctx['id'], $now, $now, $d['id'],
        ]);

        Response::ok(['statut' => 'refusee', 'message' => 'Demande refusee.']);
    }

    // DELETE /demandes/{id} : l'Admin Pays annule sa demande en attente.
    public function destroy(Request $req, array $params): void
    {
        Auth::requireAdmin($req);
        $ctx = Auth::context($req);

        $d = $this->find($params['id']);
        if ($ctx['role'] !== 'SuperAdmin' && (int) $d['demandeur_id'] !== $ctx['id']) {
            Response::error('Acces refuse : cette demande ne vous appartient pas.', 403);
        }
        if ($d['statut'] !== 'en_attente') {
            Response::error('Seule une demande en attente peut etre annulee.', 409);
        }

        Database::pdo()->prepare('DELETE FROM demandes_comptes WHERE id = ?')->execute([$d['id']]);
        Response::noContent();
    }

    private function find($id): array
    {
        $stmt = Database::pdo()->prepare('SELECT * FROM demandes_comptes WHERE id = ?');
        $stmt->execute([$id]);
        $d = $stmt->fetch();
        if (!$d) {
            Response::error('Demande introuvable.', 404);
        }
        return $d;
    }
}
