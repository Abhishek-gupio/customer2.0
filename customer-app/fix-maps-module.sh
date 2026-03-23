#!/bin/bash

# Fix react-native-maps native module linking issue
# This script will clean and rebuild the Android app

echo "🔧 Fixing react-native-maps native module linking..."

# Step 1: Clean Android build
echo "📦 Step 1: Cleaning Android build..."
cd android
./gradlew clean
cd ..

# Step 2: Clean Metro bundler cache
echo "🧹 Step 2: Cleaning Metro bundler cache..."
rm -rf node_modules/.cache
npx react-native start --reset-cache &
METRO_PID=$!
sleep 3
kill $METRO_PID 2>/dev/null || true

# Step 3: Reinstall node_modules (optional, but recommended)
echo "📥 Step 3: Reinstalling dependencies..."
read -p "Do you want to reinstall node_modules? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    rm -rf node_modules
    pnpm install
fi

# Step 4: Rebuild Android app
echo "🔨 Step 4: Rebuilding Android app..."
cd android
./gradlew clean
./gradlew assembleDebug
cd ..

echo "✅ Done! Now try running: pnpm android"
echo ""
echo "If the issue persists, try:"
echo "1. Close Metro bundler completely"
echo "2. Run: cd android && ./gradlew clean && cd .."
echo "3. Run: pnpm android"
