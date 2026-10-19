-- ============================================================
-- G7 Marine Transport - database setup
-- Paste this whole file into Supabase > SQL Editor > New query > Run.
-- Safe to run more than once.
-- ============================================================

-- ---------- Tables ----------
create table if not exists public.staff_profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  name        text not null,
  role        text not null check (role in ('admin','cashier')),
  active      boolean not null default true,
  created_at  timestamptz not null default now()
);
alter table public.staff_profiles add column if not exists login_email text;
create unique index if not exists staff_name_uq on public.staff_profiles (lower(name));

create table if not exists public.bookings (
  ref         text primary key,
  trip_id     text not null,
  trip_date   date not null,
  status      text not null default 'confirmed',
  data        jsonb not null,
  created_at  timestamptz not null default now()
);
create index if not exists bookings_trip_idx on public.bookings (trip_id);
create index if not exists bookings_date_idx on public.bookings (trip_date);

create table if not exists public.trip_overrides (trip_id text primary key, data jsonb not null default '{}'::jsonb);
create table if not exists public.extra_trips    (id text primary key, trip_date date not null, data jsonb not null);
create table if not exists public.settings       (key text primary key, value jsonb not null);

-- ---------- Who is signed in? ----------
create or replace function public.is_staff() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from staff_profiles where id = auth.uid() and active);
$$;
create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from staff_profiles where id = auth.uid() and active and role = 'admin');
$$;

-- The first account created in Supabase (Authentication > Users) becomes the administrator.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from staff_profiles) then
    insert into staff_profiles (id, name, role) values (new.id, 'Administrator', 'admin');
  end if;
  return new;
end $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();
-- If you already created your user before running this file, promote them now:
insert into public.staff_profiles (id, name, role)
  select id, 'Administrator', 'admin' from auth.users order by created_at limit 1
  on conflict do nothing;

-- ---------- Row level security ----------
alter table public.staff_profiles enable row level security;
alter table public.bookings       enable row level security;
alter table public.trip_overrides enable row level security;
alter table public.extra_trips    enable row level security;
alter table public.settings       enable row level security;

-- staff_profiles: staff can read the list; only admins change it (accounts are created by the edge function)
drop policy if exists sp_read  on public.staff_profiles;
drop policy if exists sp_admin on public.staff_profiles;
create policy sp_read  on public.staff_profiles for select to authenticated using (public.is_staff());
create policy sp_admin on public.staff_profiles for all    to authenticated using (public.is_admin()) with check (public.is_admin());

-- bookings: ONLY staff can read or change them directly. Customers use the functions below.
drop policy if exists bk_staff on public.bookings;
drop policy if exists bk_del   on public.bookings;
create policy bk_staff on public.bookings for all    to authenticated using (public.is_staff()) with check (public.is_staff());
create policy bk_del   on public.bookings as restrictive for delete to authenticated using (public.is_admin());

-- trips / extra trips / public settings: everyone can read (customers need them); staff write
drop policy if exists to_read  on public.trip_overrides;  drop policy if exists to_write on public.trip_overrides;
drop policy if exists et_read  on public.extra_trips;     drop policy if exists et_write on public.extra_trips;
drop policy if exists st_read  on public.settings;        drop policy if exists st_write on public.settings;
create policy to_read  on public.trip_overrides for select to anon, authenticated using (true);
create policy to_write on public.trip_overrides for all    to authenticated using (public.is_staff()) with check (public.is_staff());
create policy et_read  on public.extra_trips    for select to anon, authenticated using (true);
create policy et_write on public.extra_trips    for all    to authenticated using (public.is_staff()) with check (public.is_staff());
create policy st_read  on public.settings for select to anon, authenticated using (key in ('farePrices','customFares','maintenance','openDates') or public.is_staff());
create policy st_write on public.settings for all    to authenticated
  using      (public.is_admin() or (public.is_staff() and key in ('maintenance','openDates','receiptSeq')))
  with check (public.is_admin() or (public.is_staff() and key in ('maintenance','openDates','receiptSeq')));

-- ---------- Customer functions (no sign-in needed) ----------
-- Seats already taken on a date: seat numbers only, no names.
create or replace function public.taken_seats(p_date date)
returns table (trip_id text, seat int)
language sql stable security definer set search_path = public as $$
  select b.trip_id, (p->>'seat')::int
  from bookings b, jsonb_array_elements(b.data->'passengers') p
  where b.trip_date = p_date and b.status = 'confirmed' and p->>'seat' is not null;
$$;
grant execute on function public.taken_seats(date) to anon, authenticated;

-- Look up one booking: needs the reference AND the mobile number used (last 7 digits).
drop function if exists public.lookup_booking(text);
create or replace function public.lookup_booking(p_ref text, p_phone text)
returns jsonb language sql stable security definer set search_path = public as $$
  select data from bookings
  where ref = upper(trim(p_ref))
    and right(regexp_replace(coalesce(data->'contact'->>'phone',''), '\D', '', 'g'), 7)
      = right(regexp_replace(coalesce(p_phone,''), '\D', '', 'g'), 7)
    and length(regexp_replace(coalesce(p_phone,''), '\D', '', 'g')) >= 7;
$$;
grant execute on function public.lookup_booking(text, text) to anon, authenticated;

