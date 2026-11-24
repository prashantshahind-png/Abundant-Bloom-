-- Run this entire file in Supabase SQL Editor. Existing transaction rows with a NULL payment_method are
-- historical entries and are intentionally excluded from cash/bank totals until classified.
create table if not exists public.sales (
  id uuid primary key default gen_random_uuid(), amount numeric not null, customer text, note text,
  date date not null, payment_method text check (payment_method in ('cash','bank')),
  created_by text, created_at timestamptz default now()
);
create table if not exists public.expenses (
  id uuid primary key default gen_random_uuid(), amount numeric not null, category text not null,
  note text, date date not null, payment_method text check (payment_method in ('cash','bank')),
  created_by text, created_at timestamptz default now()
);
create table if not exists public.udhaar (
  id uuid primary key default gen_random_uuid(), customer text not null,
  balance numeric not null default 0, phone text, note text, created_by text, created_at timestamptz default now()
);
create table if not exists public.staff (
  id uuid primary key default gen_random_uuid(), email text unique not null,
  role text not null default 'staff', active boolean not null default true, created_at timestamptz default now()
);
create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(), customer text not null, phone text not null,
  items text not null, amount numeric not null default 0, date date not null,
  delivery_date date, status text not null default 'pending', created_by text, created_at timestamptz default now()
);

-- Adds the columns safely to projects that already had sales/expenses tables.
alter table public.sales add column if not exists payment_method text check (payment_method in ('cash','bank'));
alter table public.expenses add column if not exists payment_method text check (payment_method in ('cash','bank'));

create table if not exists public.cash_bank_settings (
  id integer primary key check (id = 1),
  opening_cash numeric not null default 0,
  opening_bank numeric not null default 0,
  updated_by text,
  updated_at timestamptz not null default now()
);
insert into public.cash_bank_settings (id, opening_cash, opening_bank) values (1, 0, 0) on conflict (id) do nothing;

alter table public.sales enable row level security;
alter table public.expenses enable row level security;
alter table public.udhaar enable row level security;
alter table public.staff enable row level security;
alter table public.orders enable row level security;
alter table public.cash_bank_settings enable row level security;

grant select, insert on public.sales, public.expenses to authenticated;
grant select, insert, update on public.udhaar to authenticated;
grant select, insert on public.staff to authenticated;
grant select, insert, update on public.orders to authenticated;
grant select, update on public.cash_bank_settings to authenticated;

drop policy if exists "authenticated read sales" on public.sales;
drop policy if exists "authenticated insert sales" on public.sales;
drop policy if exists "authenticated read expenses" on public.expenses;
drop policy if exists "authenticated insert expenses" on public.expenses;
drop policy if exists "authenticated read udhaar" on public.udhaar;
drop policy if exists "authenticated insert udhaar" on public.udhaar;
drop policy if exists "authenticated update udhaar" on public.udhaar;
drop policy if exists "authenticated read staff" on public.staff;
drop policy if exists "authenticated insert staff" on public.staff;
drop policy if exists "staff read own or owner" on public.staff;
drop policy if exists "owner insert staff" on public.staff;
drop policy if exists "authenticated read orders" on public.orders;
drop policy if exists "authenticated insert orders" on public.orders;
drop policy if exists "authenticated update orders" on public.orders;
drop policy if exists "authenticated read cash bank settings" on public.cash_bank_settings;
drop policy if exists "owner update cash bank settings" on public.cash_bank_settings;

create policy "authenticated read sales" on public.sales for select to authenticated using (true);
create policy "authenticated insert sales" on public.sales for insert to authenticated with check (true);
create policy "authenticated read expenses" on public.expenses for select to authenticated using (true);
create policy "authenticated insert expenses" on public.expenses for insert to authenticated with check (true);
create policy "authenticated read udhaar" on public.udhaar for select to authenticated using (true);
create policy "authenticated insert udhaar" on public.udhaar for insert to authenticated with check (true);
create policy "authenticated update udhaar" on public.udhaar for update to authenticated using (true);
create policy "staff read own or owner" on public.staff for select to authenticated using (
  lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  or lower(coalesce(auth.jwt() ->> 'email', '')) = 'thephulshop7@gmail.com'
);
create policy "owner insert staff" on public.staff for insert to authenticated with check (
  lower(coalesce(auth.jwt() ->> 'email', '')) = 'thephulshop7@gmail.com'
);
create policy "authenticated read orders" on public.orders for select to authenticated using (true);
create policy "authenticated insert orders" on public.orders for insert to authenticated with check (true);
create policy "authenticated update orders" on public.orders for update to authenticated using (true);
create policy "authenticated read cash bank settings" on public.cash_bank_settings for select to authenticated using (true);
create policy "owner update cash bank settings" on public.cash_bank_settings for update to authenticated using (
  lower(coalesce(auth.jwt() ->> 'email', '')) = 'thephulshop7@gmail.com'
) with check (
  lower(coalesce(auth.jwt() ->> 'email', '')) = 'thephulshop7@gmail.com' and id = 1
);
