-- rls_baseline_test.sql
-- Asserts that every table in the public schema has Row Level Security enabled.
-- This test must never be removed. Any public table without RLS is a security defect.
-- See: docs/adr/0003-rls-baseline-conventions.md §Convention 2

BEGIN;
SELECT plan(1);

SELECT is(
  (SELECT count(*)::int FROM pg_tables
   WHERE schemaname = 'public'
     AND rowsecurity = false),
  0,
  'All public tables must have RLS enabled'
);

SELECT * FROM finish();
ROLLBACK;
