<?php
// =====================================================================
// MamaGo API - Configuration
// =====================================================================

return [
    'db' => [
        'host'     => '127.0.0.1',
        'port'     => 3306,
        'database' => 'mamago',
        'username' => 'root',
        'password' => '',       // XAMPP default : root sans mot de passe
        'charset'  => 'utf8mb4',
    ],

    // Chemin de base de l'API sous Apache (adapter si deploiement different)
    'base_path' => '/mamago/api',

    // Origines autorisees pour le front React. '*' = toutes (pratique en dev).
    'cors_allowed_origins' => '*',

    // Cle secrete pour signer les jetons (a changer en production).
    'jwt_secret' => 'mamago-secret-key-change-me-in-prod',
    'jwt_ttl'    => 60 * 60 * 8, // 8 heures
];
