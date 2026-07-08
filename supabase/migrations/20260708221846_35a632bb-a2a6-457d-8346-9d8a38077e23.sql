
-- profiles
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  avatar_url text,
  preferred_language text default 'en',
  theme text default 'light',
  favorite_categories text[] default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update, delete on public.profiles to authenticated;
grant all on public.profiles to service_role;
grant select on public.profiles to anon;
alter table public.profiles enable row level security;
create policy "profiles are viewable by everyone" on public.profiles for select using (true);
create policy "users update own profile" on public.profiles for update using (auth.uid() = id);
create policy "users insert own profile" on public.profiles for insert with check (auth.uid() = id);

-- rooms
create table public.rooms (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  host_id uuid not null references auth.users(id) on delete cascade,
  name text,
  category text,
  latitude double precision,
  longitude double precision,
  radius_meters integer default 2000,
  status text not null default 'lobby',
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.rooms to authenticated;
grant all on public.rooms to service_role;
alter table public.rooms enable row level security;

-- participants
create table public.participants (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  joined_at timestamptz not null default now(),
  unique(room_id, user_id)
);
grant select, insert, update, delete on public.participants to authenticated;
grant all on public.participants to service_role;
alter table public.participants enable row level security;

-- Security definer function to check membership
create or replace function public.is_room_member(_room_id uuid, _user_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.participants where room_id = _room_id and user_id = _user_id)
$$;

-- rooms policies
create policy "members read rooms" on public.rooms for select using (
  public.is_room_member(id, auth.uid()) or host_id = auth.uid()
);
create policy "authenticated create rooms" on public.rooms for insert with check (auth.uid() = host_id);
create policy "host updates rooms" on public.rooms for update using (auth.uid() = host_id);
create policy "host deletes rooms" on public.rooms for delete using (auth.uid() = host_id);

-- participants policies
create policy "members read participants" on public.participants for select using (
  public.is_room_member(room_id, auth.uid())
);
create policy "users join rooms" on public.participants for insert with check (auth.uid() = user_id);
create policy "users leave rooms" on public.participants for delete using (auth.uid() = user_id);

-- places (cached from google)
create table public.places (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  google_place_id text not null,
  name text not null,
  address text,
  latitude double precision,
  longitude double precision,
  rating numeric,
  price_level integer,
  photo_url text,
  category text,
  raw jsonb,
  created_at timestamptz not null default now(),
  unique(room_id, google_place_id)
);
grant select, insert, update, delete on public.places to authenticated;
grant all on public.places to service_role;
alter table public.places enable row level security;
create policy "members read places" on public.places for select using (public.is_room_member(room_id, auth.uid()));
create policy "members insert places" on public.places for insert with check (public.is_room_member(room_id, auth.uid()));

-- swipes
create table public.swipes (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  place_id uuid not null references public.places(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  direction text not null check (direction in ('left','right')),
  created_at timestamptz not null default now(),
  unique(room_id, place_id, user_id)
);
grant select, insert, update, delete on public.swipes to authenticated;
grant all on public.swipes to service_role;
alter table public.swipes enable row level security;
create policy "members read swipes" on public.swipes for select using (public.is_room_member(room_id, auth.uid()));
create policy "users create own swipes" on public.swipes for insert with check (auth.uid() = user_id and public.is_room_member(room_id, auth.uid()));

-- matches
create table public.matches (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  place_id uuid not null references public.places(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique(room_id, place_id)
);
grant select, insert, update, delete on public.matches to authenticated;
grant all on public.matches to service_role;
alter table public.matches enable row level security;
create policy "members read matches" on public.matches for select using (public.is_room_member(room_id, auth.uid()));

-- match trigger: when everyone in the room swipes right on a place, create a match
create or replace function public.check_match() returns trigger language plpgsql security definer set search_path = public as $$
declare
  member_count int;
  right_count int;
begin
  if new.direction <> 'right' then return new; end if;
  select count(*) into member_count from public.participants where room_id = new.room_id;
  select count(*) into right_count from public.swipes where room_id = new.room_id and place_id = new.place_id and direction = 'right';
  if member_count > 0 and right_count >= member_count then
    insert into public.matches(room_id, place_id) values (new.room_id, new.place_id) on conflict do nothing;
  end if;
  return new;
end $$;
create trigger swipes_check_match after insert on public.swipes for each row execute function public.check_match();

-- favorites
create table public.favorites (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  google_place_id text not null,
  name text not null,
  address text,
  photo_url text,
  latitude double precision,
  longitude double precision,
  category text,
  created_at timestamptz not null default now(),
  unique(user_id, google_place_id)
);
grant select, insert, update, delete on public.favorites to authenticated;
grant all on public.favorites to service_role;
alter table public.favorites enable row level security;
create policy "users manage own favorites" on public.favorites for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- profile auto-create trigger
create or replace function public.handle_new_user() returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name, avatar_url)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', split_part(new.email,'@',1)), new.raw_user_meta_data->>'avatar_url')
  on conflict (id) do nothing;
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

-- realtime
alter publication supabase_realtime add table public.rooms;
alter publication supabase_realtime add table public.participants;
alter publication supabase_realtime add table public.places;
alter publication supabase_realtime add table public.swipes;
alter publication supabase_realtime add table public.matches;
