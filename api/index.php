<?php
// =====================================================================
// MamaGo API - Point d'entree unique (front controller)
// =====================================================================

declare(strict_types=1);

error_reporting(E_ALL);
ini_set('display_errors', '0'); // les erreurs sont renvoyees en JSON, pas en HTML

$config = require __DIR__ . '/config.php';

// --- Chargement des classes -----------------------------------------
foreach ([
    'core/Response.php', 'core/Database.php', 'core/Request.php',
    'core/Router.php', 'core/Auth.php', 'core/Model.php',
    'core/Period.php', 'core/SimplePdf.php',
    'controllers/ResourceController.php', 'controllers/AuthController.php',
    'controllers/DashboardController.php', 'controllers/StatsController.php',
    'controllers/PaysController.php', 'controllers/VillesController.php',
    'controllers/ClientsController.php', 'controllers/LivreursController.php',
    'controllers/CoursesController.php', 'controllers/PaiementsController.php',
    'controllers/UtilisateursController.php', 'controllers/RolesController.php',
    'controllers/ConnexionsController.php', 'controllers/RapportsController.php',
    'controllers/DemandesController.php',
] as $file) {
    require __DIR__ . '/' . $file;
}

// --- CORS (avant tout routage / auth) -------------------------------
$origin = $config['cors_allowed_origins'];
header('Access-Control-Allow-Origin: ' . $origin);
header('Access-Control-Allow-Methods: GET, POST, PUT, PATCH, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization, Accept, X-Requested-With');
header('Access-Control-Expose-Headers: Content-Disposition');
header('Access-Control-Max-Age: 86400');
if ($origin !== '*') {
    header('Vary: Origin');
}

