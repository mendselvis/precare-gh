-- Caspian integration migration.
-- Run once in the Supabase SQL editor (Project -> SQL Editor -> New query).

-- Links a patient record to the Telegram conversation they messaged the bot
-- from, so we can push proactive updates (triage escalation, ambulance ETA)
-- to them there. Nullable: most patients won't use Telegram, and everything
-- still works via the hospital email channel alone.
alter table patients
  add column if not exists telegram_conversation_id text;

create index if not exists patients_telegram_conversation_id_idx
  on patients (telegram_conversation_id);

-- Single-row cursor so the serverless webhook route (app/api/caspian/webhook)
-- knows which Caspian events it's already processed across invocations.
create table if not exists caspian_state (
  id int primary key default 1,
  last_seq bigint not null default 0,
  constraint caspian_state_singleton check (id = 1)
);

insert into caspian_state (id, last_seq)
values (1, 0)
on conflict (id) do nothing;