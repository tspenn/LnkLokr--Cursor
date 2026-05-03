# LnkLokr Chrome Extension - Installation Guide

Your Chrome extension has been successfully built!

## Installation Options

### Option 1: Load Unpacked (Developer Mode)

1. Open Chrome and go to `chrome://extensions/`
2. Enable **Developer mode** (toggle in top-right corner)
3. Click **Load unpacked**
4. Navigate to and select the `dist` folder in your project
5. The extension should now appear in your extensions list

### Option 2: Install from ZIP

1. Extract the `lnklokr-extension.zip` file to a folder
2. Open Chrome and go to `chrome://extensions/`
3. Enable **Developer mode** (toggle in top-right corner)
4. Click **Load unpacked**
5. Select the extracted folder
6. The extension should now appear in your extensions list

## Using the Extension

### Features

1. **Right-click context menus**:
   - Right-click on any image → "Save to LnkLokr"
   - Right-click on any link → "Save to LnkLokr"
   - Select text and right-click → "Save to LnkLokr"

2. **Extension popup**:
   - Click the LnkLokr icon in your Chrome toolbar
   - Access your full dashboard
   - View saved items
   - Manage your links and images

### First Time Setup

1. Click the LnkLokr extension icon
2. Sign in or create an account
3. Start saving links and images from any website!

## Files Included

- `manifest.json` - Extension configuration
- `background.js` - Background service worker
- `content.js` - Content script for web pages
- `popup.html` - Extension popup interface
- `main2.js` - Main application code
- `assets/main.css` - Styles
- `icons/` - Extension icons

## Troubleshooting

**Extension not working?**
- Make sure you're logged into your LnkLokr account
- Check that the extension has proper permissions
- Try reloading the extension from chrome://extensions/

**Can't see context menus?**
- Reload the page you're trying to save from
- Make sure the extension is enabled

**Popup not loading?**
- Check the browser console for errors
- Try disabling and re-enabling the extension

## Building from Source

To rebuild the extension:

```bash
./build-extension.sh
```

Or manually:

```bash
npm run build
cp manifest.json dist/
cp background.js dist/
cp content.js dist/
```

## Support

For issues or questions, refer to the main README.md file.
