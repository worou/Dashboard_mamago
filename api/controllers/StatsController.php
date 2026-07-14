<?php
// =====================================================================
// Statistiques par pays (spec "Stat par pays") :
//   1. CA par ville / service
//   2. Evolution clients (nouveaux, activite, duree)
//   3. Type de paiement
//   4. Livreurs (courses, note, evolution)
// =====================================================================

class StatsController
{
    // GET /pays/{id}/stats
    public function paysStats(Request $req, array $params): void
    {
        $pdo = Database::pdo();
        $paysId = (int) $params['id'];
        $p = Period::fromRequest($req);

        Auth::requirePaysAccess($req, $paysId);

        $pays = (new Model('pays', casts: ['id' => 'int', 'ca_global' => 'float']))->find($paysId);
        if (!$pays) {
            Response::error('Pays introuvable.', 404);
        }

        Response::ok([
            'pays'              => $pays,
            'periode'           => ['from' => $p->from, 'to' => $p->to],
            'ca_total'          => $this->caTotal($paysId, $p),
            'ca_par_ville'      => $this->caParVille($paysId, $p),
            'ca_par_service'    => $this->caParService($paysId, $p),
            'evolution_clients' => $this->evolutionClients($paysId, (int) $req->queryParam('months', 6)),
            'type_paiement'     => $this->typePaiement($paysId, $p),
            'livreurs'          => $this->livreurs($paysId, $p),
        ]);
    }

    private function caTotal(int $paysId, Period $p): float
    {
        $stmt = Database::pdo()->prepare(
            "SELECT COALESCE(SUM(co.montant),0)
             FROM courses co JOIN villes v ON v.id = co.ville_id
             WHERE v.pays_id = ? AND co.statut='terminee' AND co.date_course BETWEEN ? AND ?"
        );
        $stmt->execute([$paysId, $p->from, $p->to]);
        return round((float) $stmt->fetchColumn(), 2);
    }

    private function caParVille(int $paysId, Period $p): array
    {
        $stmt = Database::pdo()->prepare(
            "SELECT v.id AS ville_id, v.nom_ville,
                    COALESCE(SUM(co.montant),0) AS ca,
                    COUNT(co.id) AS nb_courses
             FROM villes v
             LEFT JOIN courses co
                    ON co.ville_id = v.id AND co.statut='terminee'
                   AND co.date_course BETWEEN ? AND ?
             WHERE v.pays_id = ?
             GROUP BY v.id, v.nom_ville
             ORDER BY ca DESC"
        );
        $stmt->execute([$p->from, $p->to, $paysId]);
        return array_map(fn ($r) => [
            'ville_id'   => (int) $r['ville_id'],
            'nom_ville'  => $r['nom_ville'],
            'ca'         => round((float) $r['ca'], 2),
            'nb_courses' => (int) $r['nb_courses'],
        ], $stmt->fetchAll());
    }

    private function caParService(int $paysId, Period $p): array
    {
        $stmt = Database::pdo()->prepare(
            "SELECT s.id AS service_id, s.nom_service,
                    COALESCE(SUM(co.montant),0) AS ca,
                    COUNT(co.id) AS nb_courses
             FROM services s
             LEFT JOIN courses co
                    ON co.service_id = s.id AND co.statut='terminee'
                   AND co.date_course BETWEEN ? AND ?
                   AND co.ville_id IN (SELECT id FROM villes WHERE pays_id = ?)
             GROUP BY s.id, s.nom_service
             HAVING nb_courses > 0 OR ca > 0
             ORDER BY ca DESC"
        );
        $stmt->execute([$p->from, $p->to, $paysId]);
        return array_map(fn ($r) => [
            'service_id' => (int) $r['service_id'],
            'nom_service'=> $r['nom_service'],
            'ca'         => round((float) $r['ca'], 2),
            'nb_courses' => (int) $r['nb_courses'],
        ], $stmt->fetchAll());
    }