-- Create a booking: checks seats, fares and trip rules on the server, in one safe step.
create or replace function public.create_booking(p jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_ref text := upper(p->>'ref');
  v_trip text := p->>'tripId';
  v_date date := (p->>'date')::date;
  v_total numeric := 0;
  v_pax jsonb;
  v_price numeric;
  v_seat int;
  v_prices jsonb := coalesce((select value from settings where key = 'farePrices'), '{}'::jsonb);
  v_custom jsonb := coalesce((select value from settings where key = 'customFares'), '[]'::jsonb);
  v_oos jsonb := coalesce((select value from settings where key = 'maintenance'), '[86,87,88,89]'::jsonb);
  v_ov jsonb := coalesce((select data from trip_overrides where trip_id = v_trip), '{}'::jsonb);
  v_defaults jsonb := '{"regular":780,"student":670,"senior_pwd":650,"child":500,"infant":200}'::jsonb;
  v_seats int[] := '{}';
begin
  if v_ref !~ '^G7-[0-9]{6}-[A-Z0-9]{4}$' then raise exception 'Invalid reference'; end if;
  if v_trip is null or v_date is null then raise exception 'Missing trip'; end if;
  if (v_ov->>'cancelled')::boolean is true then raise exception 'This trip has been cancelled.'; end if;
  if not exists (select 1 from extra_trips where trip_date = v_date) and not exists (
       select 1 from jsonb_array_elements(coalesce((select value from settings where key = 'openDates'),
              jsonb_build_array(jsonb_build_object('from', current_date::text, 'to', (current_date + 30)::text)))) r
       where v_date between (r->>'from')::date and (r->>'to')::date) then
    raise exception 'Booking is not open for this date yet.';
  end if;
  if jsonb_array_length(p->'passengers') < 1 or jsonb_array_length(p->'passengers') > 10 then raise exception 'Invalid passenger count'; end if;
  if coalesce(p->'contact'->>'name','') = '' or coalesce(p->'contact'->>'phone','') = '' then raise exception 'Contact details required'; end if;

  perform pg_advisory_xact_lock(hashtext(v_trip));   -- one booking at a time per trip

  for v_pax in select * from jsonb_array_elements(p->'passengers') loop
    v_price := coalesce(
      (v_prices->>(v_pax->>'fareType'))::numeric,
      (select (c->>'price')::numeric from jsonb_array_elements(v_custom) c where c->>'id' = v_pax->>'fareType'),
      (v_defaults->>(v_pax->>'fareType'))::numeric);
    if v_price is null or (v_pax->>'fare')::numeric <> v_price then raise exception 'Fare changed, please start again.'; end if;
    v_total := v_total + v_price;
    if v_pax->>'seat' is not null and v_pax->>'seat' <> 'null' then
      v_seat := (v_pax->>'seat')::int;
      if v_oos @> to_jsonb(v_seat) or coalesce(v_ov->'blocked','[]'::jsonb) @> to_jsonb(v_seat) then raise exception 'Seat % is not available.', v_seat; end if;
      if v_seat = any(v_seats) then raise exception 'Seat % picked twice.', v_seat; end if;
      v_seats := v_seats || v_seat;
      if exists (select 1 from bookings b, jsonb_array_elements(b.data->'passengers') x
                 where b.trip_id = v_trip and b.status = 'confirmed' and x->>'seat' = v_seat::text) then
        raise exception 'Seat % was just taken.', v_seat;
      end if;
    end if;
  end loop;
  if v_total <> (p->>'total')::numeric then raise exception 'Total does not match.'; end if;

  insert into bookings (ref, trip_id, trip_date, status, data)
  values (v_ref, v_trip, v_date, 'confirmed',
          jsonb_set(jsonb_set(p, '{payment}', jsonb_build_object('method', p->'payment'->>'method', 'status', 'unpaid')), '{status}', '"confirmed"'));
  return (select data from bookings where ref = v_ref);
end $$;
grant execute on function public.create_booking(jsonb) to anon, authenticated;

-- Lock down direct table access for the anonymous (customer) role
revoke all on public.bookings, public.staff_profiles from anon;

-- Names shown on the staff sign-in screen. login_email is only returned for accounts created in the app
-- (internal @staff.g7.local addresses); a real email (your own admin login) is never exposed.
drop function if exists public.staff_login_list();
create or replace function public.staff_login_list()
returns table (id uuid, name text, login_email text)
language sql stable security definer set search_path = public as $$
  select p.id, p.name, case when p.login_email like '%@staff.g7.local' then p.login_email end
  from staff_profiles p where p.active order by p.name;
$$;
grant execute on function public.staff_login_list() to anon, authenticated;

-- All taken seats in a date range (seat numbers only), so the booking page can show availability.
create or replace function public.taken_seats_range(p_from date, p_to date)
returns table (trip_id text, seat int)
language sql stable security definer set search_path = public as $$
  select b.trip_id, (x->>'seat')::int
  from bookings b, jsonb_array_elements(b.data->'passengers') x
  where b.trip_date between p_from and p_to and b.status = 'confirmed'
    and x->>'seat' is not null and x->>'seat' <> 'null';
$$;
grant execute on function public.taken_seats_range(date, date) to anon, authenticated;
