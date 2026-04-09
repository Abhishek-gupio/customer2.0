#!/bin/bash

# Target directory that CMake expects
TARGET_DIR="node_modules/@react-native-community/geolocation/android/build/generated/source/codegen/jni"

echo "Ensuring geolocation codegen JNI directory exists..."
mkdir -p "$TARGET_DIR"

# Create a dummy CMakeLists.txt if it doesn't exist, to prevent CMake errors
if [ ! -f "$TARGET_DIR/CMakeLists.txt" ]; then
    echo "Creating dummy CMakeLists.txt in $TARGET_DIR"
    touch "$TARGET_DIR/CMakeLists.txt"
fi

echo "Geolocation codegen fix applied."
