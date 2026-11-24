-- Run this entire file in Supabase SQL Editor
create table if not exists public.sales (id uuid primary key default gen_random_uuid(),amount numeric not null,customer text,note text,date date not null,created_by text,created_at timestamptz default now());
create table if not exists public.expenses (id uuid primary key default gen_random_uuid(),amount numeric not null,category text not null,note text,date date not null,created_by text,created_at timestamptz default now());
create table if not exists public.udhaar (id uuid primary key default gen_random_uuid(),customer text not null,balance numeric not null default 0,phone text,note text,created_by text,created_at timestamptz default now());
create table if not exists public.staff (id uuid primary key default gen_random_uuid(),email text unique not null,role text not null default 'staff',active boolean not null default true,created_at timestamptz default now());
create table if not exists public.orders (id uuid primary key default gen_random_uuid(),customer text not null,phone text not null,items text not null,amount numeric not null default 0,date date not null,delivery_date date,status text not null default 'pending',created_by text,created_at timestamptz default now());
alter table public.sales enable row level security;alter table public.expenses enable row level security;alter table public.udhaar enable row level security;alter table public.staff enable row level security;alter table public.orders enable row level security;
grants: grant select,insert on public.sales,public.expenses to authenticated;
