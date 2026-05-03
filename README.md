# LnkLokr - Cross-Platform Link Manager

A modern bookmark and link management application built with React, TypeScript, Vite, Tailwind CSS, and Supabase. Works as both a web app and a Chrome extension.

## Features

- **Reliable Authentication**: Email/password and Google OAuth with persistent sessions
- **Core Link Management**: Save, organize, and search links across all devices
- **Folders & Tags**: Organize links with custom folders and tags
- **Realtime Sync**: Changes sync instantly across all logged-in devices
- **Premium Features**: Upgrade option linked to external Shopify store
- **Chrome Extension**: Right-click context menu to save links from any webpage
- **PWA Ready**: Installable as a web app on desktop and Android

## Project Structure

```
lnklokr/
├── src/
│   ├── components/
│   │   ├── Auth/
│   │   │   ├── Login.tsx
│   │   │   └── SignUp.tsx
│   │   └── Dashboard/
│   │       ├── Dashboard.tsx
│   │       ├── LinkCard.tsx
│   │       ├── FolderGrid.tsx
│   │       ├── AddLinkModal.tsx
│   │       └── SettingsPanel.tsx
│   ├── context/
│   │   └── AuthContext.tsx      # Auth state management
│   ├── lib/
│   │   └── supabase.ts          # Supabase client
│   ├── types/
│   │   └── index.ts             # TypeScript types
│   ├── App.tsx                  # Main app component
│   ├── main.tsx                 # React entry point
│   ├── index.css                # Global styles
│   └── vite-env.d.ts            # Vite environment types
├── public/
│   └── manifest.json            # PWA manifest
├── background.js                # Chrome extension service worker
├── content.js                   # Chrome extension content script
├── popup.html                   # Chrome extension popup entry
├── index.html                   # Web app entry
├── manifest.json                # Chrome MV3 manifest
├── vite.config.ts               # Vite configuration
├── tsconfig.json                # TypeScript configuration
├── tailwind.config.js           # Tailwind CSS configuration
└── package.json                 # Dependencies and scripts
```

## Setup

### Prerequisites
- Node.js 16+
- Supabase account

### Environment Variables

Create `.env` file with Supabase credentials:
```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_SUPABASE_ANON_KEY=your-anon-key
```

### Installation

```bash
npm install
```

## Development

### Start Development Server
```bash
npm run dev
```

The app will be available at `http://localhost:5173`

### Build for Production
```bash
npm run build
```

Output is in the `dist/` folder.

## Database Schema

### users
- `id` (uuid): User ID from auth
- `email` (text): User email
- `is_premium` (boolean): Premium status
- `premium_until` (timestamptz): Premium expiration date
- `created_at` (timestamptz): Account creation date

### folders
- `id` (uuid): Folder ID
- `user_id` (uuid): Owner user ID
- `name` (text): Folder name
- `description` (text): Optional description
- `color` (text): Hex color code
- `icon` (text): Emoji or icon
- `position` (integer): Sort order

### tags
- `id` (uuid): Tag ID
- `user_id` (uuid): Owner user ID
- `name` (text): Tag name
- `color` (text): Hex color code

### links
- `id` (uuid): Link ID
- `user_id` (uuid): Owner user ID
- `folder_id` (uuid): Parent folder (optional)
- `url` (text): Link URL
- `title` (text): Link title
- `description` (text): Link description
- `image` (text): Thumbnail image URL
- `icon` (text): Favicon URL
- `tags` (text[]): Array of tag names
- `is_favorite` (boolean): Favorite flag
- `created_at` (timestamptz): Creation date

## Authentication

The app uses Supabase's built-in email/password and Google OAuth authentication. Session management is handled automatically:
- Sessions persist across browser refreshes
- Automatic token refresh on background tab switch
- No forced logouts on browser restart

## Chrome Extension

### Building for Chrome

1. Build the project: `npm run build`
2. Copy extension files to dist/:
   - `manifest.json`
   - `background.js`
   - `content.js`
   - `icons/` folder (add your PNG icons)
3. Open `chrome://extensions/`
4. Enable "Developer mode"
5. Click "Load unpacked" and select the `dist/` folder

### Features
- Right-click context menu to save links
- Right-click on images to save with preview
- Automatic link title and metadata detection
- Opens popup for quick actions

## Premium Features

Premium features are gated using the `is_premium` boolean in the users table. To mark a user as premium:

1. User clicks "Upgrade to Premium" button
2. The client calls the `/api/stripe/create-checkout-session` Vercel
   serverless route, which creates a Stripe Checkout Session and returns
   the hosted Checkout URL.
3. The Stripe webhook handler at `/api/stripe/webhook` (configured in
   `vercel.json`) verifies the event signature and flips the user's
   `is_premium` flag in Supabase. You can also update it manually:
   ```sql
   UPDATE users SET is_premium = true WHERE email = 'user@example.com'
   ```

Or set an expiration date:
```sql
UPDATE users SET premium_until = now() + interval '1 year' WHERE email = 'user@example.com'
```

## Supabase RLS Policies

All tables have Row Level Security (RLS) enabled:
- Users can only read/write their own data
- Authenticated users required for all operations
- Automatic user_id filtering prevents data leakage

## Development Tips

### Disable Web Locks (Optional)

If you encounter session issues in development, disable web locks:
```typescript
// In supabase.ts
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
    storage: localStorage,
  },
})
```

### Testing Auth

1. Create an account with email/password
2. Test session persistence by:
   - Refreshing the page
   - Opening in new tab
   - Closing and reopening browser
3. Test Google OAuth flow

### Realtime Updates

Links sync in real-time using Supabase Realtime subscriptions. The Dashboard component subscribes to link changes for the current user.

## Future Enhancements

- Native Android app using React Native
- Advanced search filters
- Link previews
- Collaborative link sharing
- Browser sync across Chrome, Firefox, Safari
- Mobile app for iOS

## License

MIT
