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

if [ "$1" == "debug" ]; then
    echo "Step 5: Building Debug APK..."
    ./gradlew assembleDebug
    echo "Build Complete! Path: Mobile/android/app/build/outputs/apk/debug/app-debug.apk"
elif [ "$1" == "release" ]; then
    echo "Step 5: Building Release APK..."
    ./gradlew assembleRelease
    echo "Build Complete! Path: Mobile/android/app/build/outputs/apk/release/app-release.apk"
else
    echo "Recovery complete. The environment is now fixed."
    echo "To build an APK, you can run: ./scripts/build-recovery.sh [debug|release]"
fi
