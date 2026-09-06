-- Two invariants the Home delivery.work Quick Action leans on, which nothing
-- before this made true: the state machine (Start / Resume / Open) reads
-- "the" shift for a day and Area, and "the" open session on it, as if each
-- could only ever be one row. Only the application's own care made that
-- true so far, and care is not a constraint — two taps, or two devices,
-- could already make both of these false.
--
-- A new migration, not an edit to the live one: 20260905090000_shifts is
-- already declared applied, and a schema no client depends on yet is
-- exactly what a fresh migration is for. Not applied here, and not declared
-- applied in docs/MIGRATII.md until it actually is.
--
-- Explicitly atomic: a migration is not assumed atomic unless it says so,
-- and half of these two invariants — A without B, or the other way round —
-- is a schema this state machine was never written to run against.

begin;

-- A. At most one live shift per owner, day and Area. Only shifts — not
-- tasks or letters — and only ones with a real Area: an unfiled shift
-- (area_id null) is not constrained by this at all, the same way two
-- undated tasks are never duplicates of each other. A soft-deleted shift
-- does not count either, so discarding one and making a fresh one for the
-- same day is still allowed.
create unique index items_one_shift_per_day_area
  on public.items (owner, due, area_id)
  where kind = 'shift' and deleted_at is null and area_id is not null;

-- B. At most one open session per shift. A closed session (ended_at set)
-- never counts towards this: a day can have as many finished stints as it
-- likes, only ever one running at a time.
create unique index shift_sessions_one_open_per_shift
  on public.shift_sessions (item_id)
  where ended_at is null;

commit;
