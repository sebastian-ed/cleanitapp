-- Clean It Diluciones - Supabase schema
-- Ejecutar en Supabase SQL Editor.

create extension if not exists pgcrypto;

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  category text not null default 'Sin categoría',
  product_type text,
  short_description text,
  validity text,
  ready_to_use boolean not null default false,
  status text not null default 'active' check (status in ('active', 'draft', 'archived')),
  sort_order integer not null default 100,
  source_url text,
  source_label text default 'Ficha técnica',
  surfaces jsonb not null default '[]'::jsonb,
  instructions jsonb not null default '[]'::jsonb,
  precautions jsonb not null default '[]'::jsonb,
  dilutions jsonb not null default '[]'::jsonb,
  packaging jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.admin_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  role text not null default 'admin' check (role in ('admin', 'superadmin')),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists products_status_sort_idx on public.products(status, sort_order);
create index if not exists admin_profiles_status_idx on public.admin_profiles(status);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists products_set_updated_at on public.products;
create trigger products_set_updated_at
before update on public.products
for each row execute function public.set_updated_at();

drop trigger if exists admin_profiles_set_updated_at on public.admin_profiles;
create trigger admin_profiles_set_updated_at
before update on public.admin_profiles
for each row execute function public.set_updated_at();

create or replace function public.handle_new_admin_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.admin_profiles (user_id, email, role, status)
  values (new.id, coalesce(new.email, ''), 'admin', 'pending')
  on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created_admin_profile on auth.users;
create trigger on_auth_user_created_admin_profile
after insert on auth.users
for each row execute function public.handle_new_admin_user();

create or replace function public.is_approved_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.admin_profiles
    where user_id = auth.uid()
      and status = 'approved'
      and role in ('admin', 'superadmin')
  );
$$;

create or replace function public.is_superadmin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.admin_profiles
    where user_id = auth.uid()
      and status = 'approved'
      and role = 'superadmin'
  );
$$;

alter table public.products enable row level security;
alter table public.admin_profiles enable row level security;

-- Products: lectura pública solo para activos. Admin aprobado gestiona todo.
drop policy if exists "Public can read active products" on public.products;
create policy "Public can read active products"
on public.products for select
using (status = 'active');

drop policy if exists "Approved admins can read all products" on public.products;
create policy "Approved admins can read all products"
on public.products for select
using (public.is_approved_admin());

drop policy if exists "Approved admins can insert products" on public.products;
create policy "Approved admins can insert products"
on public.products for insert
with check (public.is_approved_admin());

drop policy if exists "Approved admins can update products" on public.products;
create policy "Approved admins can update products"
on public.products for update
using (public.is_approved_admin())
with check (public.is_approved_admin());

drop policy if exists "Approved admins can delete products" on public.products;
create policy "Approved admins can delete products"
on public.products for delete
using (public.is_approved_admin());

-- Admin profiles: cada usuario ve su estado; superadmin ve y modifica todo.
drop policy if exists "Users can read own admin profile" on public.admin_profiles;
create policy "Users can read own admin profile"
on public.admin_profiles for select
using (auth.uid() = user_id or public.is_superadmin());

drop policy if exists "Superadmins can update admin profiles" on public.admin_profiles;
create policy "Superadmins can update admin profiles"
on public.admin_profiles for update
using (public.is_superadmin())
with check (public.is_superadmin());

drop policy if exists "Superadmins can insert admin profiles" on public.admin_profiles;
create policy "Superadmins can insert admin profiles"
on public.admin_profiles for insert
with check (public.is_superadmin());

drop policy if exists "Superadmins can delete admin profiles" on public.admin_profiles;
create policy "Superadmins can delete admin profiles"
on public.admin_profiles for delete
using (public.is_superadmin());

-- Después de crear tu usuario en la app, reemplazá el email y ejecutá una sola vez:
-- update public.admin_profiles
-- set status = 'approved', role = 'superadmin'
-- where email = 'TU_EMAIL_ADMIN@DOMINIO.COM';
