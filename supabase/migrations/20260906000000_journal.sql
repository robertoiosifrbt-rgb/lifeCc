-- The personal journal: freeform writing, anchored like everything else.
--
-- Law 1 again: a journal entry is an important object with a life, so it gets
-- an anchor row in items, not a table of its own with no way in from the rest
-- of Life Core. Law 3: its text hangs off that anchor by item_id, exactly as
-- an expense's amount or an entity's registration does.
--
-- A journal entry is not a task, not an event, not a goal, and not a fourth
-- state of the item cycle. It is `active`, permanently — the same shape an
-- entity already has, for the same reason: it exists whether or not you do
-- anything about it, and Today, Tasks, Waiting and the Calendar leave it out
-- the same way they already leave a car out.
--
-- The anchor's own title cannot be null or blank — that constraint is not
-- weakened here. What is new is that the person is never asked for one: the
-- repository derives it from the entry's body when the entry's own title is
-- left blank. The database only ever sees a title; which one it is, is an
-- application decision, not a database one.

alter table public.items drop constraint items_kind_check;
alter table public.items add constraint items_kind_check
  check (kind in ('task', 'letter', 'shift', 'expense', 'entity', 'journal'));

-- The shape above is not only a comment: a journal anchor is permanently
-- active and never carries a due, a done_at or a waiting_since, the same way
-- items_state_matches_kind already enforces state and kind together. Without
-- this, nothing in the database stops a journal anchor from being marked
-- done, given a due date, or put on Waiting — only the application would ever
-- have refused it, and only for as long as every caller remembered to.
alter table public.items add constraint items_journal_active_only check (
  kind <> 'journal' or (
    state = 'active'
    and due is null
    and done_at is null
    and waiting_since is null
  )
);


create table public.journal_entries (
  item_id uuid primary key,
  owner   uuid not null default auth.uid(),

  -- What the person typed as a title. Genuinely optional: unlike the anchor's
  -- own title, the database does not require one here.
  title text,

  body text not null,

  -- The moment this is about, distinct from created_at/updated_at on purpose:
  -- an entry written tonight about this morning still belongs this morning on
  -- the timeline. Defaults to now so a quick entry never has to ask.
  journaled_at timestamptz not null default now(),

  constraint journal_entries_item_owner
    foreign key (item_id, owner) references public.items (id, owner)
    on delete cascade,

  -- Same law as items_title_not_blank: a title made of nothing but whitespace
  -- is not a title, whether it is required or not.
  constraint journal_entries_title_not_blank check (title is null or title ~ '\S'),
  constraint journal_entries_body_not_blank check (body ~ '\S')
);

create trigger journal_entries_touch_anchor
  after insert or update or delete on public.journal_entries
  for each row execute function public.touch_anchor();


revoke all on table public.journal_entries from anon, authenticated;

-- item_id is grantable for UPDATE and pinned, for the same reason as the
-- entities table: `.upsert()` names every column of its payload in the SET
-- list, so the grant has to exist for the upsert to run at all. The trigger
-- is what keeps item_id from actually moving.
grant select on table public.journal_entries to authenticated;
grant insert (item_id, title, body, journaled_at)
  on table public.journal_entries to authenticated;
grant update (item_id, title, body, journaled_at)
  on table public.journal_entries to authenticated;

create trigger journal_entries_pin
  before update on public.journal_entries
  for each row execute function public.pin('item_id');

-- No DELETE grant. The MVP has no way to discard an entry from the
-- interface; a delete flow is a later decision, not a default one taken here.

alter table public.journal_entries enable row level security;

create policy journal_entries_select on public.journal_entries
  for select to authenticated
  using (owner = auth.uid());
create policy journal_entries_insert on public.journal_entries
  for insert to authenticated
  with check (owner = auth.uid());
create policy journal_entries_update on public.journal_entries
  for update to authenticated
  using (owner = auth.uid()) with check (owner = auth.uid());
