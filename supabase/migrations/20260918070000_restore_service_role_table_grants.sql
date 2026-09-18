-- Restore the standard server-role privileges on a freshly created project.
--
-- Supabase projects used to grant every table in `public` to service_role by
-- default. Newer projects no longer do. The migrations before this one grant
-- anon and authenticated explicitly, but relied on that platform default for
-- service_role, so on a new project the server-side admin client is refused on
-- every table (42501): the waitlist cannot read its spam-protection limits,
-- guest checkout cannot read settings, and the demo sign-ins cannot be created.
--
-- service_role is the trusted server role. Its key never reaches the browser
-- (enforced by the SEC and SEC2 boundary checks), and it bypasses row-level
-- security by design. anon and authenticated are not touched here, so the
-- public boundary is unchanged [INV-01].
--
-- Routines are deliberately NOT granted in bulk: 35 functions revoke
-- service_role on purpose, and every admin RPC the application calls already
-- carries an explicit grant.

grant all on all tables    in schema public to service_role;
grant all on all sequences in schema public to service_role;

-- Re-assert the deliberate exceptions the grant above would otherwise undo.
-- Tax documents are immutable once issued: nothing writes them except the
-- SECURITY DEFINER functions that own them, not even the server role.
revoke insert, update, delete, truncate on public.invoices from service_role;
revoke all on public.credit_notes     from service_role;
revoke all on public.invoice_payments from service_role;
