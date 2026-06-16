# SHIFT Mobile — Android / Fire Stick / Android TV

React Native app using VLC for playback (supports MKV, HEVC, H.264, HLS — everything).

## Requirements

- Node.js 18+
- Java 17 (JDK)
- Android Studio with Android SDK 34
- For Fire Stick / Android TV: ADB installed

## First-time setup

```bash
cd mobile
npm install
```

That's it — the native Android project (gradlew, gradle wrapper jar, debug keystore,
MainActivity.kt, MainApplication.kt, launcher icons, TV banner) is already
checked in under `android/`. No scaffolding step needed.

## Run on device / Fire Stick

```bash
# Enable ADB on Fire Stick: Settings → My Fire TV → Developer Options → ADB Debugging ON
# Connect: adb connect <firestick-ip>:5555

# Start Metro bundler
npm start

# Build + install debug APK (in a second terminal)
npm run android
```

## Build release APK

```bash
npm run build:release
# APK will be at android/app/build/outputs/apk/release/app-release.apk
# Sideload to Fire Stick: adb install app-release.apk
```

## Features

- Xtream Codes login (same credentials as the website)
- M3U playlist support
- VLC player: plays MKV, HEVC, H.264, HLS — no "can't play" errors
- Continue Watching — synced separately from the website (localStorage vs device storage)
- Works on: Android phones, Android tablets, Fire Stick, Android TV boxes
- Same launcher icon shows in both the phone app drawer AND the Fire TV home screen
