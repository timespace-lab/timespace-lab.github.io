-- =====================================================================
-- 시공간 LAB 계정 저장 설정
-- Supabase 대시보드 → SQL Editor 에서 한 번 실행하세요.
-- 다른 앱과 같은 프로젝트를 쓰더라도 겹치지 않도록 모든 이름에 sg_ 를 붙였습니다.
--
-- 역할 분리
--   인증: Supabase Auth (Google, 이메일 로그인 링크)
--   DB  : public.sg_studies  (탐구 1건 = 지도 1개 또는 연표 1개, 내용은 jsonb)
--   사진: Storage 버킷 sigonggan-photos  (경로 <사용자 id>/<사진 id>.jpg)
--         DB에는 사진 파일이 아니라 경로(photo_paths, data 안의 photo.path)만 남습니다.
-- =====================================================================

create table if not exists public.sg_studies (
  id          uuid primary key default gen_random_uuid(),
  owner       uuid not null default auth.uid() references auth.users(id) on delete cascade,
  kind        text not null check (kind in ('map', 'timeline')),
  title       text not null default '' check (char_length(title) <= 120),
  description text not null default '' check (char_length(description) <= 2000),
  data        jsonb not null default '{}'::jsonb check (pg_column_size(data) < 2000000),
  photo_paths text[] not null default '{}',
  format      int  not null default 2,
  version     int  not null default 1,
  share_mode  text not null default 'private' check (share_mode in ('private', 'view', 'copy')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists sg_studies_owner_updated_idx on public.sg_studies (owner, updated_at desc);

-- 수정 시각은 서버가 정하고, 주인(owner)과 만든 시각은 바꿀 수 없게 한다
create or replace function public.sg_touch() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  if tg_op = 'UPDATE' then
    new.owner := old.owner;
    new.created_at := old.created_at;
  end if;
  return new;
end $$;
drop trigger if exists sg_studies_touch on public.sg_studies;
create trigger sg_studies_touch before insert or update on public.sg_studies
  for each row execute function public.sg_touch();

-- ---------- 행 수준 보안: 로그인한 사람은 자기 탐구만 읽고 고친다 ----------
alter table public.sg_studies enable row level security;

drop policy if exists "sg_studies select own" on public.sg_studies;
create policy "sg_studies select own" on public.sg_studies
  for select to authenticated using (owner = (select auth.uid()));

drop policy if exists "sg_studies insert own" on public.sg_studies;
create policy "sg_studies insert own" on public.sg_studies
  for insert to authenticated with check (owner = (select auth.uid()));

drop policy if exists "sg_studies update own" on public.sg_studies;
create policy "sg_studies update own" on public.sg_studies
  for update to authenticated using (owner = (select auth.uid())) with check (owner = (select auth.uid()));

drop policy if exists "sg_studies delete own" on public.sg_studies;
create policy "sg_studies delete own" on public.sg_studies
  for delete to authenticated using (owner = (select auth.uid()));

-- ---------- 공유 링크: ID를 아는 사람에게만 한 건을 돌려준다 ----------
-- (공유된 탐구 목록 전체를 아무나 조회하지 못하도록 select 정책 대신 함수로 연다)
create or replace function public.sg_get_shared(p_id uuid)
returns setof public.sg_studies
language sql stable security definer set search_path = '' as $$
  select * from public.sg_studies where id = p_id and share_mode <> 'private';
$$;
revoke all on function public.sg_get_shared(uuid) from public;
grant execute on function public.sg_get_shared(uuid) to anon, authenticated;

-- 공유된 탐구에 쓰인 사진인지 확인 (스토리지 정책에서 사용)
create or replace function public.sg_photo_is_shared(p_path text)
returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.sg_studies s
    where s.share_mode <> 'private'
      and p_path = any (s.photo_paths)
      and split_part(p_path, '/', 1) = s.owner::text
  );
$$;
revoke all on function public.sg_photo_is_shared(text) from public;
grant execute on function public.sg_photo_is_shared(text) to anon, authenticated;

-- ---------- 사진 스토리지 (비공개 버킷, 5MB·이미지 형식만) ----------
-- 앱이 올리기 전에 긴 변 1600px, 약 1.2MB 이하 JPEG로 줄이므로 5MB 제한에 걸리지 않습니다.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('sigonggan-photos', 'sigonggan-photos', false, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "sg photos read own" on storage.objects;
create policy "sg photos read own" on storage.objects
  for select to authenticated
  using (bucket_id = 'sigonggan-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "sg photos insert own" on storage.objects;
create policy "sg photos insert own" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'sigonggan-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "sg photos update own" on storage.objects;
create policy "sg photos update own" on storage.objects
  for update to authenticated
  using (bucket_id = 'sigonggan-photos' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'sigonggan-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "sg photos delete own" on storage.objects;
create policy "sg photos delete own" on storage.objects
  for delete to authenticated
  using (bucket_id = 'sigonggan-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "sg photos read shared" on storage.objects;
create policy "sg photos read shared" on storage.objects
  for select to anon, authenticated
  using (bucket_id = 'sigonggan-photos' and public.sg_photo_is_shared(name));
