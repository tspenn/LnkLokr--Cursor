/*
  # Add automatic user profile creation

  1. Changes
    - Creates a trigger function that automatically creates a user profile when a new auth user is created
    - Adds a trigger on auth.users that calls this function
  
  2. Security
    - Function runs with security definer to allow inserting into users table
    - Only creates profile if one doesn't already exist
*/

-- Create function to handle new user creation
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.users (id, email, is_premium, premium_until)
  VALUES (new.id, new.email, false, null)
  ON CONFLICT (id) DO NOTHING;
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger on auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();