#!/usr/bin/env bash
set -e

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL
-- ============================================================
-- 1. Bootstrap roles
-- Run this part as postgres / superuser / admin with CREATEROLE
-- ============================================================

CREATE ROLE example_owner NOLOGIN;
CREATE ROLE schema_admin_role NOLOGIN;
CREATE ROLE readonly_role NOLOGIN;
CREATE ROLE readwrite_role NOLOGIN;
CREATE ROLE vault LOGIN PASSWORD 'integration';
GRANT example_owner TO vault;
GRANT example_owner TO schema_admin_role;
GRANT CREATE ON DATABASE "$POSTGRES_DB" TO example_owner;

-- ============================================================
-- 2. Create and assign schema ownership
-- Run as database owner / superuser
-- ============================================================
SET ROLE example_owner;

CREATE SCHEMA IF NOT EXISTS example AUTHORIZATION example_owner;

-- ============================================================
-- 3. Schema permissions
-- Run as example_owner, or as superuser
-- ============================================================

GRANT USAGE, CREATE ON SCHEMA example TO schema_admin_role;
GRANT USAGE ON SCHEMA example TO readonly_role;
GRANT USAGE ON SCHEMA example TO readwrite_role;


-- ============================================================
-- 4. Existing object permissions
-- Run after schema/tables already exist, if any
-- ============================================================

GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA example TO schema_admin_role;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA example TO schema_admin_role;
GRANT ALL PRIVILEGES ON ALL FUNCTIONS IN SCHEMA example TO schema_admin_role;

GRANT SELECT ON ALL TABLES IN SCHEMA example TO readonly_role;
GRANT SELECT ON ALL SEQUENCES IN SCHEMA example TO readonly_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA example TO readwrite_role;
GRANT USAGE, SELECT, UPDATE ON ALL SEQUENCES IN SCHEMA example TO readwrite_role;

GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA example TO readonly_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA example TO readwrite_role;


-- ============================================================
-- 5. Future object permissions
-- Important: defaults are for objects created by example_owner
-- ============================================================

ALTER DEFAULT PRIVILEGES FOR ROLE example_owner IN SCHEMA example
GRANT ALL PRIVILEGES ON TABLES TO schema_admin_role;

ALTER DEFAULT PRIVILEGES FOR ROLE example_owner IN SCHEMA example
GRANT ALL PRIVILEGES ON SEQUENCES TO schema_admin_role;

ALTER DEFAULT PRIVILEGES FOR ROLE example_owner IN SCHEMA example
GRANT ALL PRIVILEGES ON FUNCTIONS TO schema_admin_role;


ALTER DEFAULT PRIVILEGES FOR ROLE example_owner IN SCHEMA example
GRANT SELECT ON TABLES TO readonly_role;

ALTER DEFAULT PRIVILEGES FOR ROLE example_owner IN SCHEMA example
GRANT SELECT ON SEQUENCES TO readonly_role;

ALTER DEFAULT PRIVILEGES FOR ROLE example_owner IN SCHEMA example
GRANT EXECUTE ON FUNCTIONS TO readonly_role;


ALTER DEFAULT PRIVILEGES FOR ROLE example_owner IN SCHEMA example
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO readwrite_role;

ALTER DEFAULT PRIVILEGES FOR ROLE example_owner IN SCHEMA example
GRANT USAGE, SELECT, UPDATE ON SEQUENCES TO readwrite_role;

ALTER DEFAULT PRIVILEGES FOR ROLE example_owner IN SCHEMA example
GRANT EXECUTE ON FUNCTIONS TO readwrite_role;

RESET ROLE;

-- ============================================================
-- 6. Optional: default search_path
-- ============================================================

ALTER ROLE vault SET search_path TO example;
ALTER ROLE readonly_role SET search_path TO example;
ALTER ROLE readwrite_role SET search_path TO example;
ALTER ROLE schema_admin_role SET search_path TO example;

-- ============================================================
-- 7. Grant roles to vault
-- ============================================================

ALTER ROLE vault CREATEROLE;

GRANT readonly_role TO vault WITH ADMIN OPTION;
GRANT readwrite_role TO vault WITH ADMIN OPTION;
GRANT schema_admin_role TO vault WITH ADMIN OPTION;

EOSQL
