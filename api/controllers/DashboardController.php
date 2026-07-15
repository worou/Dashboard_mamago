<?php
// =====================================================================
// Tableau de bord global (spec : CA global + liste pays avec CA/evolution)
// Source de verite du CA : courses.montant ou statut = 'terminee'.
// =====================================================================

class DashboardController
{
    public function index(Request $req): void
    {
        $pdo = Database::pdo();
        $p   = Period::fromRequest($req);

        // Cloisonnement : un Admin Pays ne voit que ses pays ;
        // un Commercial ne voit que les villes de son portefeuille.
        $sc = Auth::paysScopeSql($req, 'v.pays_id') . Auth::villeScopeSql($req, 'v.id');
        $sp = Auth::paysScopeSql($req, 'p.id');        // pour la table pays
        $vs = Auth::villeScopeSql($req, 'v.id');       // portefeuille du Commercial

        // --- Indicateurs (sur la periode, dans le perimetre) ---
        $caGlobal = (float) $this->scalar(
            "SELECT COALESCE(SUM(co.montant),0) FROM courses co JOIN villes v ON v.id = co.ville_id
             WHERE co.statut = 'terminee' AND co.date_course BETWEEN ? AND ? $sc",
            [$p->from, $p->to]
        );
        $caPrev = (float) $this->scalar(
            "SELECT COALESCE(SUM(co.montant),0) FROM courses co JOIN villes v ON v.id = co.ville_id
             WHERE co.statut = 'terminee' AND co.date_course BETWEEN ? AND ? $sc",
            [$p->prevFrom, $p->prevTo]
        );

        $totaux = [
            'ca_global'      => round($caGlobal, 2),
            'ca_precedent'   => round($caPrev, 2),
            'evolution_pct'  => Period::evolution($caGlobal, $caPrev),
            'nb_pays'        => (int) $this->scalar("SELECT COUNT(*) FROM pays p WHERE 1=1 $sp"),
            'nb_villes'      => (int) $this->scalar("SELECT COUNT(*) FROM villes v WHERE 1=1 $sc"),
            'nb_clients'     => (int) $this->scalar(
                "SELECT COUNT(*) FROM clients c JOIN villes v ON v.id = c.ville_id WHERE 1=1 $sc"
            ),
            'nb_livreurs'    => (int) $this->scalar(
                "SELECT COUNT(*) FROM livreurs l JOIN villes v ON v.id = l.ville_id WHERE 1=1 $sc"
            ),
            'nb_courses'     => (int) $this->scalar(
                "SELECT COUNT(*) FROM courses co JOIN villes v ON v.id = co.ville_id
                 WHERE co.statut='terminee' AND co.date_course BETWEEN ? AND ? $sc",
                [$p->from, $p->to]
            ),
        ];

        // --- CA + evolution par pays ---
        $stmt = $pdo->prepare(
            "SELECT
                p.id, p.nom_pays, p.code_iso, p.devise,
                COALESCE(cur.ca, 0)        AS ca,
                COALESCE(cur.nb_courses,0) AS nb_courses,
                COALESCE(prev.ca, 0)       AS ca_precedent,
                (SELECT COUNT(*) FROM clients c JOIN villes v ON v.id=c.ville_id WHERE v.pays_id=p.id $vs) AS nb_clients,
                (SELECT COUNT(*) FROM villes v WHERE v.pays_id=p.id $vs) AS nb_villes,
                (SELECT COUNT(*) FROM livreurs l JOIN villes v ON v.id=l.ville_id WHERE v.pays_id=p.id $vs) AS nb_livreurs
             FROM pays p
             LEFT JOIN (
                SELECT v.pays_id, SUM(co.montant) ca, COUNT(*) nb_courses
                FROM courses co JOIN villes v ON v.id = co.ville_id
                WHERE co.statut='terminee' AND co.date_course BETWEEN ? AND ? $vs
                GROUP BY v.pays_id
             ) cur  ON cur.pays_id  = p.id
             LEFT JOIN (
                SELECT v.pays_id, SUM(co.montant) ca
                FROM courses co JOIN villes v ON v.id = co.ville_id
                WHERE co.statut='terminee' AND co.date_course BETWEEN ? AND ? $vs
                GROUP BY v.pays_id
             ) prev ON prev.pays_id = p.id
             WHERE 1 = 1 $sp
             ORDER BY ca DESC"
        );
        $stmt->execute([$p->from, $p->to, $p->prevFrom, $p->prevTo]);

        $pays = array_map(function ($r) {
            $ca   = (float) $r['ca'];
            $prev = (float) $r['ca_precedent'];
            return [
                'id'            => (int) $r['id'],
                'nom_pays'      => $r['nom_pays'],
                'code_iso'      => $r['code_iso'],
                'devise'        => $r['devise'],
                'ca'            => round($ca, 2),
                'ca_precedent'  => round($prev, 2),
                'evolution_pct' => Period::evolution($ca, $prev),
                'nb_courses'    => (int) $r['nb_courses'],
                'nb_clients'    => (int) $r['nb_clients'],
                'nb_villes'     => (int) $r['nb_villes'],
                'nb_livreurs'   => (int) $r['nb_livreurs'],
            ];
        }, $stmt->fetchAll());

        Response::ok([
            'periode'  => ['from' => $p->from, 'to' => $p->to],
            'totaux'   => $totaux,
            'pays'     => $pays,
        ]);
    }

    private function scalar(string $sql, array $params = [])
    {
        $stmt = Database::pdo()->prepare($sql);
        $stmt->execute($params);
        return $stmt->fetchColumn();
    }
}
