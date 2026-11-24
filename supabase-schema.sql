-- SAFE SCHEMA UPDATE: only adds missing columns/tables and policies
create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(), customer text not null, phone text not null,
  items text not null, amount numeric not null default 0, date date not null,
  delivery_date date, status text not null default 'pending', created_by text, created_at timestamptz default now()
);
alter table public.sales add column if not exists payment_method text;
alter table public.expenses add column if not exists payment_method text;
create table if not exists public.cash_bank_settings (
  id integer primary key check (id=1), opening_cash numeric not null default 0,
  opening_bank numeric not null default 0, updated_by text, updated_at timestamptz not null default now()
);
insert into public.cash_bank_settings (id,opening_cash,opening_bank) values (1,0,0) on conflict (id) do nothing;
alter table public.sales enable row level security;
alter table public.expenses enable row level security;
alter table public.udhaar enable row level security;
alter table public.staff enable row level security;
alter table public.orders enable row level security;
alter table public.cash_bank_settings enable row level security;
grant select,insert on public.sales,public.expenses to authenticated;
grant select,insert,update on public.udhaar to authenticated;
grant select,insert on public.staff to authenticated;
grant select,insert,update on public.orders to authenticated;
grant select,update on public.cash_bank_settings to authenticated;
