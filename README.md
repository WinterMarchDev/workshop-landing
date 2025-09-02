# Workshop

A minimal, professional private landing page with a password gate and a built-in feedback form that saves to Supabase.

## Dev quickstart

1. Install dependencies:
```bash
npm install
```

2. Generate a password hash and put it in `.env.local` as `WORKSHOP_PASSWORD_HASH`:
```bash
node -e "console.log(require('crypto').createHash('sha256').update(process.argv[1]).digest('hex'))" "your-secret-password"
```

3. Copy `.env.local.example` to `.env.local` and add your password hash.

4. (Optional) Create a `workshop_feedback` table in Supabase and set `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` in env.

5. Run the development server:
```bash
npm run dev
```

6. Open [http://localhost:3000](http://localhost:3000) with your browser.

## Deployment

Push to GitHub and connect on Vercel. Add environment variables in Vercel dashboard.

### Supabase table

```sql
create table if not exists public.workshop_feedback (
  id bigserial primary key,
  project text not null,
  email text,
  message text not null,
  user_agent text,
  url text,
  created_at timestamptz default now()
);
alter table public.workshop_feedback enable row level security;
```

### Notes

- Middleware enforces the password for all pages except `/login` and a few public assets.
- The cookie stores only the SHA-256 hash and expires in 30 days. Change the password when needed and redeploy.
- Robots.txt blocks indexing.
- Projects are placeholder examples - replace with your actual beta projects.