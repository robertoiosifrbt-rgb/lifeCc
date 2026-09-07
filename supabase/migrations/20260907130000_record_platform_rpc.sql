-- APPLIED LIVE (manually, via the Supabase SQL Editor, not through
-- `supabase db push`/CLI — see docs/MIGRATII.md's drift section).
--
-- D1 audit (round 3), finding #11: recording a new Platform was two separate
-- requests — an insert into `items` (kind='platform'), then a second insert
-- into `platforms` naming that item's id — with nothing tying them together.
-- A connection dropped between the two left an orphan `items` row of
-- kind='platform' with no matching `platforms` extension row: a Platform
-- that exists as an anchor but has no configuration row for `savePlatform`/
-- `savePlatformRule` to ever find, the same "torn write" class Save Workday's
-- own atomic fix (`20260907070000_completed_expense_guard_and_scoped_save`,
-- `20260907100000_atomic_item_patch`) already closed for Workdays.
--
-- One function, one transaction: the anchor is inserted, then its extension
-- row referencing that same id, both or neither.

begin;

create function public.record_platform(p_title text) returns public.items
  language plpgsql
  security invoker
  set search_path = ''
as $$
declare
  v_item public.items;
begin
  insert into public.items (title, kind, state, area_id)
  values (p_title, 'platform', 'active', null)
  returning * into v_item;

  insert into public.platforms (item_id) values (v_item.id);

  return v_item;
end $$;

revoke all on function public.record_platform(text) from public, anon;
grant execute on function public.record_platform(text) to authenticated;

commit;
