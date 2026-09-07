-- NOT APPLIED LIVE (not declared applied in docs/MIGRATII.md until it is).
--
-- Two D1 audit blockers found against the state after the six migrations
-- above, both about a payload trusting an id too much:
--
-- 1. A Completed Workday's road-cost Expense (parking/tolls/other, linked
--    `about` a done shift per `20260907020000_road_cost_expenses`) had no
--    guard of its own. `shifts`/`shift_sessions`/`shift_earnings` all reject
--    a write once their shift is `done` (`reject_write_to_completed_shift`,
--    `20260907000000`), but the Expense itself — a completely ordinary row
--    in `public.expenses`, reachable from any Expense-editing screen, not
--    only from a shift's own sheet — was never in that list. The UI already
--    refuses to open a Completed Workday's road-cost fields for editing, but
--    that is application care, not a constraint: the same gap the original
--    Completed-immutability migration was written to close for everything
--    else. Same for the `about` link itself: `reject_link_change_on_completed_shift`
--    only ever checked the link's `from_id` — true for a Vehicle's `uses`
--    link (from_id is the shift), but false for a road-cost Expense's
--    `about` link, where the shift sits at `to_id` instead. A link could be
--    severed from a Completed Workday's Expense with no error at all.
--
-- 2. `save_workday(payload)` trusted an id in the payload the moment it
--    matched `owner = auth.uid()` — never that the row actually belonged to
--    *this* Workday. A link id, a session id, or an expense id naming a
--    different Draft Workday of the same owner would be unlinked/updated/
--    deleted exactly the same as one that actually belonged here: cross-
--    Workday, same-owner corruption, not caught by RLS (same owner) or by
--    any FK (an id existing under the right owner is all any of them check).
--
-- Both fixed the same way the rest of this boundary already is: an explicit
-- check against `items`/`links`, not a trust in the client's word.

begin;

