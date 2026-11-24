-- Run this entire file in Supabase SQL Editor
create table if not exists public.sales (
  id uuid primary key default gen_random_uuid(), amount numeric not null, customer text, note text,
  date date not null, created_by text, created_at timestamptz default now()
);
create table if not exists public.expenses (
  id uuid primary key default gen_random_uuid(), amount numeric not null, category text not null,
  note text, date date not null, created_by text, created_at timestamptz default now()
);
create table if not exists public.udhaar (
  id uuid primary key default gen_random_uuid(), customer text not null,
  balance numeric not null default 0, phone text, note text, created_by text, created_at timestamptz default now()
);
create table if not exists public.inventory (
  id uuid primary key default gen_random_uuid(), name text not null, quantity numeric not null default 0,
  price numeric not null default 0, category text, created_by text, created_at timestamptz default now()
);
create table if not exists public.staff (
  id uuid primary key default gen_random_uuid(), email text unique not null,
  role text not null default 'staff', active boolean not null default true, created_at timestamptz default now()
);

alter table public.sales enable row level security;
alter table public.expenses enable row level security;
alter table public.udhaar enable row level security;
alter table public.inventory enable row level security;
alter table public.staff enable row level security;

-- Table privileges are required in addition to RLS policies.
grant select, insert on public.sales, public.expenses, public.inventory to authenticated;
grant select, insert, update on public.udhaar to authenticated;
grant select, insert on public.staff to authenticated;

do $$ begin
  create policy "authenticated read sales" on public.sales for select to authenticated using (true);
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "authenticated insert sales" on public.sales for insert to authenticated with check (true);
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "authenticated read expenses" on public.expenses for select to authenticated using (true);
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "authenticated insert expenses" on public.expenses for insert to authenticated with check (true);
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "authenticated read udhaar" on public.udhaar for select to authenticated using (true);
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "authenticated insert udhaar" on public.udhaar for insert to authenticated with check (true);
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "authenticated update udhaar" on public.udhaar for update to authenticated using (true);
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "authenticated read inventory" on public.inventory for select to authenticated using (true);
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "authenticated insert inventory" on public.inventory for insert to authenticated with check (true);
exception when duplicate_object then null; end $$;

-- Staff can read their own access row; the owner can manage/read the staff list.
drop policy if exists "authenticated read staff" on public.staff;
drop policy if exists "authenticated insert staff" on public.staff;
drop policy if exists "staff read own or owner" on public.staff;
drop policy if exists "owner insert staff" on public.staff;
create policy "staff read own or owner" on public.staff
  for select to authenticated
  using (
    lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
    or lower(coalesce(auth.jwt() ->> 'email', '')) = 'thephulshop7@gmail.com'
  );
create policy "owner insert staff" on public.staff
  for insert to authenticated
  with check (lower(coalesce(auth.jwt() ->> 'email', '')) = 'thephulshop7@gmail.com');