// Reponse immediate a la requete preflight
if (($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'OPTIONS') {
    http_response_code(204);
    exit;
}

// --- Gestion globale des erreurs ------------------------------------
set_exception_handler(function (Throwable $e) {
    Response::error('Erreur serveur : ' . $e->getMessage(), 500);
});

// --- Bootstrap ------------------------------------------------------
Database::connect($config);
Auth::init($config);
$request = new Request($config['base_path']);
Auth::resolve($request);

// --- Garde d'authentification globale -------------------------------
// Toutes les routes exigent un jeton valide, sauf les routes publiques.
// C'est ce qui permet de cloisonner les donnees par pays (le perimetre
// est deduit du jeton).
$publicPaths = ['/', '/health', '/auth/login'];
if (!in_array($request->path, $publicPaths, true)) {
    Auth::requireAuth($request);
}

$router = new Router();

// Helper : route reservee au SuperAdmin
$su = fn (callable $h): callable => function (Request $req, array $params = []) use ($h) {
    Auth::requireSuperAdmin($req);
    $h($req, $params);
};

// =====================================================================
// ROUTES
// =====================================================================

// --- Public ---
$router->get('/', function () use ($config) {
    Response::ok([
        'api'      => 'MamaGo - Manager Word par pays',
        'version'  => '1.1',
        'base_url' => $config['base_path'],
        'docs'     => '/mamago/swagger/',
        'auth'     => 'Toutes les routes (hors /health et /auth/login) exigent un jeton Bearer.',
        'roles'    => [
            'SuperAdmin' => 'acces total',
            'Admin Pays' => 'lecture + ecriture sur ses pays uniquement',
            'Commercial' => 'lecture seule sur ses pays',
        ],
    ]);
});
$router->get('/health', fn () => Response::ok(['status' => 'ok', 'time' => date('c')]));

// --- Auth ---
$authCtrl = new AuthController();
$router->post('/auth/login', fn ($r) => $authCtrl->login($r));
$router->get('/auth/me',     fn ($r) => $authCtrl->me($r));

// --- Dashboard & stats (cloisonnes) ---
$dash  = new DashboardController();
$stats = new StatsController();
$router->get('/dashboard',       fn ($r) => $dash->index($r));
$router->get('/pays/{id}/stats', fn ($r, $p) => $stats->paysStats($r, $p));
$router->get('/stats/paiements', fn ($r) => $stats->paiements($r));
$router->get('/stats/evolution', fn ($r) => $stats->evolution($r));

// --- Pays (creation = SuperAdmin, avec provisionnement de l'admin) ---
$pays = new PaysController();
$router->get('/pays',         fn ($r) => $pays->index($r));
$router->get('/pays/{id}',    fn ($r, $p) => $pays->show($r, $p));
$router->get('/pays/{id}/admins', fn ($r, $p) => $pays->admins($r, $p));
$router->post('/pays',        fn ($r) => $pays->store($r));
$router->put('/pays/{id}',    fn ($r, $p) => $pays->update($r, $p));
$router->delete('/pays/{id}', fn ($r, $p) => $pays->destroy($r, $p));

// --- Villes (cloisonnees) ---
$villes = new VillesController();
$router->get('/villes',         fn ($r) => $villes->index($r));
$router->get('/villes/{id}',    fn ($r, $p) => $villes->show($r, $p));
$router->post('/villes',        fn ($r) => $villes->store($r));
$router->put('/villes/{id}',    fn ($r, $p) => $villes->update($r, $p));
$router->delete('/villes/{id}', fn ($r, $p) => $villes->destroy($r, $p));

// --- Services (referentiel global : ecriture SuperAdmin) ---
$services = new ResourceController(
    new Model('services', ['nom_service', 'description', 'actif'], ['id' => 'int', 'actif' => 'bool']),
    filters: ['actif'], required: ['nom_service'], paginate: false, orderBy: 'nom_service ASC'
);
$router->get('/services',         fn ($r) => $services->index($r));
$router->get('/services/{id}',    fn ($r, $p) => $services->show($r, $p));
$router->post('/services',        $su(fn ($r) => $services->store($r)));
$router->put('/services/{id}',    $su(fn ($r, $p) => $services->update($r, $p)));
$router->delete('/services/{id}', $su(fn ($r, $p) => $services->destroy($r, $p)));

// --- Donnees operationnelles (cloisonnees) ---
$clients = new ClientsController();
$router->get('/clients',         fn ($r) => $clients->index($r));
$router->get('/clients/{id}',    fn ($r, $p) => $clients->show($r, $p));
$router->post('/clients',        fn ($r) => $clients->store($r));
$router->put('/clients/{id}',    fn ($r, $p) => $clients->update($r, $p));
$router->delete('/clients/{id}', fn ($r, $p) => $clients->destroy($r, $p));

$livreurs = new LivreursController();
$router->get('/livreurs',         fn ($r) => $livreurs->index($r));
$router->get('/livreurs/{id}',    fn ($r, $p) => $livreurs->show($r, $p));
$router->post('/livreurs',        fn ($r) => $livreurs->store($r));
$router->put('/livreurs/{id}',    fn ($r, $p) => $livreurs->update($r, $p));
$router->delete('/livreurs/{id}', fn ($r, $p) => $livreurs->destroy($r, $p));

$courses = new CoursesController();
$router->get('/courses',         fn ($r) => $courses->index($r));
$router->get('/courses/{id}',    fn ($r, $p) => $courses->show($r, $p));
$router->post('/courses',        fn ($r) => $courses->store($r));
$router->put('/courses/{id}',    fn ($r, $p) => $courses->update($r, $p));
$router->delete('/courses/{id}', fn ($r, $p) => $courses->destroy($r, $p));

$paiements = new PaiementsController();
$router->get('/paiements',         fn ($r) => $paiements->index($r));
$router->get('/paiements/{id}',    fn ($r, $p) => $paiements->show($r, $p));
$router->post('/paiements',        fn ($r) => $paiements->store($r));
$router->put('/paiements/{id}',    fn ($r, $p) => $paiements->update($r, $p));
$router->delete('/paiements/{id}', fn ($r, $p) => $paiements->destroy($r, $p));

// --- Administration (SuperAdmin) ---
$roles = new RolesController();
$router->get('/roles',             fn ($r) => $roles->index($r));
$router->get('/roles/{id}',        fn ($r, $p) => $roles->show($r, $p));
$router->post('/roles',            fn ($r) => $roles->store($r));
$router->put('/roles/{id}',        fn ($r, $p) => $roles->update($r, $p));
$router->delete('/roles/{id}',     fn ($r, $p) => $roles->destroy($r, $p));
$router->put('/roles/{id}/droits', fn ($r, $p) => $roles->syncDroits($r, $p));

$droits = new ResourceController(
    new Model('droits_acces', ['libelle_droit', 'module_concerne'], ['id' => 'int']),
    filters: ['module_concerne'], required: ['libelle_droit', 'module_concerne'],
    paginate: false, orderBy: 'module_concerne ASC, libelle_droit ASC'
);
$router->get('/droits-acces',         $su(fn ($r) => $droits->index($r)));
$router->get('/droits-acces/{id}',    $su(fn ($r, $p) => $droits->show($r, $p)));
$router->post('/droits-acces',        $su(fn ($r) => $droits->store($r)));
$router->put('/droits-acces/{id}',    $su(fn ($r, $p) => $droits->update($r, $p)));
$router->delete('/droits-acces/{id}', $su(fn ($r, $p) => $droits->destroy($r, $p)));

// --- Demandes de compte commercial (Admin Pays -> validation SuperAdmin) ---
$demandes = new DemandesController();
$router->get('/demandes',               fn ($r) => $demandes->index($r));
$router->post('/demandes',              fn ($r) => $demandes->store($r));
$router->put('/demandes/{id}/valider',  fn ($r, $p) => $demandes->valider($r, $p));
$router->put('/demandes/{id}/refuser',  fn ($r, $p) => $demandes->refuser($r, $p));
$router->delete('/demandes/{id}',       fn ($r, $p) => $demandes->destroy($r, $p));

$users = new UtilisateursController();
$router->get('/utilisateurs',         fn ($r) => $users->index($r));
$router->get('/utilisateurs/{id}',    fn ($r, $p) => $users->show($r, $p));
$router->post('/utilisateurs',        fn ($r) => $users->store($r));
$router->put('/utilisateurs/{id}',    fn ($r, $p) => $users->update($r, $p));
$router->delete('/utilisateurs/{id}', fn ($r, $p) => $users->destroy($r, $p));

// --- Tracabilite (cloisonnee) ---
$connexions = new ConnexionsController();
$router->get('/connexions',  fn ($r) => $connexions->index($r));
$router->post('/connexions', fn ($r) => $connexions->store($r));

$rapports = new RapportsController();
$router->get('/rapports',        fn ($r) => $rapports->index($r));
$router->get('/rapports/export', fn ($r) => $rapports->export($r));

// =====================================================================
$router->dispatch($request);
