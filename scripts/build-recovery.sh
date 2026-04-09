#!/bin/bash

# Exit on error
set -e

PROJECT_ROOT=$(pwd)
MOBILE_DIR="$PROJECT_ROOT/Mobile"

echo "Step 1: Deep Cleanup..."
rm -rf node_modules
rm -rf "$MOBILE_DIR/node_modules"
rm -rf "$MOBILE_DIR/android/app/build"
rm -rf "$MOBILE_DIR/android/.gradle"
rm -rf "$MOBILE_DIR/android/app/.cxx"

echo "Step 2: Installing Dependencies..."
pnpm install

echo "Step 3: Applying Native Fixes..."
bash "$MOBILE_DIR/scripts/fix-geolocation.sh"

echo "Step 4: Preparing Android Build..."
cd "$MOBILE_DIR/android"
./gradlew clean

echo "Recovery complete. You can now build the APK."
echo "Debug APK: ./gradlew assembleDebug"
echo "Release APK: ./gradlew assembleRelease"
