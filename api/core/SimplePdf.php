<?php
// =====================================================================
// Generateur PDF minimaliste et sans dependance (texte, une page A4).
// Suffisant pour un rapport de synthese. Pour des PDF riches, integrer
// une librairie type Dompdf/mPDF via Composer.
// =====================================================================

class SimplePdf
{
    private array $lines = [];

    public function line(string $text, int $size = 11): void
    {
        // Echappe les caracteres speciaux PDF et retire les accents non ASCII
        $text = str_replace(['\\', '(', ')'], ['\\\\', '\\(', '\\)'], $text);
        $this->lines[] = ['text' => $text, 'size' => $size];
    }

    public function blank(): void
    {
        $this->lines[] = ['text' => '', 'size' => 11];
    }

    public function output(): string
    {
        // Construit le flux de contenu (BT ... ET), curseur qui descend.
        $y = 800;
        $content = "BT /F1 11 Tf 40 $y Td\n";
        $first = true;
        foreach ($this->lines as $l) {
            $leading = $l['size'] + 6;
            if (!$first) {
                $content .= "0 -$leading Td\n";
            }
            $content .= '/F1 ' . $l['size'] . " Tf\n";
            $content .= '(' . $l['text'] . ") Tj\n";
            $first = false;
        }
        $content .= "ET";

        $objects = [];
        $objects[1] = "<< /Type /Catalog /Pages 2 0 R >>";
        $objects[2] = "<< /Type /Pages /Kids [3 0 R] /Count 1 >>";
        $objects[3] = "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] "
                    . "/Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>";
        $objects[4] = "<< /Length " . strlen($content) . " >>\nstream\n$content\nendstream";
        $objects[5] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>";

        $pdf   = "%PDF-1.4\n";
        $offsets = [];
        foreach ($objects as $num => $body) {
            $offsets[$num] = strlen($pdf);
            $pdf .= "$num 0 obj\n$body\nendobj\n";
        }
        $xrefPos = strlen($pdf);
        $count   = count($objects) + 1;
        $pdf .= "xref\n0 $count\n0000000000 65535 f \n";
        for ($i = 1; $i < $count; $i++) {
            $pdf .= sprintf("%010d 00000 n \n", $offsets[$i]);
        }
        $pdf .= "trailer\n<< /Size $count /Root 1 0 R >>\nstartxref\n$xrefPos\n%%EOF";

        return $pdf;
    }
}
