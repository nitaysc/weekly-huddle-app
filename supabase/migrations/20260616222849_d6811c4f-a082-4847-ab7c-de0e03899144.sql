ALTER TABLE public.crew_members ADD CONSTRAINT crew_members_user_id_profiles_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
NOTIFY pgrst, 'reload schema';