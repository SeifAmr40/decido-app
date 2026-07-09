
-- Open rooms up for anonymous, guest-based access
DROP POLICY IF EXISTS "members read matches" ON public.matches;
DROP POLICY IF EXISTS "members read participants" ON public.participants;
DROP POLICY IF EXISTS "users join rooms" ON public.participants;
DROP POLICY IF EXISTS "users leave rooms" ON public.participants;
DROP POLICY IF EXISTS "members insert places" ON public.places;
DROP POLICY IF EXISTS "members read places" ON public.places;
DROP POLICY IF EXISTS "authenticated create rooms" ON public.rooms;
DROP POLICY IF EXISTS "host deletes rooms" ON public.rooms;
DROP POLICY IF EXISTS "host updates rooms" ON public.rooms;
DROP POLICY IF EXISTS "members read rooms" ON public.rooms;
DROP POLICY IF EXISTS "members read swipes" ON public.swipes;
DROP POLICY IF EXISTS "users create own swipes" ON public.swipes;

-- Grant anon read access; writes go through server functions (service role)
GRANT SELECT ON public.rooms, public.participants, public.places, public.swipes, public.matches TO anon, authenticated;

-- Anyone with a room id can read it
CREATE POLICY "anyone reads rooms" ON public.rooms FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "anyone reads participants" ON public.participants FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "anyone reads places" ON public.places FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "anyone reads swipes" ON public.swipes FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "anyone reads matches" ON public.matches FOR SELECT TO anon, authenticated USING (true);
