-- Gift Tracker: database layout and access rules.
-- Paste this whole file into the Supabase SQL Editor and press Run, once.
--
-- Every table and function starts with "gift_", so this can share a project with another app.
-- Nobody can read or write the tables directly. The app goes through the four functions at the
-- bottom, and each one needs the family code.

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------
create table public.gift_households (
  id uuid primary key default gen_random_uuid(),
  code_hash text not null unique,
  created_at timestamptz not null default now()
);

create table public.gift_groups (
  id uuid primary key,
  household_id uuid not null references public.gift_households (id) on delete cascade,
  year int not null,
  name text not null check (length(trim(name)) > 0),
  color text not null default 'cran',
  budget numeric(10,2) not null default 0,
  stocking_budget numeric(10,2) not null default 0,
  keep_even boolean not null default false,
  created_at timestamptz not null default clock_timestamp()
);
create index gift_groups_household_idx on public.gift_groups (household_id);

create table public.gift_people (
  id uuid primary key,
  household_id uuid not null references public.gift_households (id) on delete cascade,
  group_id uuid not null references public.gift_groups (id) on delete cascade,
  name text not null check (length(trim(name)) > 0),
  color text not null default 'cran',
  created_at timestamptz not null default clock_timestamp()
);
create index gift_people_household_idx on public.gift_people (household_id);

create table public.gift_items (
  id uuid primary key,
  household_id uuid not null references public.gift_households (id) on delete cascade,
  person_id uuid not null references public.gift_people (id) on delete cascade,
  name text not null check (length(trim(name)) > 0),
  cost numeric(10,2) not null default 0,
  category text not null default 'Other',
  store text not null default '',
  link text not null default '',
  kind text not null default 'main' check (kind in ('main', 'stocking')),
  status text not null default 'idea' check (status in ('idea', 'bought', 'received', 'wrapped')),
  created_at timestamptz not null default clock_timestamp()
);
create index gift_items_household_idx on public.gift_items (household_id);

-- Lock the tables: row security on, with no rules, means no direct access at all.
alter table public.gift_households enable row level security;
alter table public.gift_groups enable row level security;
alter table public.gift_people enable row level security;
alter table public.gift_items enable row level security;
revoke all on public.gift_households, public.gift_groups, public.gift_people, public.gift_items
  from anon, authenticated;

-- ---------------------------------------------------------------------------
-- Helpers (not callable from the app)
-- ---------------------------------------------------------------------------
-- The family code is stored scrambled, never as typed.
create function public.gift_code_hash(p_code text) returns text
language sql immutable as $$
  select encode(sha256(convert_to(lower(trim(p_code)), 'UTF8')), 'hex')
$$;

-- Turns a family code into its list, or stops with an error.
create function public.gift_household(p_code text) returns uuid
language plpgsql security definer set search_path = public as $$
declare hid uuid;
begin
  select id into hid from gift_households where code_hash = gift_code_hash(p_code);
  if hid is null then
    perform pg_sleep(0.5);  -- slows down guessing
    raise exception 'No list uses that family code.';
  end if;
  return hid;
end $$;

-- ---------------------------------------------------------------------------
-- What the app can do
-- ---------------------------------------------------------------------------
-- Join a list with its code, or start a new list with a new code.
create function public.gift_open(p_code text, p_create boolean) returns uuid
language plpgsql security definer set search_path = public as $$
declare hid uuid;
begin
  if p_create then
    if length(trim(coalesce(p_code, ''))) < 6 then
      raise exception 'Pick a family code with at least 6 characters.';
    end if;
    insert into gift_households (code_hash) values (gift_code_hash(p_code))
      on conflict (code_hash) do nothing
      returning id into hid;
    if hid is null then
      raise exception 'That code is already in use. Join it instead, or pick another.';
    end if;
    return hid;
  end if;
  return gift_household(p_code);
end $$;

