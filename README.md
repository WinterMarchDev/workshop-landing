# Workshop

A minimal, professional private landing page with Supabase authentication and a built-in feedback form.

## Dev quickstart

1. Install dependencies:
```bash
npm install
```

2. Set up environment variables. Copy `.env.local.example` to `.env.local` and add:
   - `NEXT_PUBLIC_SUPABASE_URL` - Your Supabase project URL
   - `SUPABASE_SERVICE_ROLE_KEY` - Your Supabase service role key
   - `SESSION_SECRET` - A random secret for signing session cookies (generate with `openssl rand -base64 32`)

3. Create the required database tables in Supabase (see Database Setup below)

4. Add users to the `passwords` table (see User Management below)

5. Run the development server:
```bash
npm run dev
```

6. Open [http://localhost:3000](http://localhost:3000) with your browser.

## Database Setup

### 1. Passwords table (for authentication)

```sql
CREATE TABLE public.passwords (
  id BIGSERIAL PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  "User" TEXT,
  password_hash TEXT,  -- bcrypt hash (recommended)
  password TEXT,       -- legacy plaintext (for migration)
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.passwords ENABLE ROW LEVEL SECURITY;
```

### 2. Feedback table (for project feedback)

```sql
CREATE TABLE public.workshop_feedback (
  id BIGSERIAL PRIMARY KEY,
  project TEXT NOT NULL,
  email TEXT,
  message TEXT NOT NULL,
  user_agent TEXT,
  url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.workshop_feedback ENABLE ROW LEVEL SECURITY;
```

## User Management

### Adding new users

1. **Generate a password hash** (recommended):
```bash
# Using the provided script
node scripts/hash-password.js "user-password"

# Or as a one-liner
node -e "import('bcryptjs').then(b => b.hash('user-password', 12).then(console.log))"
```

2. **Insert the user into Supabase**:
```sql
-- With bcrypt hash (secure)
INSERT INTO public.passwords (username, password_hash) 
VALUES ('username', '$2a$12$...');

-- During migration (temporary, upgrade to hash ASAP)
INSERT INTO public.passwords (username, password) 
VALUES ('username', 'plaintext-password');
```

### Migrating from plaintext to hashed passwords

The auth system supports both formats during migration:
1. Add users with plaintext passwords initially
2. Generate bcrypt hashes using the script
3. Update the `password_hash` column and clear the `password` column
4. The system will automatically use the hash if available

## Deployment

Push to GitHub and connect on Vercel. Add all required environment variables in Vercel dashboard:
- `NEXT_PUBLIC_SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SESSION_SECRET`

## Security Notes

- Sessions use signed cookies with HMAC-SHA256 verification
- Passwords are verified using bcrypt (or constant-time comparison for legacy plaintext)
- Session cookies expire after 7 days
- All authentication happens server-side
- The middleware verifies signatures using Edge-safe Web Crypto API