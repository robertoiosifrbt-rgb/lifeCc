-- APPLIED LIVE (manually, via the Supabase SQL Editor, not through
-- `supabase db push`/CLI — see docs/MIGRATII.md's drift section). D1 audit
-- blocker: `platform_item_id` (on `shift_earnings`
-- and `platform_rules`, both `20260907000000_delivery_data_foundation` /
-- `20260907030000_platform_rules`) only foreign-keys to `items (id, owner)` —
-- the same check every anchor's own extension table uses to prove it belongs
-- to the right owner. Ownership is not identity: nothing stopped either
-- column from pointing at a Task, a Journal entry, or any other item that
-- merely happens to be owned by the same person, since a plain FK cannot see
-- `kind` at all. A CHECK constraint cannot run a subquery either, so — like
-- `reject_write_to_completed_shift` and `pin_shift_rates` before it — this is
-- a trigger, not a constraint.

begin;

create function public.require_item_kind() returns trigger
  language plpgsql
  set search_path = ''
as $$
declare
  column_name   text := tg_argv[0];
  expected_kind text := tg_argv[1];
  ref_id        uuid;
  actual_kind   text;
begin
  ref_id := (to_jsonb(new) ->> column_name)::uuid;
  if ref_id is null then
    return new;
  end if;

  select kind into actual_kind from public.items where id = ref_id;
  if actual_kind is distinct from expected_kind then
    raise exception '% must reference an item of kind ''%'', not ''%''',
      column_name, expected_kind, actual_kind
      using errcode = '23514';
  end if;
  return new;
end $$;

create trigger shift_earnings_platform_kind
  before insert or update on public.shift_earnings
  for each row execute function public.require_item_kind('platform_item_id', 'platform');

create trigger platform_rules_platform_kind
  before insert or update on public.platform_rules
  for each row execute function public.require_item_kind('platform_item_id', 'platform');

commit;