-- 1a. Completed Workday Expense guard — same shape as
-- `reject_write_to_completed_shift`, but the linked shift is found through
-- `links` (kind='about', expense at from_id, shift at to_id — see
-- `20260907060000_save_workday_rpc`'s own road-cost insert), not read off
-- the row itself the way `shifts.item_id` is.
create function public.reject_write_to_completed_linked_expense() returns trigger
  language plpgsql
  set search_path = ''
as $$
declare
  blocked boolean;
begin
  select true into blocked
    from public.links l
    join public.items s on s.id = l.to_id
   where l.from_id = coalesce(new.item_id, old.item_id)
     and l.kind = 'about'
     and s.kind = 'shift' and s.state = 'done'
   limit 1;
  if blocked then
    raise exception 'An Expense linked to a Completed workday cannot be changed'
      using errcode = '42501';
  end if;
  return coalesce(new, old);
end $$;

create trigger expenses_reject_completed_workday_write
  before insert or update or delete on public.expenses
  for each row execute function public.reject_write_to_completed_linked_expense();

-- 1b. Widen the links guard to either end, not only `from_id` — a Vehicle's
-- `uses` link (shift at from_id) and a road-cost Expense's `about` link
-- (shift at to_id) are both "a Completed workday's links" now.
create or replace function public.reject_link_change_on_completed_shift() returns trigger
  language plpgsql
  set search_path = ''
as $$
declare
  blocked boolean;
begin
  select true into blocked
    from public.items
   where id in (coalesce(new.from_id, old.from_id), coalesce(new.to_id, old.to_id))
     and kind = 'shift' and state = 'done'
   limit 1;
  if blocked then
    raise exception 'A Completed workday''s links cannot be changed'
      using errcode = '42501';
  end if;
  return coalesce(new, old);
end $$;

-- 2. `save_workday`, rewritten to check every id against *this* Workday
-- before touching it, not only against the owner.
create or replace function public.save_workday(payload jsonb) returns void
  language plpgsql
  security invoker
  set search_path = ''
as $$
declare
  v_item_id      uuid  := (payload->>'item_id')::uuid;
  v_shift_patch  jsonb := coalesce(payload->'shift_patch', '{}'::jsonb);
  v_force_touch  boolean := coalesce((payload->>'force_shift_touch')::boolean, false);
  v_vehicle_to   uuid  := nullif(payload->>'vehicle_link_to', '')::uuid;
  v_expense_id   uuid;
  entry          jsonb;
  id_text        text;
begin
  -- 1. The Vehicle link, before the shift row itself. Scoped to links whose
  -- from_id is this Workday: a link id naming another item's link is simply
  -- not found, not silently unlinked.
  for id_text in select * from jsonb_array_elements_text(coalesce(payload->'vehicle_unlink_ids', '[]'::jsonb))
  loop
    delete from public.links
     where id = id_text::uuid and owner = auth.uid() and from_id = v_item_id;
  end loop;

  if v_vehicle_to is not null then
    insert into public.links (from_id, to_id, kind) values (v_item_id, v_vehicle_to, 'uses');
  end if;

  -- 2. The shift row: a partial patch (only the keys present are touched —
  -- the same "only what changed" shape the client's own `.upsert()` sent),
  -- or a no-op touch that still fires `pin_shift_rates()`, which is
  -- Complete Workday's only reason to ask for one.
  if v_shift_patch <> '{}'::jsonb or v_force_touch then
    insert into public.shifts (item_id, odo_start, odo_end, personal_km, tips, bonuses)
    values (
      v_item_id,
      (v_shift_patch->>'odo_start')::numeric,
      (v_shift_patch->>'odo_end')::numeric,
      (v_shift_patch->>'personal_km')::numeric,
      (v_shift_patch->>'tips')::numeric,
      (v_shift_patch->>'bonuses')::numeric
    )
    on conflict (item_id) do update set
      odo_start   = case when v_shift_patch ? 'odo_start'   then excluded.odo_start   else shifts.odo_start   end,
      odo_end     = case when v_shift_patch ? 'odo_end'     then excluded.odo_end     else shifts.odo_end     end,
      personal_km = case when v_shift_patch ? 'personal_km' then excluded.personal_km else shifts.personal_km end,
      tips        = case when v_shift_patch ? 'tips'        then excluded.tips        else shifts.tips        end,
      bonuses     = case when v_shift_patch ? 'bonuses'     then excluded.bonuses     else shifts.bonuses     end;
  end if;

  -- 3. What a platform paid — the legacy hardcoded enum. Already scoped to
  -- v_item_id on every statement (insert names it, delete/update filter by
  -- it) — never touched another Workday's row to begin with.
  for entry in select * from jsonb_array_elements(coalesce(payload->'earnings_set', '[]'::jsonb))
  loop
    insert into public.shift_earnings (item_id, platform, amount)
    values (v_item_id, entry->>'platform', (entry->>'amount')::numeric)
    on conflict (item_id, platform) do update set amount = excluded.amount;
  end loop;

  for id_text in select * from jsonb_array_elements_text(coalesce(payload->'earnings_remove', '[]'::jsonb))
  loop
    delete from public.shift_earnings
     where item_id = v_item_id and platform = id_text and owner = auth.uid();
  end loop;

  -- 4. The same, for a configurable Platform's own item id. Same as above:
  -- already scoped to v_item_id.
  for entry in select * from jsonb_array_elements(coalesce(payload->'platform_earnings_set', '[]'::jsonb))
  loop
    insert into public.shift_earnings (item_id, platform_item_id, amount)
    values (v_item_id, (entry->>'platform_item_id')::uuid, (entry->>'amount')::numeric)
    on conflict (item_id, platform_item_id) do update set amount = excluded.amount;
  end loop;

  for id_text in select * from jsonb_array_elements_text(coalesce(payload->'platform_earnings_remove', '[]'::jsonb))
  loop
    delete from public.shift_earnings
     where item_id = v_item_id and platform_item_id = id_text::uuid and owner = auth.uid();
  end loop;

  -- 5. Session breaks. Scoped to sessions of this Workday: a session id
  -- naming another Workday's break is simply not found, not silently
  -- retimed.
  for entry in select * from jsonb_array_elements(coalesce(payload->'breaks_set', '[]'::jsonb))
  loop
    update public.shift_sessions
       set break_minutes = (entry->>'minutes')::integer
     where id = (entry->>'session_id')::uuid and owner = auth.uid() and item_id = v_item_id;
  end loop;

  -- 6. Sessions removed outright — never an open one; the caller already
  -- guarantees that, the same as before. Same scoping as the break write.
  for id_text in select * from jsonb_array_elements_text(coalesce(payload->'sessions_remove', '[]'::jsonb))
  loop
    delete from public.shift_sessions
     where id = id_text::uuid and owner = auth.uid() and item_id = v_item_id;
  end loop;

  -- 7. Road-cost fields: each a real Expense, linked `about` the shift —
  -- never a number on `shifts` itself (see `20260907020000_road_cost_expenses`).
  -- An existing expense id has to already be linked `about` *this* Workday;
  -- naming any other expense of the same owner (a different Workday's
  -- road cost, or an unrelated fuel Expense) is rejected outright rather
  -- than silently rewritten.
  for entry in select * from jsonb_array_elements(coalesce(payload->'road_cost_set', '[]'::jsonb))
  loop
    if entry->>'existing_expense_item_id' is null then
      insert into public.items (title, kind, state, due, area_id)
      values (entry->>'title', 'expense', 'active', (entry->>'day')::date, null)
      returning id into v_expense_id;
    else
      v_expense_id := (entry->>'existing_expense_item_id')::uuid;
      if not exists (
        select 1 from public.links
         where from_id = v_expense_id and to_id = v_item_id and kind = 'about'
      ) then
        raise exception 'Expense % is not linked to this Workday', v_expense_id
          using errcode = '42501';
      end if;
    end if;

    insert into public.expenses (item_id, amount, category, business_pct)
    values (v_expense_id, (entry->>'amount')::numeric, entry->>'category', 100)
    on conflict (item_id) do update set
      amount = excluded.amount, category = excluded.category, business_pct = excluded.business_pct;

    if entry->>'existing_expense_item_id' is null then
      insert into public.links (from_id, to_id, kind) values (v_expense_id, v_item_id, 'about');
    end if;
  end loop;

  for entry in select * from jsonb_array_elements(coalesce(payload->'road_cost_remove', '[]'::jsonb))
  loop
    if not exists (
      select 1 from public.links
       where from_id = (entry->>'expense_item_id')::uuid and to_id = v_item_id and kind = 'about'
    ) then
      raise exception 'Expense % is not linked to this Workday', entry->>'expense_item_id'
        using errcode = '42501';
    end if;

    delete from public.expenses
     where item_id = (entry->>'expense_item_id')::uuid and owner = auth.uid();
    update public.items
       set deleted_at = now()
     where id = (entry->>'expense_item_id')::uuid and owner = auth.uid();
  end loop;
end $$;

revoke all on function public.save_workday(jsonb) from public, anon;
grant execute on function public.save_workday(jsonb) to authenticated;

commit;
