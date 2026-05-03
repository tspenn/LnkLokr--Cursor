# LnkLokr Setup Guide

## Quick Start

### 1. Install Dependencies
```bash
npm install
```

### 2. Set Environment Variables
Create a `.env` file in the project root:
```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_SUPABASE_ANON_KEY=your-anon-key
```

Get these from your Supabase dashboard → Settings → API.

### 3. Start Development Server
```bash
npm run dev
```

Visit `http://localhost:5173` to access the web app.

### 4. Build for Production
```bash
npm run build
```

## Chrome Extension Setup

### Development Mode

1. **Build the project**:
   ```bash
   npm run build
   ```

2. **Add icon files**:
   - Create `icons/` directory
   - Add these PNG files:
     - `icon-16.png` (16x16px)
     - `icon-48.png` (48x48px)
     - `icon-128.png` (128x128px)

   You can use simple branded icons or download from online icon libraries.

3. **Copy extension files to dist**:
   ```bash
   cp manifest.json background.js content.js dist/
   cp -r icons dist/
   ```

4. **Load in Chrome**:
   - Open `chrome://extensions/`
   - Enable "Developer mode" (top right)
   - Click "Load unpacked"
   - Select the `dist/` folder

5. **Test the extension**:
   - Right-click on any page
   - Select "Save link to LnkLokr" or "Save selection to LnkLokr"
   - The popup should open in a small window
   - Click the extension icon to open the full popup

### Building for Distribution

1. **Prepare the extension**:
   ```bash
   npm run build
   cp manifest.json background.js content.js dist/
   cp -r icons dist/
   ```

2. **Create a zip file**:
   ```bash
   cd dist
   zip -r lnklokr-extension.zip .
   cd ..
   ```

3. **Upload to Chrome Web Store**:
   - Go to [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole)
   - Create new item
   - Upload the zip file
   - Add screenshots and description

## PWA (Web App)

### Install Icons

Add PWA icons to `public/icons/`:
- `icon-192.png` (192x192px)
- `icon-512.png` (512x512px)
- `icon-192-maskable.png` (maskable format)
- `icon-512-maskable.png` (maskable format)

Add screenshots to `public/screenshots/`:
- `screenshot-540.png` (540x720px, mobile)
- `screenshot-1280.png` (1280x720px, desktop)

### Install as App

**Chrome/Edge:**
- Click the install icon in the address bar
- Or: Menu → "Install LnkLokr"

**Android:**
- Open in Chrome
- Menu → "Install app"
- Appears on home screen

## Database Setup

The database schema is automatically created when you first run the migrations. Ensure you have:

1. Supabase project created
2. Correct URL and API key in `.env`
3. Run: `npm run build` (migrations execute at deployment)

### Manual Database Setup (if needed)

Connect to Supabase and run:
```sql
-- Tables are created with the migration system
-- Just verify RLS is enabled on all tables
SELECT tablename FROM pg_tables WHERE schemaname = 'public';
```

## Authentication

### Email/Password
- Sign up with email and password
- Min 6 characters for password
- Automatic login on signup

### Google OAuth
1. Set up in Supabase → Authentication → Providers
2. Add Google OAuth credentials
3. Users click "Continue with Google"
4. Redirect back to app after auth

## Premium Features

### Setting Premium Status

After user purchases on Shopify, update in Supabase:

```sql
-- Grant premium for 1 year
UPDATE users
SET
  is_premium = true,
  premium_until = now() + interval '1 year'
WHERE email = 'user@example.com';

-- Or grant indefinite premium
UPDATE users
SET is_premium = true
WHERE email = 'user@example.com';
```

### Using Premium Features in Code

```typescript
import { useAuth } from '@/context/AuthContext'

function MyComponent() {
  const { user } = useAuth()

  if (!user?.is_premium) {
    return <UpgradePrompt />
  }

  return <PremiumFeature />
}
```

## Troubleshooting

### Session Lost After Refresh
- Check `.env` variables are correct
- Ensure Supabase project is active
- Clear browser cache and localStorage
- Check browser console for CORS errors

### Extension Not Loading
- Verify `manifest.json` is in `dist/` folder
- Check extension icon files exist in `dist/icons/`
- Look for errors in `chrome://extensions/` page
- Try disabling and re-enabling the extension

### Build Errors
- Run: `npm install` to ensure all dependencies
- Delete `node_modules` and `dist`, then reinstall
- Check Node.js version is 16+
- Clear Vite cache: `npm run build -- --force`

### Google OAuth Not Working
- Verify OAuth provider is enabled in Supabase
- Check redirect URL matches Supabase settings
- Ensure public/private key pair is configured
- Check browser console for errors

## Development Workflow

1. **Start dev server**: `npm run dev`
2. **Edit components** in `src/`
3. **Hot reload** automatically on save
4. **Test auth** with test accounts
5. **Test realtime** by opening app in multiple tabs
6. **Build for testing**: `npm run build`

## File Organization

- `src/` - React app source code
- `src/components/` - React components
- `src/context/` - State management (Auth)
- `src/lib/` - Utilities (Supabase client)
- `src/types/` - TypeScript type definitions
- `public/` - Static assets (icons, manifest)
- `dist/` - Built output (created by `npm run build`)

## Future: React Native / Expo

To prepare for React Native expansion:

```typescript
// In component files, use:
import { Platform } from 'react-native' // when available
import { useAuth } from '@/context/AuthContext' // shared context

// Supabase client works on React Native too
// Just use conditional imports for web-only features
```

## Support

For issues or questions:
1. Check the [LnkLokr docs](https://lnklokr.vercel.app)
2. Visit Supabase documentation
3. Check the code comments in source files
4. Review Chrome extension developer docs