    // Serie mensuelle : nouveaux clients, clients actifs, courses, duree moyenne.
    private function evolutionClients(int $paysId, int $months): array
    {
        $months = max(1, min(24, $months));
        $labels = Period::lastMonths($months);
        $pdo = Database::pdo();

        // Nouveaux clients par mois
        $nv = $pdo->prepare(
            "SELECT DATE_FORMAT(c.date_inscription,'%Y-%m') AS mois, COUNT(*) AS n
             FROM clients c JOIN villes v ON v.id = c.ville_id
             WHERE v.pays_id = ?
             GROUP BY mois"
        );
        $nv->execute([$paysId]);
        $nouveaux = array_column($nv->fetchAll(), 'n', 'mois');

        // Activite (courses + clients distincts + duree moyenne) par mois
        $ac = $pdo->prepare(
            "SELECT DATE_FORMAT(co.date_course,'%Y-%m') AS mois,
                    COUNT(*) AS nb_courses,
                    COUNT(DISTINCT co.client_id) AS clients_actifs,
                    ROUND(AVG(co.duree_minutes),1) AS duree_moy
             FROM courses co JOIN villes v ON v.id = co.ville_id
             WHERE v.pays_id = ? AND co.statut='terminee'
             GROUP BY mois"
        );
        $ac->execute([$paysId]);
        $activite = [];
        foreach ($ac->fetchAll() as $r) {
            $activite[$r['mois']] = $r;
        }

        return array_map(function ($mois) use ($nouveaux, $activite) {
            $a = $activite[$mois] ?? [];
            return [
                'mois'                 => $mois,
                'nouveaux_clients'     => (int) ($nouveaux[$mois] ?? 0),
                'clients_actifs'       => (int) ($a['clients_actifs'] ?? 0),
                'nb_courses'           => (int) ($a['nb_courses'] ?? 0),
                'duree_moyenne_minutes'=> $a['duree_moy'] !== null ? (float) ($a['duree_moy'] ?? 0) : 0.0,
            ];
        }, $labels);
    }

    private function typePaiement(int $paysId, Period $p): array
    {
        $stmt = Database::pdo()->prepare(
            "SELECT pa.type_paiement AS type,
                    COALESCE(SUM(pa.montant),0) AS montant,
                    COUNT(*) AS nb
             FROM paiements pa
             JOIN courses co ON co.id = pa.course_id
             JOIN villes v   ON v.id = co.ville_id
             WHERE v.pays_id = ? AND pa.statut='valide'
               AND pa.date_paiement BETWEEN ? AND ?
             GROUP BY pa.type_paiement
             ORDER BY montant DESC"
        );
        $stmt->execute([$paysId, $p->from, $p->to]);
        $rows  = $stmt->fetchAll();
        $total = array_sum(array_map(fn ($r) => (float) $r['montant'], $rows));

        return array_map(fn ($r) => [
            'type'    => $r['type'],
            'montant' => round((float) $r['montant'], 2),
            'nb'      => (int) $r['nb'],
            'pct'     => $total > 0 ? round((float) $r['montant'] / $total * 100, 2) : 0.0,
        ], $rows);
    }

    private function livreurs(int $paysId, Period $p): array
    {
        $stmt = Database::pdo()->prepare(
            "SELECT l.id, l.nom, l.prenom, l.note_moyenne, l.statut,
                    COALESCE(cur.nb, 0)  AS nb_courses,
                    COALESCE(cur.ca, 0)  AS ca,
                    COALESCE(prev.nb, 0) AS nb_courses_prec
             FROM livreurs l
             LEFT JOIN (
                SELECT livreur_id, COUNT(*) nb, SUM(montant) ca
                FROM courses WHERE statut='terminee' AND date_course BETWEEN ? AND ?
                GROUP BY livreur_id
             ) cur  ON cur.livreur_id  = l.id
             LEFT JOIN (
                SELECT livreur_id, COUNT(*) nb
                FROM courses WHERE statut='terminee' AND date_course BETWEEN ? AND ?
                GROUP BY livreur_id
             ) prev ON prev.livreur_id = l.id
             WHERE l.ville_id IN (SELECT id FROM villes WHERE pays_id = ?)
             ORDER BY nb_courses DESC, l.note_moyenne DESC"
        );
        $stmt->execute([$p->from, $p->to, $p->prevFrom, $p->prevTo, $paysId]);

        return array_map(function ($r) {
            $cur  = (int) $r['nb_courses'];
            $prev = (int) $r['nb_courses_prec'];
            return [
                'id'            => (int) $r['id'],
                'nom'           => $r['nom'],
                'prenom'        => $r['prenom'],
                'note_moyenne'  => (float) $r['note_moyenne'],
                'statut'        => $r['statut'],
                'nb_courses'    => $cur,
                'ca'            => round((float) $r['ca'], 2),
                'evolution_pct' => Period::evolution($cur, $prev),
            ];
        }, $stmt->fetchAll());
    }

