# Deployment Requirements

## Required Environment Variables

Set these in Vercel (and locally in `.env.local`):

```env
# Supabase - Required for slide image uploads
NEXT_PUBLIC_SUPABASE_URL=your-supabase-project-url
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Liveblocks - Required for real-time collaboration  
LIVEBLOCKS_SECRET_KEY=your-liveblocks-secret-key

# Anthropic - Required for AI beautification (optional)
ANTHROPIC_API_KEY=your-anthropic-api-key
```

## Supabase Storage Setup

1. **Create a public `slides` bucket** in Supabase Storage:
   - Go to Storage in your Supabase dashboard
   - Create a new bucket named `slides`
   - Make it PUBLIC (toggle "Public bucket" ON)
   - This is critical - the upload route will fail silently without it

2. **Verify bucket permissions**:
   - The bucket must allow public read access
   - Service role key must have write access

## Critical Code Checks

### 1. Upload Error Handling (✅ Already implemented)
File: `app/slides/[slug]/page.tsx` - `putRasterBackground()` function
- Checks `r.ok` before parsing response
- Throws descriptive errors on failure
- Prevents creating shapes with undefined URLs

### 2. Sync Timing (✅ Already implemented)  
File: `app/slides/[slug]/page.tsx` - Yjs sync effect
- `syncing = true` flag prevents updates during migration
- Only subscribes after `__wm_end_migration__()` is called
- Prevents websocket overload with large snapshots

### 3. Large Message Strategy (✅ Already implemented)
File: `app/Room.tsx`
- `largeMessageStrategy="split"` on LiveblocksProvider
- Allows chunking of large payloads

## Testing the Setup

1. **Check environment variables are loaded**:
   ```bash
   # Should see values (not undefined) in browser console
   console.log(process.env.NEXT_PUBLIC_SUPABASE_URL)
   ```

2. **Test upload endpoint directly**:
   - Open browser dev tools
   - Try importing slides 
   - Check Network tab for `/api/slides/upload` requests
   - Should see 200 responses with `{ url: "https://..." }`
   - If seeing 500 errors, check env vars and bucket setup

3. **Monitor for errors**:
   - Browser console for upload failures
   - Vercel Functions logs for server-side errors
   - Liveblocks dashboard for websocket issues

## Common Issues

- **"Only first slide loads"**: Missing env vars or bucket permissions
- **"Cannot split into chunks"**: Base64 data in shapes (shouldn't happen with error handling)
- **Empty frames**: Upload failures - check Supabase setup
- **Websocket disconnects**: Large payloads during migration (fixed by sync timing)