<?php
// =====================================================================
// Rapports : historique + export CSV / PDF (spec "Rapport, export csv, pdf")
// =====================================================================

class RapportsController
{
    // GET /rapports
    public function index(Request $req): void
    {
        $sql    = 'SELECT r.*, u.nom AS user_nom, u.prenom AS user_prenom, p.nom_pays
                   FROM rapports r
                   JOIN utilisateurs u ON u.id = r.utilisateur_id
                   JOIN pays p ON p.id = r.pays_id';
        $where  = [];
        $params = [];
        if ($pid = $req->queryParam('pays_id')) {
            Auth::requirePaysAccess($req, (int) $pid);
            $where[] = 'r.pays_id = ?';
            $params[] = $pid;
        }
        if ($uid = $req->queryParam('utilisateur_id')) {
            $where[] = 'r.utilisateur_id = ?';
            $params[] = $uid;
        }
        $scope = Auth::paysScopeSql($req, 'r.pays_id');
        $sql .= ' WHERE 1 = 1' . $scope . ($where ? ' AND ' . implode(' AND ', $where) : '');
        $sql .= ' ORDER BY r.date_generation DESC';

        $stmt = Database::pdo()->prepare($sql);
        $stmt->execute($params);
        Response::ok($stmt->fetchAll());
    }

    // GET /rapports/export?pays_id=&type=csv|pdf&from=&to=
    public function export(Request $req): void
    {
        $paysId = (int) $req->queryParam('pays_id', 0);
        $type   = strtolower((string) $req->queryParam('type', 'csv'));
        $p      = Period::fromRequest($req);

        if (!$paysId) {
            Response::error('Parametre pays_id requis.', 422);
        }
        if (!in_array($type, ['csv', 'pdf'], true)) {
            Response::error("Type d'export invalide (csv ou pdf).", 422);
        }
        Auth::requirePaysAccess($req, $paysId);

        $pays = (new Model('pays'))->find($paysId);
        if (!$pays) {
            Response::error('Pays introuvable.', 404);
        }

        // Lignes de courses de la periode (limitees au portefeuille pour un Commercial)
        $vs = Auth::villeScopeSql($req, 'v.id');
        $stmt = Database::pdo()->prepare(
            "SELECT co.id, co.date_course, v.nom_ville, s.nom_service,
                    CONCAT(cl.prenom,' ',cl.nom) AS client,
                    CONCAT(COALESCE(li.prenom,''),' ',COALESCE(li.nom,'')) AS livreur,
                    co.montant, co.duree_minutes, co.statut
             FROM courses co
             JOIN villes v    ON v.id = co.ville_id
             JOIN services s  ON s.id = co.service_id
             JOIN clients cl  ON cl.id = co.client_id
             LEFT JOIN livreurs li ON li.id = co.livreur_id
             WHERE v.pays_id = ? AND co.date_course BETWEEN ? AND ? $vs
             ORDER BY co.date_course DESC"
        );
        $stmt->execute([$paysId, $p->from, $p->to]);
        $rows = $stmt->fetchAll();

        $this->logRapport($req, $paysId, $type, $p);

        if ($type === 'csv') {
            $this->streamCsv($pays, $p, $rows);
        }
        $this->streamPdf($pays, $p, $rows);
    }

    private function streamCsv(array $pays, Period $p, array $rows): void
    {
        $filename = sprintf('rapport_%s_%s.csv', $this->slug($pays['nom_pays']), date('Ymd_His'));
        header('Content-Type: text/csv; charset=utf-8');
        header("Content-Disposition: attachment; filename=\"$filename\"");

        $out = fopen('php://output', 'w');
        fprintf($out, "\xEF\xBB\xBF"); // BOM UTF-8 pour Excel
        fputcsv($out, ['Rapport MamaGo -', $pays['nom_pays'], 'du', $p->from, 'au', $p->to]);
        fputcsv($out, []);
        fputcsv($out, ['ID', 'Date', 'Ville', 'Service', 'Client', 'Livreur', 'Montant', 'Duree (min)', 'Statut']);
        $total = 0.0;
        foreach ($rows as $r) {
            fputcsv($out, [
                $r['id'], $r['date_course'], $r['nom_ville'], $r['nom_service'],
                trim($r['client']), trim($r['livreur']), $r['montant'], $r['duree_minutes'], $r['statut'],
            ]);
            if ($r['statut'] === 'terminee') {
                $total += (float) $r['montant'];
            }
        }
        fputcsv($out, []);
        fputcsv($out, ['', '', '', '', '', 'CA total (terminees)', number_format($total, 2, '.', '')]);
        fclose($out);
        exit;
    }

    private function streamPdf(array $pays, Period $p, array $rows): void
    {
        $pdf = new SimplePdf();
        $pdf->line('MamaGo - Rapport de synthese', 18);
        $pdf->blank();
        $pdf->line('Pays    : ' . $this->ascii($pays['nom_pays']), 12);
        $pdf->line('Periode : ' . $p->from . '  au  ' . $p->to, 12);
        $pdf->line('Genere  : ' . date('Y-m-d H:i'), 12);
        $pdf->blank();

        $total = 0.0;
        $nbTerm = 0;
        foreach ($rows as $r) {
            if ($r['statut'] === 'terminee') {
                $total += (float) $r['montant'];
                $nbTerm++;
            }
        }
        $pdf->line('Nombre de courses (periode) : ' . count($rows), 12);
        $pdf->line('Courses terminees           : ' . $nbTerm, 12);
        $pdf->line('CA total (terminees)        : ' . number_format($total, 2, '.', ' ') . ' ' . $pays['devise'], 12);
        $pdf->blank();
        $pdf->line('Dernieres courses :', 12);
        foreach (array_slice($rows, 0, 25) as $r) {
            $pdf->line(sprintf(
                '- %s | %s | %s | %s %s',
                substr($r['date_course'], 0, 16),
                $this->ascii($r['nom_ville']),
                $this->ascii($r['nom_service']),
                number_format((float) $r['montant'], 0, '.', ' '),
                $pays['devise']
            ), 9);
        }

        $filename = sprintf('rapport_%s_%s.pdf', $this->slug($pays['nom_pays']), date('Ymd_His'));
        header('Content-Type: application/pdf');
        header("Content-Disposition: attachment; filename=\"$filename\"");
        echo $pdf->output();
        exit;
    }

    private function logRapport(Request $req, int $paysId, string $type, Period $p): void
    {
        $payload = Auth::currentUser() ?? Auth::resolve($req);
        // A defaut d'utilisateur authentifie, on rattache au 1er SuperAdmin.
        $uid = $payload['sub'] ?? Database::pdo()->query(
            'SELECT id FROM utilisateurs ORDER BY id LIMIT 1'
        )->fetchColumn();
        if (!$uid) {
            return; // aucun utilisateur en base, on ne trace pas
        }
        $now = date('Y-m-d H:i:s');
        Database::pdo()->prepare(
            'INSERT INTO rapports (utilisateur_id, pays_id, type_export, periode_couverte, date_generation, created_at)
             VALUES (?,?,?,?,?,?)'
        )->execute([$uid, $paysId, $type, substr($p->from, 0, 10) . ' / ' . substr($p->to, 0, 10), $now, $now]);
    }

    private function slug(string $s): string
    {
        $s = $this->ascii($s);
        return preg_replace('/[^a-zA-Z0-9]+/', '_', strtolower($s));
    }

    private function ascii(string $s): string
    {
        $t = @iconv('UTF-8', 'ASCII//TRANSLIT', $s);
        return $t !== false ? $t : $s;
    }
}
