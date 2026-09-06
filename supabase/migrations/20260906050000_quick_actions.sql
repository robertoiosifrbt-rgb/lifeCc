-- Home's Quick Actions, as configuration a user owns — not buttons the
-- application hardcodes.
--
-- The engine (the client) knows a finite, safe set of actions it can run:
-- journal.new, money.expense, delivery.work. Which of them a person sees, in
-- what order, and with what context (an Area, for delivery.work) is data,
-- exactly like an Area's name or its place in the tree — Law 17,
-- configuration over hardcoding. The code owns the safe implementations; a
-- row only names one of them.
--
-- No arbitrary code ever comes from this table. action_key is constrained to
-- the same finite list the client already refuses to go beyond (Law 20), so
-- an old deploy and a new database cannot disagree about what counts as a
-- real action.
--
-- No cursor: it rides the same delta strategy as areas (Law 12) rather than
-- an anchor, because a Quick Action is not an extension of an item — nothing
-- ever needs to find or link it the way a shift or a journal entry does. It
-- is a handful of rows, own id, own version, soft-deleted like everything
-- else a person removes.
--
-- Not applied yet: nothing here is atomic by assumption, so it is wrapped
-- explicitly. Half of this schema — the table without its own-instance
-- index, say — is not a state anything should ever run against.

begin;

create table public.quick_actions (
  id      uuid primary key default gen_random_uuid(),
  owner   uuid not null default auth.uid() references auth.users(id) on delete cascade,

  action_key text not null check (
    action_key in ('journal.new', 'money.expense', 'delivery.work')
  ),

  -- Only delivery.work has a required context, and only it: the day's shift
  -- is resolved by day *and* Area, so without one there is nothing to run.
  -- The other two take none, so a row for them carrying one would be a
  -- context nothing ever reads.
  area_id uuid,
  constraint quick_actions_area
    foreign key (area_id, owner) references public.areas (id, owner),
  constraint quick_actions_area_matches_key check (
    (action_key = 'delivery.work') = (area_id is not null)
  ),

  -- Where it sits among the others. A rank, not an index a swap has to keep
  -- in step: moving one row to sit between two others only ever needs that
  -- one row's own value to change, never its neighbours'. A finite double
  -- precision value only — the client refuses to compute a move when no
  -- finite rank strictly between two neighbours exists, and this constraint
  -- refuses the same for any write that reaches this column directly, since
  -- an authenticated client has column-level write access to it.
  -- Postgres sorts NaN as equal to itself (unlike IEEE 754, and unlike the
  -- client's own `Number.isFinite`), so `position = position` would not
  -- reject it the way it does in JavaScript — checked against the literal
  -- instead, on all three, the same way.
  position double precision not null default 0
    check (
      position <> 'nan'::double precision
      and position <> 'infinity'::double precision
      and position <> '-infinity'::double precision
    ),

  -- An optional custom display label. Null means the code-defined default
  -- for this action_key; a person may set, change or clear it. Display data
  -- only — it never changes action_key or what a tap does, the same way an
  -- Area's name never changes what it anchors. Blank/whitespace-only is
  -- refused, the same rule an Area's name already has.
  label text
    check (label is null or btrim(label) <> ''),

  version    integer     not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- Soft, like items and areas. Removing one is not supposed to be a
  -- decision you cannot undo by adding it back.
  deleted_at timestamptz,

  constraint quick_actions_id_owner unique (id, owner)
);

-- One configured instance per action per person. Soft-deleted rows do not
-- count: removing one and adding it back is not "already configured".
create unique index quick_actions_one_per_key
  on public.quick_actions (owner, action_key)
  where deleted_at is null;

create index quick_actions_by_owner on public.quick_actions (owner);

create trigger quick_actions_stamp
  before insert or update on public.quick_actions
  for each row execute function public.stamp();

revoke all on table public.quick_actions from anon, authenticated;

grant select on table public.quick_actions to authenticated;
grant insert (action_key, area_id, position, label) on table public.quick_actions to authenticated;
grant update (area_id, position, deleted_at, label) on table public.quick_actions to authenticated;

alter table public.quick_actions enable row level security;

create policy quick_actions_select on public.quick_actions for select to authenticated
  using (owner = auth.uid());

create policy quick_actions_insert on public.quick_actions for insert to authenticated
  with check (owner = auth.uid());

create policy quick_actions_update on public.quick_actions for update to authenticated
  using (owner = auth.uid()) with check (owner = auth.uid());

commit;
