# LnkLokr Features

## Authentication & Sessions

### Email/Password Authentication
- **Sign Up**: Create account with email and password
- **Sign In**: Log in with existing credentials
- **Password Requirements**: Minimum 6 characters
- **Automatic Login**: Users are automatically logged in after signup
- **Persistent Sessions**: Sessions survive browser refresh, tab switching, and restart

### Google OAuth
- **One-Click Sign Up**: "Continue with Google" button
- **Profile Auto-Fill**: Name and email from Google account
- **Automatic Redirect**: Returns to app after authentication
- **Account Linking**: Google can be linked to existing email account

### Session Management
- **Auto Token Refresh**: Tokens refresh automatically in the background
- **No Forced Logouts**: Sessions persist across page refreshes
- **Multi-Tab Support**: Stay logged in across multiple tabs
- **Secure**: Uses HTTPS and secure HTTP-only cookies

## Core Link Management

### Save Links
- **Manual Entry**: Add URL, title, description manually
- **Context Menu**: Right-click any link or image to save (Extension)
- **Auto Metadata**: System attempts to extract title and description
- **Image Preview**: Saves thumbnail of linked page or image
- **Favicon Support**: Stores website icon for quick identification

### Organize Links
- **Folders**: Create custom folders to group related links
- **Nested Organization**: Links within folders
- **Folder Icons**: Customize with emojis
- **Folder Colors**: Color-code folders for visual organization
- **Custom Sorting**: Manually reorder folders

### Tags & Categories
- **Add Multiple Tags**: Tag links for cross-cutting categorization
- **Auto-Complete**: Suggestions based on existing tags
- **Tag Colors**: Color-code tags for visual identification
- **Search by Tags**: Filter links by specific tags
- **Tag Management**: View and manage all tags

### Favorites
- **Heart Icon**: Mark important links as favorites
- **Quick Access**: Favorites appear prominently
- **Bulk Favorite**: Manage favorites directly from cards

## Search & Discovery

### Full-Text Search
- **Search by Title**: Find links by page title
- **Search by URL**: Find links by website domain or URL
- **Search by Tags**: Find links by associated tags
- **Real-Time Filtering**: Results update as you type

### Filter & Browse
- **Folder View**: View links within specific folders
- **All Links View**: See complete link library
- **Combined Search**: Search within selected folder
- **Sort Options**: By date created, alphabetical, etc.

## Realtime Synchronization

### Cross-Device Sync
- **Instant Updates**: Changes appear on all logged-in devices
- **Device A adds link** → **Device B updates immediately**
- **No Manual Refresh**: Automatic sync via Supabase Realtime
- **Background Sync**: Works even with app in background

### Conflict Resolution
- **Last-Write Wins**: Latest change takes precedence
- **Timestamp Tracking**: All changes timestamped
- **Edit History**: Track when links were modified

## Premium Features

### Free Plan Includes
- Basic link saving and organization
- Up to 5 folders
- Basic search
- Single device sync
- Google OAuth

### Premium Features (Upgrade Required)
- Unlimited links (vs basic limit on free)
- Unlimited folders (vs 5 on free)
- Advanced search filters
- Bulk operations (edit/delete multiple)
- Priority sync (faster realtime updates)
- No ads or branding
- Priority support

### Upgrade Flow
1. Click "Upgrade to Premium" button in settings
2. Redirected to external Shopify store
3. Complete purchase
4. Administrator updates Supabase user record
5. Premium features immediately enabled
6. Optional: Auto-expiration with premium_until date

## Chrome Extension

### Right-Click Context Menu
- **Save Link**: Right-click any link → Save to LnkLokr
- **Save Image**: Right-click image → Save to LnkLokr
- **Save Selection**: Right-click selected text → Save to LnkLokr
- **Add Description**: Option to add custom description

### Popup Interface
- **Quick View**: See recent links in popup (500px wide)
- **Full App Link**: "Open LnkLokr" to access full app
- **Add Link Modal**: Quick add form in popup
- **Login Required**: Users must login first

