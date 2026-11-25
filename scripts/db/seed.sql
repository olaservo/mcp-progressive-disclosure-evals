-- Resets the `shop` database to the state the database tasks start from. Run with psql, one statement at a time.
-- Each planted problem is the subject of one task in scripts/db-tasks.json or scripts/db-find-tasks.json.
SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE application_name = 'pd-blocker';
DROP EXTENSION IF EXISTS pg_stat_statements;
DROP PUBLICATION IF EXISTS pd_orders_pub;
SELECT pg_drop_replication_slot(slot_name) FROM pg_replication_slots WHERE slot_name = 'pd_archive_slot';
DROP SCHEMA IF EXISTS public CASCADE;
CREATE SCHEMA public;
ALTER DATABASE shop RESET ALL;
DO $$ BEGIN IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'reporting') THEN CREATE ROLE reporting NOLOGIN; END IF; END $$;
ALTER ROLE reporting CONNECTION LIMIT 7;

CREATE TABLE customers (id integer PRIMARY KEY, email text NOT NULL, name text NOT NULL, created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE products (id integer PRIMARY KEY, sku text NOT NULL UNIQUE, name text NOT NULL, price numeric(10,2) NOT NULL);
CREATE TABLE orders (id serial PRIMARY KEY, customer_id integer NOT NULL REFERENCES customers (id), status text NOT NULL, total numeric(10,2) NOT NULL, created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE order_items (id serial PRIMARY KEY, order_id integer NOT NULL REFERENCES orders (id), product_id integer NOT NULL REFERENCES products (id), qty integer NOT NULL);
CREATE TABLE sessions (id bigserial PRIMARY KEY, customer_id integer NOT NULL, token text NOT NULL, expires_at timestamptz NOT NULL) WITH (autovacuum_enabled = false);
CREATE TABLE audit_log (id bigserial PRIMARY KEY, table_name text NOT NULL, row_id integer NOT NULL, changed_at timestamptz NOT NULL DEFAULT now());

INSERT INTO customers (id, email, name) SELECT n, 'user' || n || '@example.com', 'Customer ' || n FROM generate_series(1, 2000) n;
INSERT INTO products (id, sku, name, price) SELECT n, 'SKU-' || lpad(n::text, 4, '0'), 'Product ' || n, (n % 90) + 9.99 FROM generate_series(1, 200) n;
-- Orders are loaded with explicit IDs and the sequence is left behind them.
INSERT INTO orders (id, customer_id, status, total, created_at) SELECT n, (n % 2000) + 1, (ARRAY['paid', 'shipped', 'cancelled', 'pending'])[(n % 4) + 1], (n % 300) + 5, now() - (n || ' minutes')::interval FROM generate_series(1, 50000) n;
SELECT setval('orders_id_seq', 100);
INSERT INTO order_items (order_id, product_id, qty) SELECT (n % 50000) + 1, (n % 200) + 1, (n % 5) + 1 FROM generate_series(1, 100000) n;

-- Dead rows that no autovacuum will clear.
INSERT INTO sessions (customer_id, token, expires_at) SELECT (n % 2000) + 1, md5(n::text), now() - interval '1 day' FROM generate_series(1, 60000) n;
DELETE FROM sessions WHERE id > 5000;

-- An index left invalid, as a failed concurrent build leaves one.
CREATE INDEX orders_status_created_idx ON orders (status, created_at);
UPDATE pg_index SET indisvalid = false WHERE indexrelid = 'orders_status_created_idx'::regclass;

-- order_items has one index that is scanned and one that never is. orders has no index on customer_id.
CREATE INDEX order_items_order_id_idx ON order_items (order_id);
CREATE INDEX order_items_qty_idx ON order_items (qty);
ANALYZE;
SET enable_seqscan = off;
SELECT count(*) FROM order_items WHERE order_id = 17;
SELECT count(*) FROM order_items WHERE id = 17;
RESET enable_seqscan;

-- An audit trigger that was switched off.
CREATE FUNCTION log_customer_change() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN INSERT INTO audit_log (table_name, row_id) VALUES ('customers', NEW.id); RETURN NEW; END $$;
CREATE TRIGGER customers_audit AFTER UPDATE ON customers FOR EACH ROW EXECUTE FUNCTION log_customer_change();
ALTER TABLE customers DISABLE TRIGGER customers_audit;

CREATE VIEW order_summary AS SELECT o.id AS order_id, o.status, o.total, c.name AS customer_name FROM orders o JOIN customers c ON c.id = o.customer_id;

-- Objects the lookup tasks in scripts/db-find-tasks.json ask about.
CREATE PROCEDURE purge_stale_sessions() LANGUAGE sql AS $$ DELETE FROM sessions WHERE expires_at < now() - interval '30 days' $$;
CREATE PUBLICATION pd_orders_pub FOR TABLE orders, order_items;
SELECT pg_create_physical_replication_slot('pd_archive_slot');
