-- The two pieces the core was missing, asked for by the owner in his own
-- words on 5 September:
--
--   Car insurance renewal → task + deadline + £740 cost + document + car +
--   company + reminder + istoric. Nu șapte intrări diferite în șapte module.
--
-- Everything in that sentence except two things already has somewhere to live.
-- The task, the deadline and the £740 are an item, its due date and an
-- expense. What is missing is the car — nothing in the schema can hold one —
-- and the arrows between them.
--
-- Law 1: a car is an important object with a life, so it is an item with an
-- anchor row, not a world of its own. Law 3: its numbers hang off that anchor
-- by item_id. Law 2: links are item ↔ item, never module ↔ module, which is
-- why `links` points at `items` from both ends and knows nothing about what
-- kind of thing sits on either side.
--
-- Law 5 wants both sync strategies declared here.
--
--   `entities` rides its anchor, exactly as a shift's numbers do: a write
--   stamps the item, the delta carries it, a client replaces the row wholesale.
--
--   `links` rides BOTH anchors. A link that stamped only one end would reach
--   the other device on one side and not the other, and half an arrow is worse
--   than none. Like a shift's children, a link may be deleted physically: it is
--   never looked up on its own, only ever as "the links of this item".


-- A fourth kind. task and letter come to you, a shift is work you did, an
-- expense is money that left — an entity is none of those. It is a thing that
-- exists whether or not you do anything about it, and the other four point at
-- it.
alter table public.items drop constraint items_kind_check;
alter table public.items add constraint items_kind_check
  check (kind in ('task', 'letter', 'shift', 'expense', 'entity'));


-- The thing itself: a person, a company, a property, a car.
--
-- The four the owner named, and no fifth "for later". Only the vehicle carries
-- columns, because the vehicle is the one with data in it today — the car he
-- drives for the deliveries module already built. A person has a name and that
-- is all the anchor already holds.
create table public.entities (
  item_id uuid primary key,
  owner   uuid not null default auth.uid(),

  entity_kind text not null,

  -- Everything below belongs to a vehicle and to nothing else. An insurance
  -- company with an odometer reading is a row nobody can explain — the same
  -- rule the expenses table applies to the pump details.
  registration text,
  make         text,
  model        text,
  fuel         text,

  -- What the odometer read when you last looked. The shifts module reads the
  -- odometer per shift; this is the car's own figure, and the two are not the
  -- same question.
  odo numeric(10, 1),

  -- The four dates that cost money when they pass unnoticed.
  mot_due       date,
  road_tax_due  date,
  insurance_due date,
  service_due   date,

  -- Servicing is measured in distance, not in dates.
  oil_changed_at numeric(10, 1),
  oil_due_at     numeric(10, 1),

  constraint entities_item_owner
    foreign key (item_id, owner) references public.items (id, owner)
    on delete cascade,

  constraint entities_kind check (
    entity_kind in ('person', 'company', 'property', 'vehicle')
  ),

  constraint entities_vehicle_only check (
    entity_kind = 'vehicle' or (
      registration is null and make is null and model is null and fuel is null
      and odo is null
      and mot_due is null and road_tax_due is null
      and insurance_due is null and service_due is null
      and oil_changed_at is null and oil_due_at is null
    )
  ),

  constraint entities_fuel check (
    fuel is null or fuel in ('petrol', 'diesel', 'electric', 'hybrid')
  ),

  constraint entities_odo_positive check (odo is null or odo >= 0),
  constraint entities_oil_positive check (
    (oil_changed_at is null or oil_changed_at >= 0)
    and (oil_due_at is null or oil_due_at >= 0)
  )
);

create trigger entities_touch_anchor
  after insert or update or delete on public.entities
  for each row execute function public.touch_anchor();


-- The arrow.
--
-- Two kinds, both written from the owner's sentence and neither invented: the
-- renewal is `about` the car and about the company that insures it, and the
-- £740 `pays` the renewal. A third kind is a row when there is a third kind of
-- arrow, not a migration.
create table public.links (
  id    uuid primary key default gen_random_uuid(),
  owner uuid not null default auth.uid(),

  from_id uuid not null,
  to_id   uuid not null,
  kind    text not null,

  created_at timestamptz not null default now(),

  -- Both ends through (id, owner): an arrow between two people's rows is not
  -- refused by a policy someone could forget to write, it cannot be spelled.
  constraint links_from_owner
    foreign key (from_id, owner) references public.items (id, owner)
    on delete cascade,
  constraint links_to_owner
    foreign key (to_id, owner) references public.items (id, owner)
    on delete cascade,

  constraint links_kind check (kind in ('about', 'pays')),

  -- An item about itself says nothing.
  constraint links_not_self check (from_id <> to_id),

  -- The same arrow drawn twice is one arrow. Without this, tapping the button
  -- again quietly doubles it and every count downstream is wrong.
  constraint links_once unique (from_id, to_id, kind)
);

create index links_by_from on public.links (from_id);
create index links_by_to   on public.links (to_id);


-- Both ends, for the reason written at the top. It writes state onto itself —
-- the one granted column that cannot be wrong — and the items trigger turns
-- that into a new version and a new updated_at.
create function public.touch_both_ends() returns trigger
  language plpgsql
  set search_path = ''
as $$
begin
  update public.items
     set state = state
   where owner = coalesce(new.owner, old.owner)
     and id in (
       coalesce(new.from_id, old.from_id),
       coalesce(new.to_id,   old.to_id)
     );
  return null;
end $$;

create trigger links_touch_both_ends
  after insert or update or delete on public.links
  for each row execute function public.touch_both_ends();


revoke all on table public.entities, public.links from anon, authenticated;

-- item_id is grantable for UPDATE and pinned, because `.upsert()` names every
-- column of its payload in the SET list. The trigger is what keeps the
-- guarantee; see 20260905170000 for the day that cost.
grant select, delete on table public.entities to authenticated;
grant insert (
  item_id, entity_kind,
  registration, make, model, fuel, odo,
  mot_due, road_tax_due, insurance_due, service_due,
  oil_changed_at, oil_due_at
) on table public.entities to authenticated;
grant update (
  item_id, entity_kind,
  registration, make, model, fuel, odo,
  mot_due, road_tax_due, insurance_due, service_due,
  oil_changed_at, oil_due_at
) on table public.entities to authenticated;

create trigger entities_pin
  before update on public.entities
  for each row execute function public.pin('item_id');

-- A link is made and unmade, never edited: changing either end turns it into a
-- different arrow, and there is nothing else on the row to change. So no
-- UPDATE grant at all, and no pin needed to protect one.
grant select, insert (from_id, to_id, kind), delete on table public.links
  to authenticated;

alter table public.entities enable row level security;
alter table public.links    enable row level security;

create policy entities_select on public.entities for select to authenticated
  using (owner = auth.uid());
create policy entities_insert on public.entities for insert to authenticated
  with check (owner = auth.uid());
create policy entities_update on public.entities for update to authenticated
  using (owner = auth.uid()) with check (owner = auth.uid());
create policy entities_delete on public.entities for delete to authenticated
  using (owner = auth.uid());

create policy links_select on public.links for select to authenticated
  using (owner = auth.uid());
create policy links_insert on public.links for insert to authenticated
  with check (owner = auth.uid());
create policy links_delete on public.links for delete to authenticated
  using (owner = auth.uid());
