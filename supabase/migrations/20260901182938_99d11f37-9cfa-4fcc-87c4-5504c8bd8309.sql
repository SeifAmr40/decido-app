-- Remove public read access; reads now go through membership-verified server functions
DROP POLICY IF EXISTS "anyone reads rooms" ON public.rooms;
DROP POLICY IF EXISTS "anyone reads places" ON public.places;
DROP POLICY IF EXISTS "anyone reads swipes" ON public.swipes;
DROP POLICY IF EXISTS "anyone reads matches" ON public.matches;
DROP POLICY IF EXISTS "anyone reads participants" ON public.participants;

CREATE POLICY "no direct client read on rooms" ON public.rooms FOR SELECT TO anon, authenticated USING (false);
CREATE POLICY "no direct client read on places" ON public.places FOR SELECT TO anon, authenticated USING (false);
CREATE POLICY "no direct client read on swipes" ON public.swipes FOR SELECT TO anon, authenticated USING (false);
CREATE POLICY "no direct client read on matches" ON public.matches FOR SELECT TO anon, authenticated USING (false);
CREATE POLICY "no direct client read on participants" ON public.participants FOR SELECT TO anon, authenticated USING (false);

-- Profiles: own row only
DROP POLICY IF EXISTS "Authenticated users can view profiles" ON public.profiles;
CREATE POLICY "users view own profile" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = id);

GRANT ALL ON public.rooms TO service_role;
GRANT ALL ON public.places TO service_role;
GRANT ALL ON public.swipes TO service_role;
GRANT ALL ON public.matches TO service_role;
GRANT ALL ON public.participants TO service_role;
GRANT ALL ON public.profiles TO service_role;