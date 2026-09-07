-- APPLIED LIVE (manually, via the Supabase SQL Editor, not through
-- `supabase db push`/CLI — see docs/MIGRATII.md's drift section).
--
-- D1 audit blocker: `reject_write_to_completed_shift` guards `shifts`/
-- `shift_sessions`/`shift_earnings`, `reject_write_to_completed_linked_expense`
-- guards a linked road-cost Expense, `reject_link_change_on_completed_shift`
-- guards `links` — but a Completed Workday's own anchor row in `public.items`
-- (its `title`, `due`, `area_id`, `state`, `kind`) had no equivalent. A
-- read-only check against live confirmed `authenticated` can still `UPDATE`
-- every one of those columns on a `done` shift: the UI never offers this for
-- a Completed Workday, but that is application care, not a constraint — the
-- exact bypass D1.I exists to close, just one row over from where it was
-- already closed.
--
-- `deleted_at` is deliberately exempt: `canDeleteWorkday` already allows
-- removing a Completed Workday outright (soft-delete), the same as a Draft
-- one — this guard is about rewriting what a Completed Workday says, not
-- about being allowed to discard it. The transition into `done` itself is
-- unaffected: the guard only fires once `old.state` is already `'done'`.

begin;

create function public.reject_write_to_completed_shift_anchor() returns trigger
  language plpgsql
  set search_path = ''
as $$
begin
  if old.kind = 'shift' and old.state = 'done' and (
    new.title is distinct from old.title or
    new.due is distinct from old.due or
    new.area_id is distinct from old.area_id or
    new.state is distinct from old.state or
    new.kind is distinct from old.kind
  ) then
    raise exception 'A Completed workday''s own item cannot be changed'
      using errcode = '42501';
  end if;
  return new;
end $$;

create trigger items_reject_completed_shift_write
  before update on public.items
  for each row execute function public.reject_write_to_completed_shift_anchor();

commit;
