-- Create the auth_check_password RPC function
-- This function checks if a username/password combination is valid
-- Returns user data if valid, empty if invalid

CREATE OR REPLACE FUNCTION public.auth_check_password(
  p_username TEXT,
  p_password TEXT
)
RETURNS TABLE(id BIGINT, username TEXT, "User" TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user RECORD;
BEGIN
  -- Get user record
  SELECT * INTO v_user 
  FROM public.passwords 
  WHERE passwords.username = p_username;
  
  -- If no user found, return empty
  IF NOT FOUND THEN
    RETURN;
  END IF;
  
  -- Check password (prefer hash over plaintext)
  IF v_user.password_hash IS NOT NULL THEN
    -- Check bcrypt hash
    IF NOT public.crypt(p_password, v_user.password_hash) = v_user.password_hash THEN
      RETURN;
    END IF;
  ELSIF v_user.password IS NOT NULL THEN
    -- Fallback to plaintext comparison (for migration)
    IF v_user.password != p_password THEN
      RETURN;
    END IF;
  ELSE
    -- No password set
    RETURN;
  END IF;
  
  -- Return user data
  RETURN QUERY 
  SELECT v_user.id, v_user.username, v_user."User";
END;
$$;