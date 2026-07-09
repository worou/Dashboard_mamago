<?php
// =====================================================================
// Resolution des periodes pour les statistiques et l'evolution.
// =====================================================================

class Period
{
    public string $from;      // 'Y-m-d 00:00:00'
    public string $to;        // 'Y-m-d 23:59:59'
    public string $prevFrom;  // periode precedente de meme duree
    public string $prevTo;

    /**
     * Resout la periode depuis la requete :
     *   ?from=YYYY-MM-DD&to=YYYY-MM-DD   (prioritaire)
     *   ?periode=YYYY-MM                 (un mois donne)
     *   defaut : mois calendaire courant
     */
    public static function fromRequest(Request $req): self
    {
        $p    = new self();
        $from = $req->queryParam('from');
        $to   = $req->queryParam('to');
        $mois = $req->queryParam('periode');

        if ($mois && preg_match('/^\d{4}-\d{2}$/', $mois)) {
            $start = new DateTime($mois . '-01');
            $from  = $start->format('Y-m-d');
            $to    = $start->format('Y-m-t');
        }

        if (!$from || !$to) {
            $from = date('Y-m-01');
            $to   = date('Y-m-t');
        }

        $p->from = $from . ' 00:00:00';
        $p->to   = $to   . ' 23:59:59';

        // Periode precedente de meme duree (pour l'evolution)
        $d1     = new DateTime($from);
        $d2     = new DateTime($to);
        $days   = (int) $d1->diff($d2)->format('%a') + 1;
        $prevTo = (clone $d1)->modify('-1 day');
        $prevFr = (clone $prevTo)->modify('-' . ($days - 1) . ' day');

        $p->prevFrom = $prevFr->format('Y-m-d') . ' 00:00:00';
        $p->prevTo   = $prevTo->format('Y-m-d') . ' 23:59:59';

        return $p;
    }

    public static function evolution(float $current, float $previous): ?float
    {
        if ($previous == 0.0) {
            return $current > 0 ? 100.0 : null;
        }
        return round((($current - $previous) / $previous) * 100, 2);
    }

    // Derniers N mois (libelles 'YYYY-MM') du plus ancien au plus recent.
    public static function lastMonths(int $n): array
    {
        $months = [];
        for ($i = $n - 1; $i >= 0; $i--) {
            $months[] = (new DateTime("first day of -$i month"))->format('Y-m');
        }
        return $months;
    }
}
