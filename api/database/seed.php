<?php
// =====================================================================
// MamaGo - Jeu de donnees de demonstration
// Usage : php api/database/seed.php
// Remplit toutes les tables avec des donnees realistes sur ~4 mois.
// =====================================================================

$config = require __DIR__ . '/../config.php';
$db = $config['db'];
$pdo = new PDO(
    "mysql:host={$db['host']};port={$db['port']};dbname={$db['database']};charset={$db['charset']}",
    $db['username'], $db['password'],
    [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]
);

mt_srand(20260709); // reproductible

echo "Nettoyage des tables...\n";
$pdo->exec('SET FOREIGN_KEY_CHECKS = 0');
foreach ([
    'paiements','courses','connexions','rapports','stats_ca_ville_service',
    'demandes_comptes','utilisateur_ville','utilisateur_pays','role_droit_acces',
    'clients','livreurs','villes','services','pays','utilisateurs','droits_acces','roles',
] as $t) {
    $pdo->exec("TRUNCATE TABLE `$t`");
}
$pdo->exec('SET FOREIGN_KEY_CHECKS = 1');

$now = date('Y-m-d H:i:s');

// --- Roles ---
echo "Roles...\n";
$roleIds = [];
foreach (['SuperAdmin', 'Admin Pays', 'Commercial'] as $lib) {
    $st = $pdo->prepare('INSERT INTO roles (libelle_role, created_at, updated_at) VALUES (?,?,?)');
    $st->execute([$lib, $now, $now]);
    $roleIds[$lib] = (int) $pdo->lastInsertId();
}

// --- Droits d'acces ---
echo "Droits d'acces...\n";
$droits = [
    ['voir_dashboard', 'Dashboard'],
    ['voir_stats', 'Stats'],
    ['exporter_rapport', 'Rapports'],
    ['gerer_utilisateurs', 'Utilisateurs'],
    ['gerer_pays', 'Pays'],
    ['voir_activites', 'Parametres'],
];
$droitIds = [];
foreach ($droits as [$lib, $mod]) {
    $st = $pdo->prepare('INSERT INTO droits_acces (libelle_droit, module_concerne, created_at, updated_at) VALUES (?,?,?,?)');
    $st->execute([$lib, $mod, $now, $now]);
    $droitIds[$lib] = (int) $pdo->lastInsertId();
}
$rd = $pdo->prepare('INSERT INTO role_droit_acces (role_id, droit_acces_id) VALUES (?,?)');
foreach ($droitIds as $id) { $rd->execute([$roleIds['SuperAdmin'], $id]); }
foreach (['voir_dashboard','voir_stats','exporter_rapport','voir_activites'] as $d) {
    $rd->execute([$roleIds['Admin Pays'], $droitIds[$d]]);
}
foreach (['voir_dashboard','voir_stats'] as $d) {
    $rd->execute([$roleIds['Commercial'], $droitIds[$d]]);
}

// --- Pays / villes ---
echo "Pays et villes...\n";
$paysDef = [
    ['Cote d\'Ivoire', 'CI', 'XOF', ['Abidjan', 'Bouake', 'Yamoussoukro']],
    ['Senegal',        'SN', 'XOF', ['Dakar', 'Thies']],
    ['France',         'FR', 'EUR', ['Paris', 'Lyon']],
];
$paysIds  = [];
$villeIds = [];        // [pays_id => [ville_id,...]]
foreach ($paysDef as [$nom, $iso, $dev, $villes]) {
    $st = $pdo->prepare('INSERT INTO pays (nom_pays, code_iso, devise, ca_global, created_at, updated_at) VALUES (?,?,?,0,?,?)');
    $st->execute([$nom, $iso, $dev, $now, $now]);
    $pid = (int) $pdo->lastInsertId();
    $paysIds[$nom] = $pid;
    $villeIds[$pid] = [];
    foreach ($villes as $v) {
        $st = $pdo->prepare('INSERT INTO villes (pays_id, nom_ville, created_at, updated_at) VALUES (?,?,?,?)');
        $st->execute([$pid, $v, $now, $now]);
        $villeIds[$pid][] = (int) $pdo->lastInsertId();
    }
}
$paysDevise = [];
foreach ($paysDef as [$nom, $iso, $dev]) { $paysDevise[$paysIds[$nom]] = $dev; }

