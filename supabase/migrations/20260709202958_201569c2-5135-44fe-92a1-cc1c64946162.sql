
ALTER TABLE public.participants DROP CONSTRAINT IF EXISTS participants_user_id_fkey;
ALTER TABLE public.swipes DROP CONSTRAINT IF EXISTS swipes_user_id_fkey;
ALTER TABLE public.rooms DROP CONSTRAINT IF EXISTS rooms_host_id_fkey;
