#!/bin/bash

echo "Building LnkLokr Chrome Extension..."

echo "Step 1: Building React app..."
npm run build

echo "Step 2: Copying extension files..."
cp manifest.json dist/
cp background.js dist/
cp content.js dist/

echo "Step 3: Ensuring icons directory..."
mkdir -p dist/icons
cp public/icons/*.png dist/icons/ 2>/dev/null || true

echo "Step 4: Fixing paths for Chrome extension..."
# Fix absolute paths to relative paths in HTML files
sed -i 's|src="/|src="./|g' dist/popup.html
sed -i 's|href="/|href="./|g' dist/popup.html
sed -i 's|src="/|src="./|g' dist/index.html
sed -i 's|href="/|href="./|g' dist/index.html

echo "Step 5: Creating extension package..."
cd dist
rm -f ../lnklokr-extension.zip
zip -r ../lnklokr-extension.zip . -x "*.map"
cd ..

echo ""
echo "✅ Extension built successfully!"
echo "📦 Extension package: lnklokr-extension.zip"
echo ""
echo "To install in Chrome:"
echo "1. Go to chrome://extensions/"
echo "2. Enable 'Developer mode'"
echo "3. Click 'Load unpacked'"
echo "4. Select the 'dist' folder"
echo ""
echo "Or extract lnklokr-extension.zip and load that folder."
echo ""
echo "📖 See EXTENSION_INSTALL.md for detailed instructions."
