-- Ejecutar como administrador en el MISMO proyecto de REANCLA.
-- No modifica tablas ni cuentas de REANCLA. Falla si no hay un único usuario
-- confirmado: en ese caso seleccionar su UUID explícitamente en el INSERT.
begin;
create table public.activecard_owner (
  singleton boolean primary key default true check (singleton),
  owner_id uuid not null unique references auth.users(id) on delete cascade
);
revoke all on public.activecard_owner from public, anon, authenticated;
alter table public.activecard_owner enable row level security;
do $$ begin
  if (select count(*) from auth.users where email_confirmed_at is not null and not coalesce(is_anonymous, false)) <> 1 then
    raise exception 'Seleccionar explicitamente el UUID de Martin antes de habilitar ActiveCard';
  end if;
end $$;
insert into public.activecard_owner(owner_id)
select id from auth.users where email_confirmed_at is not null and not coalesce(is_anonymous, false);

create function public.activecard_access() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.activecard_owner where owner_id = auth.uid());
$$;
revoke all on function public.activecard_access() from public, anon;
grant execute on function public.activecard_access() to authenticated;

create table public.activecard_sync (
  owner_id uuid primary key references auth.users(id) on delete cascade,
  revision bigint not null default 0 check (revision between 0 and 9007199254740991),
  manifest jsonb not null default '{"schema":1,"entries":[]}',
  last_change_id uuid,
  updated_at timestamptz not null default now()
);
alter table public.activecard_sync enable row level security;
revoke all on public.activecard_sync from public, anon, authenticated;
grant select on public.activecard_sync to authenticated;
create policy activecard_read on public.activecard_sync for select to authenticated
using (owner_id = (select auth.uid()) and (select public.activecard_access()));

insert into storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
values ('activecard-private', 'activecard-private', false, 1048576, array['text/plain']);
create policy activecard_blob_read on storage.objects for select to authenticated
using (bucket_id = 'activecard-private' and split_part(name, '/', 1) = (select auth.uid())::text and (select public.activecard_access()));
create policy activecard_blob_insert on storage.objects for insert to authenticated
with check (bucket_id = 'activecard-private' and name ~ ('^' || (select auth.uid())::text || '/[a-f0-9]{64}$') and (select public.activecard_access()));
-- Sin UPDATE ni DELETE: los fragmentos son inmutables. La app verifica SHA-256
-- antes de leerlos. El borrado administrativo debe conservar los referenciados.

create function public.activecard_commit(p_manifest jsonb, p_expected_revision bigint, p_change_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  row_state public.activecard_sync%rowtype;
  entry jsonb;
  part jsonb;
  seen text[] := array[]::text[];
  identity text;
begin
  if uid is null or not public.activecard_access() then raise exception 'Private account required' using errcode = '42501'; end if;
  if p_change_id is null or p_expected_revision is null or p_expected_revision < 0 or p_expected_revision >= 9007199254740991 then raise exception 'Invalid revision'; end if;
  if p_manifest is null or jsonb_typeof(p_manifest) <> 'object' or p_manifest->'schema' is distinct from '1'::jsonb
    or jsonb_typeof(p_manifest->'entries') is distinct from 'array'
    or exists(select 1 from jsonb_object_keys(p_manifest) k where k not in ('schema','entries'))
    or pg_catalog.octet_length(p_manifest::text) > 2000000 or jsonb_array_length(p_manifest->'entries') > 100000
    then raise exception 'Invalid manifest'; end if;
  for entry in select value from jsonb_array_elements(p_manifest->'entries') loop
    if jsonb_typeof(entry) <> 'array' or jsonb_array_length(entry) <> 3 or jsonb_typeof(entry->0) is distinct from 'string' or entry->>0 not in
      ('folders','decks','tags','cards','review_logs','connections','gym_chats','gym_messages','deck_tags')
      or jsonb_typeof(entry->1) <> 'string' or length(entry->>1) not between 1 and 512
      or jsonb_typeof(entry->2) <> 'array' or jsonb_array_length(entry->2) not between 1 and 1024
      then raise exception 'Invalid entry'; end if;
    if entry->>0 = 'deck_tags' and entry->>1 <> 'links' then raise exception 'Invalid links'; end if;
    identity := (entry->>0) || chr(10) || (entry->>1);
    if identity = any(seen) then raise exception 'Duplicate entry'; end if;
    seen := array_append(seen, identity);
    for part in select value from jsonb_array_elements(entry->2) loop
      if jsonb_typeof(part) <> 'string' or (part #>> '{}') !~ '^[a-f0-9]{64}$' or not exists (
        select 1 from storage.objects where bucket_id = 'activecard-private' and name = uid::text || '/' || (part #>> '{}')
      ) then raise exception 'Missing content'; end if;
    end loop;
  end loop;
  insert into public.activecard_sync(owner_id) values(uid) on conflict(owner_id) do nothing;
  select * into row_state from public.activecard_sync where owner_id = uid for update;
  if row_state.last_change_id = p_change_id then
    if row_state.manifest <> p_manifest then raise exception 'Change identifier reused'; end if;
    return jsonb_build_object('ok',true,'revision',row_state.revision);
  end if;
  if row_state.revision <> p_expected_revision then return jsonb_build_object('ok',false,'revision',row_state.revision); end if;
  update public.activecard_sync set manifest = p_manifest, revision = revision + 1,
    last_change_id = p_change_id, updated_at = now() where owner_id = uid returning * into row_state;
  return jsonb_build_object('ok',true,'revision',row_state.revision);
end;
$$;
revoke all on function public.activecard_commit(jsonb,bigint,uuid) from public, anon;
grant execute on function public.activecard_commit(jsonb,bigint,uuid) to authenticated;
commit;