// --- Services ---
echo "Services...\n";
$servDef = [
    ['VTC', 'Transport de personnes'],
    ['Livraison repas', 'Livraison de repas a domicile'],
    ['Livraison colis', 'Livraison de colis'],
];
$serviceIds = [];
foreach ($servDef as [$n, $d]) {
    $st = $pdo->prepare('INSERT INTO services (nom_service, description, actif, created_at, updated_at) VALUES (?,?,1,?,?)');
    $st->execute([$n, $d, $now, $now]);
    $serviceIds[$n] = (int) $pdo->lastInsertId();
}
// Fourchettes de montant par service (unite locale)
$montantRange = [
    $serviceIds['VTC']             => [1500, 8000],
    $serviceIds['Livraison repas'] => [1000, 6000],
    $serviceIds['Livraison colis'] => [2000, 15000],
];
// France en EUR : montants plus petits
$montantRangeEUR = [
    $serviceIds['VTC']             => [8, 45],
    $serviceIds['Livraison repas'] => [6, 35],
    $serviceIds['Livraison colis'] => [10, 90],
];

$prenoms = ['Awa','Kofi','Fatou','Yao','Aya','Ibrahim','Marie','Jean','Aminata','Paul','Sekou','Nadege','Ousmane','Clarisse','Moussa','Julie','Adama','Sophie','Kader','Lea'];
$noms    = ['Kouassi','Diallo','Traore','Ndiaye','Bamba','Coulibaly','Fofana','Sow','Kone','Yeo','Toure','Camara','Gueye','Ba','Cisse','Diop','Sarr','Ouattara','Dupont','Martin'];
$rname = fn () => [$prenoms[array_rand($prenoms)], $noms[array_rand($noms)]];

// --- Clients ---
echo "Clients...\n";
$clientsByVille = [];
$allVilleIds = array_merge(...array_values($villeIds));
$clientCount = 0;
foreach ($allVilleIds as $vid) {
    $n = mt_rand(6, 12);
    for ($i = 0; $i < $n; $i++) {
        [$p, $no] = $rname();
        $daysAgo = mt_rand(0, 180);
        $insc = date('Y-m-d', strtotime("-$daysAgo days"));
        $statut = $daysAgo < 20 ? 'nouveau' : (mt_rand(0, 9) < 8 ? 'actif' : 'inactif');
        $uid = uniqid();
        $st = $pdo->prepare(
            'INSERT INTO clients (ville_id, nom, prenom, email, telephone, date_inscription, statut, created_at, updated_at)
             VALUES (?,?,?,?,?,?,?,?,?)'
        );
        $st->execute([$vid, $no, $p, "client{$uid}@mail.test", '07' . mt_rand(10000000, 99999999), $insc, $statut, $now, $now]);
        $clientsByVille[$vid][] = (int) $pdo->lastInsertId();
        $clientCount++;
    }
}

// --- Livreurs ---
echo "Livreurs...\n";
$livreursByVille = [];
foreach ($allVilleIds as $vid) {
    $n = mt_rand(3, 6);
    for ($i = 0; $i < $n; $i++) {
        [$p, $no] = $rname();
        $note = round(mt_rand(350, 500) / 100, 2);
        $statut = mt_rand(0, 9) < 8 ? 'actif' : (mt_rand(0, 1) ? 'inactif' : 'suspendu');
        $st = $pdo->prepare(
            'INSERT INTO livreurs (ville_id, nom, prenom, telephone, note_moyenne, statut, created_at, updated_at)
             VALUES (?,?,?,?,?,?,?,?)'
        );
        $st->execute([$vid, $no, $p, '05' . mt_rand(10000000, 99999999), $note, $statut, $now, $now]);
        $livreursByVille[$vid][] = (int) $pdo->lastInsertId();
    }
}