    // GET /stats/evolution?months=12  (serie mensuelle du CA : global + par pays)
    public function evolution(Request $req): void
    {
        $months = max(1, min(24, (int) $req->queryParam('months', 12)));
        $labels = Period::lastMonths($months);
        $start  = $labels[0] . '-01 00:00:00';
        $pdo = Database::pdo();
        $sc  = Auth::paysScopeSql($req, 'v.pays_id');

        // Serie globale (dans le perimetre de l'utilisateur)
        $g = $pdo->prepare(
            "SELECT DATE_FORMAT(co.date_course,'%Y-%m') mois, SUM(co.montant) ca, COUNT(*) nb
             FROM courses co JOIN villes v ON v.id = co.ville_id
             WHERE co.statut='terminee' AND co.date_course >= ? $sc
             GROUP BY mois"
        );
        $g->execute([$start]);
        $gmap = [];
        foreach ($g->fetchAll() as $r) { $gmap[$r['mois']] = $r; }
        $global = array_map(fn ($m) => [
            'mois'       => $m,
            'ca'         => round((float) ($gmap[$m]['ca'] ?? 0), 2),
            'nb_courses' => (int) ($gmap[$m]['nb'] ?? 0),
        ], $labels);

        // Serie par pays (pour les sparklines)
        $p = $pdo->prepare(
            "SELECT v.pays_id, DATE_FORMAT(co.date_course,'%Y-%m') mois, SUM(co.montant) ca
             FROM courses co JOIN villes v ON v.id = co.ville_id
             WHERE co.statut='terminee' AND co.date_course >= ? $sc
             GROUP BY v.pays_id, mois"
        );
        $p->execute([$start]);
        $pmap = [];
        foreach ($p->fetchAll() as $r) { $pmap[(int) $r['pays_id']][$r['mois']] = (float) $r['ca']; }
        $parPays = [];
        foreach ($pmap as $pid => $byMonth) {
            $parPays[(string) $pid] = array_map(fn ($m) => round($byMonth[$m] ?? 0, 2), $labels);
        }

        Response::ok(['labels' => $labels, 'global' => $global, 'par_pays' => $parPays]);
    }

    // GET /stats/paiements  (repartition globale ou par pays)
    public function paiements(Request $req): void
    {
        $p       = Period::fromRequest($req);
        $paysId  = $req->queryParam('pays_id');
        $scope   = Auth::paysScopeSql($req, 'v.pays_id');
        $sql = "SELECT pa.type_paiement AS type,
                       COALESCE(SUM(pa.montant),0) AS montant, COUNT(*) AS nb
                FROM paiements pa
                JOIN courses co ON co.id = pa.course_id
                JOIN villes v   ON v.id = co.ville_id
                WHERE pa.statut='valide' AND pa.date_paiement BETWEEN ? AND ? $scope";
        $args = [$p->from, $p->to];
        if ($paysId) {
            Auth::requirePaysAccess($req, (int) $paysId);
            $sql   .= ' AND v.pays_id = ?';
            $args[] = $paysId;
        }
        $sql .= ' GROUP BY pa.type_paiement ORDER BY montant DESC';

        $stmt = Database::pdo()->prepare($sql);
        $stmt->execute($args);
        $rows  = $stmt->fetchAll();
        $total = array_sum(array_map(fn ($r) => (float) $r['montant'], $rows));

        Response::ok([
            'periode' => ['from' => $p->from, 'to' => $p->to],
            'total'   => round($total, 2),
            'types'   => array_map(fn ($r) => [
                'type'    => $r['type'],
                'montant' => round((float) $r['montant'], 2),
                'nb'      => (int) $r['nb'],
                'pct'     => $total > 0 ? round((float) $r['montant'] / $total * 100, 2) : 0.0,
            ], $rows),
        ]);
    }
}
