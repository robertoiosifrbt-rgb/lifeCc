-- Waiting: an active item you cannot move forward yourself — you are
-- waiting on someone else's answer.
--
-- Not a fourth stage in the cycle. The state machine stays inbox → active →
-- done, exactly as it is; asking a landlord a question does not stop being
-- work you are doing, and it still ends the same way, at done. Waiting is one
-- more fact about an active item, the same shape `due` already is: a date,
-- nullable, that means nothing until it is set.
--
-- The day itself, not a boolean, because "how long have I been waiting" is
-- the question the Command Centre answers — the same reason `due` is a date
-- and not a flag.

alter table public.items add column waiting_since date;

grant update (waiting_since) on table public.items to authenticated;