// --- Courses + paiements (sur ~120 jours) ---
echo "Courses et paiements...\n";
$paiementTypes = ['mobile_money','mobile_money','mobile_money','especes','especes','carte','autre'];
$courseStatuts = ['terminee','terminee','terminee','terminee','terminee','terminee','terminee','terminee','annulee','en_cours'];
$nbCourses = 700;
for ($i = 0; $i < $nbCourses; $i++) {
    $vid = $allVilleIds[array_rand($allVilleIds)];
    // pays de la ville
    $pid = null;
    foreach ($villeIds as $p => $vs) { if (in_array($vid, $vs, true)) { $pid = $p; break; } }
    if (empty($clientsByVille[$vid])) { continue; }

    $clientId  = $clientsByVille[$vid][array_rand($clientsByVille[$vid])];
    $serviceId = array_values($serviceIds)[mt_rand(0, 2)];

    $statut = $courseStatuts[array_rand($courseStatuts)];
    $livreurId = null;
    if ($statut !== 'en_cours' && !empty($livreursByVille[$vid]) && mt_rand(0, 9) < 9) {
        $livreurId = $livreursByVille[$vid][array_rand($livreursByVille[$vid])];
    }

    $range = $paysDevise[$pid] === 'EUR' ? $montantRangeEUR[$serviceId] : $montantRange[$serviceId];
    $montant = $paysDevise[$pid] === 'EUR'
        ? round(mt_rand($range[0] * 100, $range[1] * 100) / 100, 2)
        : mt_rand($range[0], $range[1]);

    $daysAgo = mt_rand(0, 118);
    $h = mt_rand(6, 23); $m = mt_rand(0, 59);
    $dateCourse = date('Y-m-d', strtotime("-$daysAgo days")) . sprintf(' %02d:%02d:00', $h, $m);
    $duree = mt_rand(8, 75);

    $st = $pdo->prepare(
        'INSERT INTO courses (client_id, livreur_id, ville_id, service_id, date_course, montant, duree_minutes, statut, created_at, updated_at)
         VALUES (?,?,?,?,?,?,?,?,?,?)'
    );
    $st->execute([$clientId, $livreurId, $vid, $serviceId, $dateCourse, $montant, $duree, $statut, $dateCourse, $dateCourse]);
    $courseId = (int) $pdo->lastInsertId();

    // Paiement pour les courses terminees
    if ($statut === 'terminee') {
        $type = $paiementTypes[array_rand($paiementTypes)];
        $pst = mt_rand(0, 19) === 0 ? 'echoue' : 'valide';
        $st = $pdo->prepare(
            'INSERT INTO paiements (course_id, type_paiement, montant, statut, date_paiement, created_at, updated_at)
             VALUES (?,?,?,?,?,?,?)'
        );
        $st->execute([$courseId, $type, $montant, $pst, $dateCourse, $dateCourse, $dateCourse]);
    }
}

// --- Recalcul pays.ca_global (source : courses terminees) ---
echo "Calcul des CA...\n";
$pdo->exec(
    "UPDATE pays p SET ca_global = (
        SELECT COALESCE(SUM(co.montant),0)
        FROM courses co JOIN villes v ON v.id = co.ville_id
        WHERE v.pays_id = p.id AND co.statut = 'terminee'
    )"
);

// --- Remplissage stats_ca_ville_service (rollup mensuel) ---
$pdo->exec(
    "INSERT INTO stats_ca_ville_service
        (ville_id, service_id, periode, montant_ca, nb_courses, nb_clients, created_at, updated_at)
     SELECT co.ville_id, co.service_id,
            DATE_FORMAT(co.date_course, '%Y-%m-01') AS periode,
            SUM(co.montant), COUNT(*), COUNT(DISTINCT co.client_id),
            NOW(), NOW()
     FROM courses co
     WHERE co.statut = 'terminee'
     GROUP BY co.ville_id, co.service_id, DATE_FORMAT(co.date_course, '%Y-%m-01')"
);

