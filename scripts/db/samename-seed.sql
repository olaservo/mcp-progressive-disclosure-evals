-- Resets one of the three shop databases for scripts/samename-run.ts. The runner replaces each {{NAME}} with that
-- database's value, so the same lookup has a different answer in each database. Run with psql, one statement at a time.
DROP PUBLICATION IF EXISTS {{PUB}};
DROP SCHEMA IF EXISTS public CASCADE;
CREATE SCHEMA public;

CREATE TABLE customers (id integer PRIMARY KEY, email text NOT NULL, name text NOT NULL, created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE products (id integer PRIMARY KEY, sku text NOT NULL UNIQUE, name text NOT NULL, price numeric(10,2) NOT NULL);
CREATE TABLE orders (id serial PRIMARY KEY, customer_id integer NOT NULL REFERENCES customers (id), status text NOT NULL, total numeric(10,2) NOT NULL, created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE order_items (id serial PRIMARY KEY, order_id integer NOT NULL REFERENCES orders (id), product_id integer NOT NULL REFERENCES products (id), qty integer NOT NULL);
CREATE TABLE {{DEAD_TABLE}} (id bigserial PRIMARY KEY, customer_id integer NOT NULL, token text NOT NULL, expires_at timestamptz NOT NULL) WITH (autovacuum_enabled = false);
CREATE TABLE audit_log (id bigserial PRIMARY KEY, table_name text NOT NULL, row_id integer NOT NULL, changed_at timestamptz NOT NULL DEFAULT now());

INSERT INTO customers (id, email, name) SELECT n, 'user' || n || '@example.com', 'Customer ' || n FROM generate_series(1, 2000) n;
INSERT INTO products (id, sku, name, price) SELECT n, 'SKU-' || lpad(n::text, 4, '0'), 'Product ' || n, (n % 90) + 9.99 FROM generate_series(1, 200) n;
-- Orders are loaded with explicit IDs and the sequence is left behind them.
INSERT INTO orders (id, customer_id, status, total, created_at) SELECT n, (n % 2000) + 1, (ARRAY['paid', 'shipped', 'cancelled', 'pending'])[(n % 4) + 1], (n % 300) + 5, now() - (n || ' minutes')::interval FROM generate_series(1, 50000) n;
SELECT setval('orders_id_seq', {{SEQ}});
INSERT INTO order_items (order_id, product_id, qty) SELECT (n % 50000) + 1, (n % 200) + 1, (n % 5) + 1 FROM generate_series(1, 100000) n;

-- Dead rows that no autovacuum will clear.
INSERT INTO {{DEAD_TABLE}} (customer_id, token, expires_at) SELECT (n % 2000) + 1, md5(n::text), now() - interval '1 day' FROM generate_series(1, {{DEAD_ROWS_LOADED}}) n;
DELETE FROM {{DEAD_TABLE}} WHERE id > {{DEAD_ROWS_KEPT}};

-- An index left invalid, as a failed concurrent build leaves one.
CREATE INDEX {{INVALID_INDEX}} ON orders ({{INVALID_COLUMNS}});
UPDATE pg_index SET indisvalid = false WHERE indexrelid = '{{INVALID_INDEX}}'::regclass;

-- order_items has one index that is scanned and one that never is.
CREATE INDEX order_items_order_id_idx ON order_items (order_id);
CREATE INDEX {{UNUSED_INDEX}} ON order_items ({{UNUSED_COLUMNS}});
ANALYZE;
SET enable_seqscan = off;
SELECT count(*) FROM order_items WHERE order_id = 17;
SELECT count(*) FROM order_items WHERE id = 17;
RESET enable_seqscan;

-- An audit trigger that was switched off.
CREATE FUNCTION log_customer_change() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN INSERT INTO audit_log (table_name, row_id) VALUES ('customers', NEW.id); RETURN NEW; END $$;
CREATE TRIGGER {{TRIGGER}} AFTER UPDATE ON customers FOR EACH ROW EXECUTE FUNCTION log_customer_change();
ALTER TABLE customers DISABLE TRIGGER {{TRIGGER}};

CREATE VIEW order_summary AS SELECT o.id AS order_id, o.status, o.total, {{VIEW_COLUMN}} FROM orders o JOIN customers c ON c.id = o.customer_id;

CREATE PROCEDURE {{PROCEDURE}}() LANGUAGE sql AS $$ DELETE FROM {{DEAD_TABLE}} WHERE expires_at < now() - interval '30 days' $$;
CREATE PUBLICATION {{PUB}} FOR TABLE {{PUB_TABLES}};
