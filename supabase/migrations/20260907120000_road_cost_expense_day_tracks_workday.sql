-- APPLIED LIVE (manually, via the Supabase SQL Editor, not through
-- `supabase db push`/CLI — see docs/MIGRATII.md's drift section).
--
-- D1 audit (round 3), finding #7: `save_workday`'s `road_cost_set` handling
-- only ever wrote a road-cost Expense's own `due` when creating a brand new
-- one (`entry->>'day'` was read once, at insert time). The existing-Expense
-- branch validated the link and rewrote amount/category/business_pct but
-- never touched the item's `due` — so once a Workday's date moved, every
-- already-linked parking/tolls/other Expense stayed dated wherever it was
-- first created, silently drifting out of the month (or tax year) the
-- Workday itself now falls in, even though `periodMoney`/`sliceOfYear` filter
-- every row by its own `due`.
--
-- The client side of this fix (`roadCostDayRefreshOf` in
-- `src/shifts/draftPatches.ts`) now sends a same-amount `road_cost_set` entry
-- for every already-linked road-cost Expense whenever the Workday's own date
-- changes, even when the amount itself did not — this migration is what
-- makes that entry's `day` actually land on the existing Expense.

begin;

create or replace function public.save_workday(payload jsonb) returns void
  language plpgsql
  security invoker
  set search_path = ''
as $$
declare
  v_item_id        uuid    := (payload->>'item_id')::uuid;
  v_item_patch     jsonb   := coalesce(payload->'item_patch', '{}'::jsonb);
  v_expected_version integer := (payload->>'expected_version')::integer;
  v_shift_patch    jsonb   := coalesce(payload->'shift_patch', '{}'::jsonb);
  v_force_touch    boolean := coalesce((payload->>'force_shift_touch')::boolean, false);
  v_vehicle_to     uuid    := nullif(payload->>'vehicle_link_to', '')::uuid;
  v_expense_id     uuid;
  entry            jsonb;
  id_text          text;
begin
  -- 0. The item's own patch, before anything else: `pin_shift_rates()`
  -- (fired by the shift row write in step 2) reads `items.due` off this same
  -- row, so a changed date must already be there by then. Version-checked
  -- the same way `writeChecked` protects every other item patch — a
  -- concurrent edit from elsewhere is refused, not silently overwritten.
  if v_item_patch <> '{}'::jsonb then
    update public.items
       set title   = case when v_item_patch ? 'title'   then v_item_patch->>'title' else title end,
           due     = case when v_item_patch ? 'due'     then (v_item_patch->>'due')::date else due end,
           area_id = case when v_item_patch ? 'area_id' then nullif(v_item_patch->>'area_id', '')::uuid else area_id end
     where id = v_item_id and owner = auth.uid() and version = v_expected_version;
    if not found then
      raise exception 'This Workday was changed elsewhere; reopen it and save again'
        using errcode = '40001';
    end if;
  end if;

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
  -- than silently rewritten. `due` is brought along here too, not only at
  -- creation: the client sends `day` on every entry, including a same-amount
  -- refresh when only the Workday's own date moved, so an existing Expense's
  -- day never falls behind the Workday it belongs to.
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
      update public.items
         set due = (entry->>'day')::date
       where id = v_expense_id and owner = auth.uid();
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