// --- Utilisateurs ---
echo "Utilisateurs...\n";
$hash = password_hash('password', PASSWORD_DEFAULT);
// [role, nom, prenom, email, tel, pays geres, portefeuille (villes) pour un Commercial]
$usersDef = [
    ['SuperAdmin', 'Admin',   'Super',  'admin@mamago.com',      '+225 07 00 00 00 01', ['Cote d\'Ivoire','Senegal','France'], []],
    ['Admin Pays', 'Kouassi', 'Aya',    'ci.admin@mamago.com',   '+225 07 45 12 88 30', ['Cote d\'Ivoire'], []],
    // Commercial : son perimetre est sa VILLE (portefeuille), pas le pays.
    ['Commercial', 'Ndiaye',  'Moussa', 'commercial@mamago.com', '+221 77 512 44 09',   ['Senegal'], ['Dakar']],
];
foreach ($usersDef as [$role, $no, $pr, $email, $tel, $paysNoms, $villeNoms]) {
    $st = $pdo->prepare(
        'INSERT INTO utilisateurs (role_id, nom, prenom, email, telephone, mot_de_passe_hash, theme_pref, couleur_pref, actif, created_at, updated_at)
         VALUES (?,?,?,?,?,?,?,?,1,?,?)'
    );
    $st->execute([$roleIds[$role], $no, $pr, $email, $tel, $hash, 'clair', 'vert', $now, $now]);
    $uid = (int) $pdo->lastInsertId();
    foreach ($paysNoms as $pn) {
        $pdo->prepare('INSERT INTO utilisateur_pays (utilisateur_id, pays_id) VALUES (?,?)')
            ->execute([$uid, $paysIds[$pn]]);
    }
    // Portefeuille du commercial : la ville (tous ses services sont inclus)
    foreach ($villeNoms as $vn) {
        $vst = $pdo->prepare('SELECT id FROM villes WHERE nom_ville = ? LIMIT 1');
        $vst->execute([$vn]);
        if ($vid = $vst->fetchColumn()) {
            $pdo->prepare('INSERT INTO utilisateur_ville (utilisateur_id, ville_id) VALUES (?,?)')
                ->execute([$uid, (int) $vid]);
        }
    }
    // Quelques connexions
    for ($k = 0; $k < 5; $k++) {
        $d = date('Y-m-d H:i:s', strtotime('-' . mt_rand(0, 30) . ' days -' . mt_rand(0, 23) . ' hours'));
        $pdo->prepare(
            'INSERT INTO connexions (utilisateur_id, date_connexion, adresse_ip, duree_secondes, action, created_at)
             VALUES (?,?,?,?,?,?)'
        )->execute([$uid, $d, '192.168.1.' . mt_rand(2, 254), mt_rand(120, 3600),
                    ['connexion','export_rapport','modif_profil','consultation_stats'][array_rand([0,1,2,3])], $d]);
    }
}

// --- Recap ---
$count = fn ($t) => (int) $pdo->query("SELECT COUNT(*) FROM $t")->fetchColumn();
echo "\n=== Donnees inserees ===\n";
foreach (['pays','villes','services','clients','livreurs','courses','paiements','utilisateurs','connexions','stats_ca_ville_service'] as $t) {
    printf("  %-24s : %d\n", $t, $count($t));
}
echo "\nComptes de test (mot de passe : password) :\n";
echo "  admin@mamago.com       (SuperAdmin)\n";
echo "  ci.admin@mamago.com    (Admin Pays - Cote d'Ivoire)\n";
echo "  commercial@mamago.com  (Commercial - Senegal)\n";
echo "\nTermine.\n";