### Background Service Worker
- **Context Menu Setup**: Registers right-click options on install
- **Message Handling**: Receives saves from content script
- **Storage**: Uses chrome.storage.local for auth tokens

### Content Script
- **Page Injection**: Monitors for saves from extension
- **Link Detection**: Extracts link/image URL and metadata
- **User-Safe**: No tracking or analytics

## Web Application

### Responsive Design
- **Mobile Friendly**: Works on phones and tablets
- **Tablet Optimized**: Takes advantage of larger screens
- **Desktop Power**: Full feature set on large displays
- **Flexible Layout**: Adapts to any screen size

### PWA Support
- **Install as App**: Add to home screen on mobile
- **Desktop Install**: Install as standalone app on Windows/Mac
- **Offline Ready**: (Future: offline mode with sync)
- **App Icon**: Branded icon on home screen

### Dashboard
- **Overview**: See all links at a glance
- **Statistics**: Count of links, folders, tags
- **Recent Links**: Latest saved links first
- **Quick Access**: Frequent folders and tags

## Data Management

### Export & Backup
- (Future) Export links as JSON
- (Future) Export links as HTML
- (Future) Scheduled backups to cloud

### Privacy & Security
- **End-to-End**: All data encrypted in transit
- **RLS Protection**: Users can only access own data
- **No Tracking**: No analytics or tracking
- **GDPR Ready**: Supports data deletion requests

## Settings & Preferences

### Account Settings
- **View Email**: Display current email
- **Premium Status**: Show subscription status
- **Sign Out**: Log out from all devices
- **Delete Account**: (Future) Remove all data

### Preferences
- **Theme**: (Future) Dark/light mode
- **Language**: (Future) Multi-language support
- **Notifications**: (Future) Sync and activity notifications
- **Export Data**: (Future) Download backup

## Performance

### Caching
- **Data Caching**: Links cached locally for fast loading
- **Image Caching**: Thumbnails cached for quick display
- **Session Caching**: Auth tokens cached securely

### Optimization
- **Lazy Loading**: Images load only when needed
- **Pagination**: Large link lists paginated
- **Debounced Search**: Search optimized to avoid overload
- **CDN Ready**: Icons and static assets ready for CDN

## Accessibility

### Browser Support
- **Chrome/Edge**: Full support (extension + web)
- **Firefox**: Web app (extension future)
- **Safari**: Web app (extension future)
- **Mobile Browsers**: Full responsive support

### Keyboard Navigation
- **Tab Navigation**: All interactive elements keyboard accessible
- **Enter to Submit**: Forms submit with Enter key
- **Escape to Close**: Modals close with Escape
- **Arrow Keys**: Navigate folders and links (future)

## Future Roadmap

### Coming Soon
- [ ] Dark mode
- [ ] Keyboard shortcuts
- [ ] Batch operations
- [ ] Link categories (vs just folders)
- [ ] Collaborative link sharing
- [ ] Public link collections

### Medium Term
- [ ] Firefox extension
- [ ] Safari extension
- [ ] Mobile app (React Native)
- [ ] Desktop app (Electron)
- [ ] AI-powered tagging
- [ ] Link preview on hover

### Long Term
- [ ] AI-powered recommendations
- [ ] Social link sharing
- [ ] Browser history integration
- [ ] Reading list integration
- [ ] Knowledge graph visualization
- [ ] Team collaboration features

## API Integration

### Supabase Integration
- **Authentication**: Email/password and OAuth
- **Database**: PostgreSQL for link storage
- **Realtime**: WebSocket for instant sync
- **RLS**: Row-level security for data isolation
- **Triggers**: Future for notifications

### Future Integrations
- [ ] Pocket API
- [ ] Pinboard API
- [ ] Raindrop.io
- [ ] Slack integration
- [ ] Notion integration
- [ ] Discord webhooks
