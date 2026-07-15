-- =====================================================================
-- MamaGo - Modele Physique de Donnees (MPD)
-- Module Administration "Manager Word par pays"
-- SGBD cible : MySQL 8 / MariaDB 10.4+ - moteur InnoDB - charset utf8mb4
-- Conventions : tables au pluriel, snake_case (compatible Laravel/Eloquent)
-- Date : 8 juillet 2026 - Version 1.0
-- =====================================================================

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- ---------------------------------------------------------------------
-- 1. REFERENTIEL GEOGRAPHIQUE
-- ---------------------------------------------------------------------

CREATE TABLE pays (
    id              BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    nom_pays        VARCHAR(100)    NOT NULL,
    code_iso        CHAR(2)         NULL,               -- ex: CI, SN, FR
    devise          VARCHAR(10)     NOT NULL DEFAULT 'XOF',
    ca_global       DECIMAL(14,2)   NOT NULL DEFAULT 0.00,
    created_at      DATETIME        NULL,
    updated_at      DATETIME        NULL,
    UNIQUE KEY uq_pays_nom (nom_pays)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE villes (
    id              BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    pays_id         BIGINT UNSIGNED NOT NULL,
    nom_ville       VARCHAR(100)    NOT NULL,
    created_at      DATETIME        NULL,
    updated_at      DATETIME        NULL,
    CONSTRAINT fk_villes_pays FOREIGN KEY (pays_id)
        REFERENCES pays(id) ON DELETE CASCADE ON UPDATE CASCADE,
    KEY idx_villes_pays (pays_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE services (
    id              BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    nom_service     VARCHAR(100)    NOT NULL,           -- ex: VTC, Livraison colis, Livraison repas
    description     VARCHAR(255)    NULL,
    actif           TINYINT(1)      NOT NULL DEFAULT 1,
    created_at      DATETIME        NULL,
    updated_at      DATETIME        NULL,
    UNIQUE KEY uq_services_nom (nom_service)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Table de statistiques CA par ville / service / periode (issue de la
-- relation many-to-many "VILLE <-> SERVICE" du MCD)
CREATE TABLE stats_ca_ville_service (
    id              BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    ville_id        BIGINT UNSIGNED NOT NULL,
    service_id      BIGINT UNSIGNED NOT NULL,
    periode         DATE            NOT NULL,           -- ex: 1er jour du mois concerne
    montant_ca      DECIMAL(14,2)   NOT NULL DEFAULT 0.00,
    nb_courses      INT UNSIGNED    NOT NULL DEFAULT 0,
    nb_clients      INT UNSIGNED    NOT NULL DEFAULT 0,
    created_at      DATETIME        NULL,
    updated_at      DATETIME        NULL,
    CONSTRAINT fk_stats_ville FOREIGN KEY (ville_id)
        REFERENCES villes(id) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_stats_service FOREIGN KEY (service_id)
        REFERENCES services(id) ON DELETE CASCADE ON UPDATE CASCADE,
    UNIQUE KEY uq_stats_ville_service_periode (ville_id, service_id, periode),
    KEY idx_stats_periode (periode)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ---------------------------------------------------------------------
-- 2. CLIENTS / LIVREURS / COURSES / PAIEMENTS
-- ---------------------------------------------------------------------

CREATE TABLE clients (
    id                  BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    ville_id            BIGINT UNSIGNED NOT NULL,
    nom                 VARCHAR(100)    NOT NULL,
    prenom              VARCHAR(100)    NOT NULL,
    email               VARCHAR(150)    NULL,
    telephone           VARCHAR(20)     NULL,
    date_inscription    DATE            NOT NULL,
    statut              ENUM('nouveau','actif','inactif') NOT NULL DEFAULT 'nouveau',
    created_at          DATETIME        NULL,
    updated_at          DATETIME        NULL,
    CONSTRAINT fk_clients_ville FOREIGN KEY (ville_id)
        REFERENCES villes(id) ON DELETE RESTRICT ON UPDATE CASCADE,
    UNIQUE KEY uq_clients_email (email),
    UNIQUE KEY uq_clients_telephone (telephone),
    KEY idx_clients_ville (ville_id),
    KEY idx_clients_statut (statut)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE livreurs (
    id              BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    ville_id        BIGINT UNSIGNED NOT NULL,
    nom             VARCHAR(100)    NOT NULL,
    prenom          VARCHAR(100)    NOT NULL,
    telephone       VARCHAR(20)     NULL,
    note_moyenne    DECIMAL(3,2)    NOT NULL DEFAULT 0.00,   -- ex: 4.85 / 5
    statut          ENUM('actif','inactif','suspendu') NOT NULL DEFAULT 'actif',
    created_at      DATETIME        NULL,
    updated_at      DATETIME        NULL,
    CONSTRAINT fk_livreurs_ville FOREIGN KEY (ville_id)
        REFERENCES villes(id) ON DELETE RESTRICT ON UPDATE CASCADE,
    UNIQUE KEY uq_livreurs_telephone (telephone),
    KEY idx_livreurs_ville (ville_id),
    KEY idx_livreurs_statut (statut)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE courses (
    id              BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    client_id       BIGINT UNSIGNED NOT NULL,
    livreur_id      BIGINT UNSIGNED NULL,                -- NULL tant que non attribuee
    ville_id        BIGINT UNSIGNED NOT NULL,
    service_id      BIGINT UNSIGNED NOT NULL,
    date_course     DATETIME        NOT NULL,
    montant         DECIMAL(10,2)   NOT NULL DEFAULT 0.00,
    duree_minutes   INT UNSIGNED    NULL,
    statut          ENUM('en_attente','en_cours','terminee','annulee') NOT NULL DEFAULT 'en_attente',
    created_at      DATETIME        NULL,
    updated_at      DATETIME        NULL,
    CONSTRAINT fk_courses_client FOREIGN KEY (client_id)
        REFERENCES clients(id) ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT fk_courses_livreur FOREIGN KEY (livreur_id)
        REFERENCES livreurs(id) ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT fk_courses_ville FOREIGN KEY (ville_id)
        REFERENCES villes(id) ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT fk_courses_service FOREIGN KEY (service_id)
        REFERENCES services(id) ON DELETE RESTRICT ON UPDATE CASCADE,
    KEY idx_courses_client (client_id),
    KEY idx_courses_livreur (livreur_id),
    KEY idx_courses_ville (ville_id),
    KEY idx_courses_service (service_id),
    KEY idx_courses_date (date_course),
    KEY idx_courses_statut (statut)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE paiements (
    id              BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    course_id       BIGINT UNSIGNED NOT NULL,
    type_paiement   ENUM('carte','especes','mobile_money','autre') NOT NULL,
    montant         DECIMAL(10,2)   NOT NULL,
    statut          ENUM('en_attente','valide','echoue','rembourse') NOT NULL DEFAULT 'en_attente',
    date_paiement   DATETIME        NOT NULL,
    created_at      DATETIME        NULL,
    updated_at      DATETIME        NULL,
    CONSTRAINT fk_paiements_course FOREIGN KEY (course_id)
        REFERENCES courses(id) ON DELETE CASCADE ON UPDATE CASCADE,
    UNIQUE KEY uq_paiements_course (course_id),          -- 1 course = 1 paiement
    KEY idx_paiements_type (type_paiement),
    KEY idx_paiements_date (date_paiement)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ---------------------------------------------------------------------
-- 3. ADMINISTRATION : UTILISATEURS, ROLES, DROITS
-- ---------------------------------------------------------------------

CREATE TABLE roles (
    id              BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    libelle_role    VARCHAR(50)     NOT NULL,           -- SuperAdmin, Admin Pays, Commercial
    created_at      DATETIME        NULL,
    updated_at      DATETIME        NULL,
    UNIQUE KEY uq_roles_libelle (libelle_role)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE droits_acces (
    id              BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    libelle_droit   VARCHAR(100)    NOT NULL,           -- ex: voir_dashboard, exporter_rapport
    module_concerne VARCHAR(100)    NOT NULL,           -- ex: Dashboard, Utilisateurs, Stats
    created_at      DATETIME        NULL,
    updated_at      DATETIME        NULL,
    UNIQUE KEY uq_droits_libelle (libelle_droit)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Pivot many-to-many ROLE <-> DROITS_ACCES
CREATE TABLE role_droit_acces (
    role_id         BIGINT UNSIGNED NOT NULL,
    droit_acces_id  BIGINT UNSIGNED NOT NULL,
    PRIMARY KEY (role_id, droit_acces_id),
    CONSTRAINT fk_rd_role FOREIGN KEY (role_id)
        REFERENCES roles(id) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_rd_droit FOREIGN KEY (droit_acces_id)
        REFERENCES droits_acces(id) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE utilisateurs (
    id                  BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    role_id             BIGINT UNSIGNED NOT NULL,
    nom                 VARCHAR(100)    NOT NULL,
    prenom              VARCHAR(100)    NOT NULL,
    email               VARCHAR(150)    NOT NULL,
    telephone           VARCHAR(20)     NULL,               -- coordonnees du responsable
    mot_de_passe_hash   VARCHAR(255)    NOT NULL,
    theme_pref          ENUM('clair','sombre') NOT NULL DEFAULT 'clair',
    couleur_pref        ENUM('noir','vert') NOT NULL DEFAULT 'vert',
    actif               TINYINT(1)      NOT NULL DEFAULT 1,
    derniere_connexion  DATETIME        NULL,
    created_at          DATETIME        NULL,
    updated_at          DATETIME        NULL,
    CONSTRAINT fk_utilisateurs_role FOREIGN KEY (role_id)
        REFERENCES roles(id) ON DELETE RESTRICT ON UPDATE CASCADE,
    UNIQUE KEY uq_utilisateurs_email (email),
    KEY idx_utilisateurs_role (role_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Pivot many-to-many UTILISATEUR <-> PAYS (perimetre de gestion d'un Admin Pays)
CREATE TABLE utilisateur_pays (
    utilisateur_id  BIGINT UNSIGNED NOT NULL,
    pays_id         BIGINT UNSIGNED NOT NULL,
    PRIMARY KEY (utilisateur_id, pays_id),
    CONSTRAINT fk_up_utilisateur FOREIGN KEY (utilisateur_id)
        REFERENCES utilisateurs(id) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_up_pays FOREIGN KEY (pays_id)
        REFERENCES pays(id) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Portefeuille d'un COMMERCIAL : la ou les ville(s) qui lui sont attribuees.
-- Selectionner une ville implique tous ses services (restaurant, shopping, ...).
CREATE TABLE utilisateur_ville (
    utilisateur_id  BIGINT UNSIGNED NOT NULL,
    ville_id        BIGINT UNSIGNED NOT NULL,
    PRIMARY KEY (utilisateur_id, ville_id),
    CONSTRAINT fk_uv_utilisateur FOREIGN KEY (utilisateur_id)
        REFERENCES utilisateurs(id) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_uv_ville FOREIGN KEY (ville_id)
        REFERENCES villes(id) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Demandes de creation de compte COMMERCIAL :
-- un Admin Pays soumet la demande, un SuperAdmin valide ou refuse.
-- Le compte n'est cree qu'a la validation.
CREATE TABLE demandes_comptes (
    id                  BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    demandeur_id        BIGINT UNSIGNED NOT NULL,          -- l'Admin Pays
    pays_id             BIGINT UNSIGNED NOT NULL,
    ville_id            BIGINT UNSIGNED NOT NULL,          -- portefeuille demande
    nom                 VARCHAR(100)    NOT NULL,
    prenom              VARCHAR(100)    NOT NULL,
    email               VARCHAR(150)    NOT NULL,
    telephone           VARCHAR(20)     NULL,
    mot_de_passe_hash   VARCHAR(255)    NOT NULL,          -- conserve jusqu'a validation
    statut              ENUM('en_attente','validee','refusee') NOT NULL DEFAULT 'en_attente',
    motif_refus         VARCHAR(255)    NULL,
    valideur_id         BIGINT UNSIGNED NULL,              -- le SuperAdmin qui a tranche
    utilisateur_id      BIGINT UNSIGNED NULL,              -- compte cree apres validation
    date_traitement     DATETIME        NULL,
    created_at          DATETIME        NULL,
    updated_at          DATETIME        NULL,
    CONSTRAINT fk_dc_demandeur FOREIGN KEY (demandeur_id)
        REFERENCES utilisateurs(id) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_dc_pays FOREIGN KEY (pays_id)
        REFERENCES pays(id) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_dc_ville FOREIGN KEY (ville_id)
        REFERENCES villes(id) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_dc_valideur FOREIGN KEY (valideur_id)
        REFERENCES utilisateurs(id) ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT fk_dc_utilisateur FOREIGN KEY (utilisateur_id)
        REFERENCES utilisateurs(id) ON DELETE SET NULL ON UPDATE CASCADE,
    KEY idx_dc_statut (statut),
    KEY idx_dc_pays (pays_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ---------------------------------------------------------------------
-- 4. TRACABILITE / RAPPORTS
-- ---------------------------------------------------------------------

CREATE TABLE connexions (
    id              BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    utilisateur_id  BIGINT UNSIGNED NOT NULL,
    date_connexion  DATETIME        NOT NULL,
    adresse_ip      VARCHAR(45)     NOT NULL,          -- IPv4 ou IPv6
    duree_secondes  INT UNSIGNED    NULL,
    action          VARCHAR(255)    NULL,              -- ex: "connexion", "export_rapport", "modif_profil"
    created_at      DATETIME        NULL,
    CONSTRAINT fk_connexions_utilisateur FOREIGN KEY (utilisateur_id)
        REFERENCES utilisateurs(id) ON DELETE CASCADE ON UPDATE CASCADE,
    KEY idx_connexions_utilisateur (utilisateur_id),
    KEY idx_connexions_date (date_connexion)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE rapports (
    id                  BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    utilisateur_id      BIGINT UNSIGNED NOT NULL,
    pays_id             BIGINT UNSIGNED NOT NULL,
    type_export         ENUM('csv','pdf') NOT NULL,
    periode_couverte    VARCHAR(50)     NULL,          -- ex: "2026-06", "2026-Q2"
    chemin_fichier      VARCHAR(255)    NULL,
    date_generation     DATETIME        NOT NULL,
    created_at          DATETIME        NULL,
    CONSTRAINT fk_rapports_utilisateur FOREIGN KEY (utilisateur_id)
        REFERENCES utilisateurs(id) ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT fk_rapports_pays FOREIGN KEY (pays_id)
        REFERENCES pays(id) ON DELETE RESTRICT ON UPDATE CASCADE,
    KEY idx_rapports_utilisateur (utilisateur_id),
    KEY idx_rapports_pays (pays_id),
    KEY idx_rapports_date (date_generation)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

SET FOREIGN_KEY_CHECKS = 1;

-- =====================================================================
-- Donnees de reference minimales (roles de base)
-- =====================================================================
INSERT INTO roles (libelle_role, created_at, updated_at) VALUES
    ('SuperAdmin', NOW(), NOW()),
    ('Admin Pays', NOW(), NOW()),
    ('Commercial', NOW(), NOW());
