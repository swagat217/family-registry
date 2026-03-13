-- ============================================================
--  Family Registry — MySQL Schema
--  Run: mysql -u root -p < schema.sql
-- ============================================================

CREATE DATABASE IF NOT EXISTS family_registry
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE family_registry;

-- ── Users ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
    id            VARCHAR(36)                        PRIMARY KEY,
    name          VARCHAR(255)                       NOT NULL,
    username      VARCHAR(100)                       NOT NULL UNIQUE,
    password_hash VARCHAR(255)                       NOT NULL,
    dob           DATE                               DEFAULT NULL,
    gender        ENUM('Male','Female','Other')      DEFAULT 'Male',
    generation    TINYINT UNSIGNED                   NOT NULL DEFAULT 1,
    about         TEXT                               DEFAULT NULL,
    photo         LONGTEXT                           DEFAULT NULL,
    status        ENUM('pending','approved','rejected') DEFAULT 'pending',
    registered_at DATETIME                           DEFAULT CURRENT_TIMESTAMP,
    updated_at    DATETIME                           DEFAULT CURRENT_TIMESTAMP
                                                     ON UPDATE CURRENT_TIMESTAMP,

    INDEX idx_status     (status),
    INDEX idx_generation (generation),
    INDEX idx_username   (username)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ── Relations ─────────────────────────────────────────────────
-- Each row means: "FROM member_id's perspective, related_member_id is my <relation_type>"
CREATE TABLE IF NOT EXISTS relations (
    id                INT          AUTO_INCREMENT PRIMARY KEY,
    member_id         VARCHAR(36)  NOT NULL,
    related_member_id VARCHAR(36)  NOT NULL,
    relation_type     VARCHAR(50)  NOT NULL,
    created_at        DATETIME     DEFAULT CURRENT_TIMESTAMP,

    UNIQUE  KEY uq_relation      (member_id, related_member_id),
    FOREIGN KEY fk_member        (member_id)         REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY fk_related       (related_member_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ── Indexes for relation queries ──────────────────────────────
CREATE INDEX idx_rel_member  ON relations (member_id);
CREATE INDEX idx_rel_related ON relations (related_member_id);
