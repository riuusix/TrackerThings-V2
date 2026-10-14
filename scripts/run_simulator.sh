#!/usr/bin/env bash
set -euo pipefail

# Target Simulator Device (Default: "iPhone 17 Pro")
TARGET_DEVICE="${1:-iPhone 17 Pro}"

echo "=========================================================="
echo "TrackerThings V2 — iOS Simulator Runner"
echo "Target Device: $TARGET_DEVICE"
echo "=========================================================="

# 1. Verifikasi ketersediaan Xcode command line tools
if ! command -v xcodebuild &> /dev/null; then
    echo "::error:: xcodebuild tidak ditemukan. Pastikan Xcode telah terinstal dan xcode-select terkonfigurasi."
    exit 1
fi

if ! command -v xcrun &> /dev/null; then
    echo "::error:: xcrun tidak ditemukan."
    exit 1
fi

# 2. Cari Device ID simulator secara eksplisit
DEVICE_LINE=$(xcrun simctl list devices available | grep -F "$TARGET_DEVICE" | head -n 1 || true)

if [ -z "$DEVICE_LINE" ]; then
    echo "::error:: Simulator '$TARGET_DEVICE' tidak ditemukan di daftar simulator yang tersedia."
    echo ""
    echo "Daftar simulator iPhone yang tersedia di Mac Anda:"
    xcrun simctl list devices available | grep -E "iPhone" || true
    echo ""
    echo "Petunjuk:"
    echo "  1. Jalankan skrip dengan nama simulator yang ada, contoh:"
    echo "     ./scripts/run_simulator.sh \"iPhone 16 Pro\""
    echo "  2. Atau buat simulator '$TARGET_DEVICE' melalui:"
    echo "     Xcode > Settings > Platforms / Simulators"
    exit 1
fi

DEVICE_ID=$(echo "$DEVICE_LINE" | grep -E -o "[0-9A-F]{8}-([0-9A-F]{4}-){3}[0-9A-F]{12}" | head -n 1)

if [ -z "$DEVICE_ID" ]; then
    echo "::error:: Gagal mengekstrak UDID dari simulator: $DEVICE_LINE"
    exit 1
fi

echo "Simulator Terpilih : $TARGET_DEVICE"
echo "Simulator UDID     : $DEVICE_ID"

# 3. Boot Simulator jika belum aktif
BOOT_STATE=$(xcrun simctl list devices | grep "$DEVICE_ID" | grep -o "Booted" || true)
if [ "$BOOT_STATE" != "Booted" ]; then
    echo "Memulai (boot) Simulator $TARGET_DEVICE..."
    xcrun simctl boot "$DEVICE_ID"
else
    echo "Simulator sudah dalam status Booted."
fi

# Buka aplikasi Simulator di macOS
open -a Simulator || true

# 4. Build project secara deterministik ke .build/DerivedData
DERIVED_DATA_PATH=".build/DerivedData"
echo "Memulai kompilasi TrackerThings.xcodeproj untuk iOS Simulator..."

xcodebuild -project TrackerThings.xcodeproj \
           -scheme TrackerThings \
           -destination "id=$DEVICE_ID" \
           -configuration Debug \
           -derivedDataPath "$DERIVED_DATA_PATH" \
           build

APP_PATH="$DERIVED_DATA_PATH/Build/Products/Debug-iphonesimulator/TrackerThings.app"

if [ ! -d "$APP_PATH" ]; then
    echo "::error:: Hasil build tidak ditemukan di: $APP_PATH"
    exit 1
fi

echo "Bundle aplikasi terverifikasi di: $APP_PATH"

# 5. Instalasi ke Simulator
echo "Menginstal com.trackerthings.app ke Simulator..."
xcrun simctl install "$DEVICE_ID" "$APP_PATH"

# 6. Jalankan (Launch) aplikasi
echo "Meluncurkan com.trackerthings.app di Simulator..."
xcrun simctl launch "$DEVICE_ID" com.trackerthings.app

echo "=========================================================="
echo "SUKSES: TrackerThings V2 berhasil berjalan di $TARGET_DEVICE!"
echo "=========================================================="
