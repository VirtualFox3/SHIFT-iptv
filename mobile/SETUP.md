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

# 1. Install JS dependencies
npm install

# 2. React Native needs its own Android native files — scaffold them:
npx react-native init SHIFTiptv --template react-native-template-typescript --skip-install

# 3. Copy the generated native files into this folder:
cp -r SHIFTiptv/android/app/src/main/java android/app/src/main/
cp -r SHIFTiptv/android/app/src/main/res/mipmap-* android/app/src/main/res/
cp SHIFTiptv/android/app/src/main/res/values/styles.xml android/app/src/main/res/values/
cp SHIFTiptv/android/gradlew android/
cp SHIFTiptv/android/gradlew.bat android/
cp -r SHIFTiptv/android/gradle/wrapper/gradle-wrapper.jar android/gradle/wrapper/

# 4. Clean up the temp project
rm -rf SHIFTiptv

# 5. Update the package name in java files from 'com.shiftiptv' → 'com.shift.iptv'
# (Android Studio will do this automatically if you open android/ as a project)
```

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
