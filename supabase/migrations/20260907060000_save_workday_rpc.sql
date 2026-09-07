-- APPLIED LIVE (manually, via the Supabase SQL Editor, not through
-- `supabase db push`/CLI — see docs/MIGRATII.md's drift section). D1 audit
-- blocker: Save draft / Complete Workday wrote a
-- shift's numbers, its earnings (legacy and configurable-Platform alike),
-- its session breaks/drops, its Vehicle link and its road-cost Expenses as a
-- sequence of separate network requests, one per changed part. A failure
-- partway through — a dropped connection, a rejected write on a Completed
-- shift, a constraint violation on one field — left everything written
-- before it committed, and everything after it silently unwritten: a torn
-- Workday, not a saved one and not an unsaved one.
--
-- This migration adds `save_workday(payload jsonb)`, callable once through
-- PostgREST's RPC endpoint (`supabase.rpc('save_workday', { payload })`)
-- instead of the up-to-nine separate calls the client used to make. A single
-- function invocation is a single Postgres transaction: every statement in
-- it commits together or none of them do. `security invoker` (the default,
-- named here for the reader) means it runs as the calling `authenticated`
-- role with `auth.uid()` set from the request exactly as today — every RLS
-- policy, grant and trigger already on these tables (`pin_shift_rates`,
-- `reject_write_to_completed_shift`, the `platform_item_id`/`kind` guard,
-- every check constraint) fires exactly as it does for a direct request, so
-- none of that logic is duplicated here.
--
-- The item's own title/date/Area patch is deliberately NOT part of this
-- function: that write already has its own version-checked
-- read-modify-retry semantics (`applyPatch`/`writeChecked`, tested on its
-- own), a different concern — concurrent edits to the anchor itself — from
-- "did this Workday's own numbers land as one piece". It keeps its existing,
-- separate call.

begin;

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
  -- 1. The Vehicle link, before the shift row itself: `pin_shift_rates()`
  -- resolves "the" Vehicle by joining `links` at the moment `shifts` is
  -- written, so a changed link has to have already landed.
  for id_text in select * from jsonb_array_elements_text(coalesce(payload->'vehicle_unlink_ids', '[]'::jsonb))
  loop
    delete from public.links where id = id_text::uuid and owner = auth.uid();
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

  -- 3. What a platform paid — the legacy hardcoded enum.
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

  -- 4. The same, for a configurable Platform's own item id.
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

  -- 5. Session breaks.
  for entry in select * from jsonb_array_elements(coalesce(payload->'breaks_set', '[]'::jsonb))
  loop
    update public.shift_sessions
       set break_minutes = (entry->>'minutes')::integer
     where id = (entry->>'session_id')::uuid and owner = auth.uid();
  end loop;

  -- 6. Sessions removed outright — never an open one; the caller already
  -- guarantees that, the same as before.
  for id_text in select * from jsonb_array_elements_text(coalesce(payload->'sessions_remove', '[]'::jsonb))
  loop
    delete from public.shift_sessions where id = id_text::uuid and owner = auth.uid();
  end loop;

  -- 7. Road-cost fields: each a real Expense, linked `about` the shift —
  -- never a number on `shifts` itself (see `20260907020000_road_cost_expenses`).
  for entry in select * from jsonb_array_elements(coalesce(payload->'road_cost_set', '[]'::jsonb))
  loop
    if entry->>'existing_expense_item_id' is null then
      insert into public.items (title, kind, state, due, area_id)
      values (entry->>'title', 'expense', 'active', (entry->>'day')::date, null)
      returning id into v_expense_id;
    else
      v_expense_id := (entry->>'existing_expense_item_id')::uuid;
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
