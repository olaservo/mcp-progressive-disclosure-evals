-- One fix per task in scripts/db-tasks.json. scripts/db-check.ts applies these to show that every check query goes
-- from false on the seeded database to true.
DROP INDEX orders_status_created_idx;
VACUUM sessions;
SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE application_name = 'pd-blocker';
CREATE INDEX orders_customer_id_idx ON orders (customer_id);
DROP INDEX order_items_qty_idx;
CREATE EXTENSION pg_stat_statements;
GRANT SELECT ON orders, customers TO reporting;
ALTER TABLE customers ENABLE TRIGGER customers_audit;
SELECT setval('orders_id_seq', (SELECT max(id) FROM orders));
CREATE OR REPLACE VIEW order_summary AS SELECT o.id AS order_id, o.status, o.total, c.name AS customer_name, c.email AS customer_email FROM orders o JOIN customers c ON c.id = o.customer_id;
ALTER DATABASE shop SET work_mem = '64MB';