-- Everything in the list, all years.
create function public.gift_load(p_code text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare hid uuid := gift_household(p_code);
begin
  return jsonb_build_object(
    'household', hid,
    'groups', coalesce((select jsonb_agg(to_jsonb(g) - 'household_id' order by g.created_at, g.id)
                        from gift_groups g where g.household_id = hid), '[]'::jsonb),
    'people', coalesce((select jsonb_agg(to_jsonb(p) - 'household_id' order by p.created_at, p.id)
                        from gift_people p where p.household_id = hid), '[]'::jsonb),
    'gifts',  coalesce((select jsonb_agg(to_jsonb(i) - 'household_id' order by i.created_at, i.id)
                        from gift_items i where i.household_id = hid), '[]'::jsonb)
  );
end $$;

-- Add or change one group, person or gift.
create function public.gift_save(p_code text, p_kind text, p_row jsonb) returns void
language plpgsql security definer set search_path = public as $$
declare hid uuid := gift_household(p_code);
begin
  if p_kind = 'group' then
    insert into gift_groups (id, household_id, year, name, color, budget, stocking_budget, keep_even)
    values ((p_row->>'id')::uuid, hid, (p_row->>'year')::int, p_row->>'name',
            coalesce(p_row->>'color', 'cran'),
            coalesce((p_row->>'budget')::numeric, 0),
            coalesce((p_row->>'stocking_budget')::numeric, 0),
            coalesce((p_row->>'keep_even')::boolean, false))
    on conflict (id) do update set
      name = excluded.name, color = excluded.color, budget = excluded.budget,
      stocking_budget = excluded.stocking_budget, keep_even = excluded.keep_even
    where gift_groups.household_id = hid;

  elsif p_kind = 'person' then
    if not exists (select 1 from gift_groups
                   where id = (p_row->>'group_id')::uuid and household_id = hid) then
      raise exception 'That group is not in this list.';
    end if;
    insert into gift_people (id, household_id, group_id, name, color)
    values ((p_row->>'id')::uuid, hid, (p_row->>'group_id')::uuid, p_row->>'name',
            coalesce(p_row->>'color', 'cran'))
    on conflict (id) do update set name = excluded.name, color = excluded.color
    where gift_people.household_id = hid;

  elsif p_kind = 'gift' then
    if not exists (select 1 from gift_people
                   where id = (p_row->>'person_id')::uuid and household_id = hid) then
      raise exception 'That person is not in this list.';
    end if;
    insert into gift_items (id, household_id, person_id, name, cost, category, store, link, kind, status)
    values ((p_row->>'id')::uuid, hid, (p_row->>'person_id')::uuid, p_row->>'name',
            coalesce((p_row->>'cost')::numeric, 0),
            coalesce(p_row->>'category', 'Other'),
            coalesce(p_row->>'store', ''),
            coalesce(p_row->>'link', ''),
            coalesce(p_row->>'kind', 'main'),
            coalesce(p_row->>'status', 'idea'))
    on conflict (id) do update set
      name = excluded.name, cost = excluded.cost, category = excluded.category,
      store = excluded.store, link = excluded.link, kind = excluded.kind, status = excluded.status
    where gift_items.household_id = hid;

  else
    raise exception 'Unknown kind: %', p_kind;
  end if;
end $$;

-- Remove one group (with its people and gifts), person (with their gifts) or gift.
create function public.gift_delete(p_code text, p_kind text, p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare hid uuid := gift_household(p_code);
begin
  if p_kind = 'group' then
    delete from gift_groups where id = p_id and household_id = hid;
  elsif p_kind = 'person' then
    delete from gift_people where id = p_id and household_id = hid;
  elsif p_kind = 'gift' then
    delete from gift_items where id = p_id and household_id = hid;
  else
    raise exception 'Unknown kind: %', p_kind;
  end if;
end $$;

-- Only the four app functions can be called from outside.
revoke execute on function public.gift_code_hash(text) from public, anon, authenticated;
revoke execute on function public.gift_household(text) from public, anon, authenticated;
revoke execute on function public.gift_open(text, boolean) from public;
revoke execute on function public.gift_load(text) from public;
revoke execute on function public.gift_save(text, text, jsonb) from public;
revoke execute on function public.gift_delete(text, text, uuid) from public;
grant execute on function public.gift_open(text, boolean) to anon, authenticated;
grant execute on function public.gift_load(text) to anon, authenticated;
grant execute on function public.gift_save(text, text, jsonb) to anon, authenticated;
grant execute on function public.gift_delete(text, text, uuid) to anon, authenticated;
