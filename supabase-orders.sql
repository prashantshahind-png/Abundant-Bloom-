-- Orders and existing app tables
create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  customer text not null,
  phone text not null,
  items text not null,
  amount numeric not null default 0,
  date date not null,
  delivery_date date,
  status text not null default 'pending',
  created_by text,
  created_at timestamptz default now()
);
alter table public.orders enable row level security;
grant select, insert, update on public.orders to authenticated;
do $$ begin
  create policy "authenticated read orders" on public.orders for select to authenticated using (true);
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "authenticated insert orders" on public.orders for insert to authenticated with check (true);
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "authenticated update orders" on public.orders for update to authenticated using (true);
exception when duplicate_object then null; end $$;
