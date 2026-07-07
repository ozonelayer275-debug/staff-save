-- Run this in Supabase SQL Editor
-- Creates a secure function that returns all auth users (id + email + created_at)
-- Only callable by authenticated users who are in user_roles (admins)

create or replace function public.get_auth_users()
returns table (
  id   uuid,
  email text,
  created_at timestamptz
)
language sql
security definer
stable
as $$
  select id, email, created_at
  from auth.users
  order by created_at desc;
$$;

-- Revoke from public, grant only to authenticated
revoke execute on function public.get_auth_users() from public;
grant execute on function public.get_auth_users() to authenticated;
