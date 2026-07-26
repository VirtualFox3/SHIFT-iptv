# SHIFT Mobile — iOS / Android / Fire Stick / Android TV

Expo (React Native) app that plays your IPTV line with the **platform's native
player** (`expo-video`): ExoPlayer on Android, AVPlayer on iOS.

Why this exists: the browser can't decode HEVC or the MKV container, and the
deployed site has to route streams through a proxy (HTTPS page can't load an HTTP
stream). The app has neither limit — it connects **straight** to your provider, so
playback starts faster, seeking is instant, and the titles that show
"Can't play this format" on the web just play here.

**Format support**
- **Android (ExoPlayer):** H.264, **HEVC**, **MKV**, HLS, MPEG-TS — everything your line serves.
- **iOS (AVPlayer):** H.264, **HEVC** (in MP4/MOV), HLS. iOS still won't open the
  **MKV container** — that's an OS-level limit, not an app one.

## Requirements

- Node.js 18+
- A free [Expo](https://expo.dev) account for cloud builds (EAS) — no Android
  Studio or Xcode needed
- For Fire Stick / Android TV sideloading: `adb`

## Run it in development

```bash
cd mobile
npm install
npm start
```

Then open the project in **Expo Go** on your phone (scan the QR code). `expo-video`
ships with Expo Go, so no custom dev build is needed just to try it.

## Build an installable Android APK (no Play Store)

```bash
npm install -g eas-cli
eas login
npm run build:android      # eas build -p android --profile preview  → APK
```

EAS builds in the cloud and gives you a download link.
Sideload to a Fire Stick / TV box:

```bash
adb install shift.apk
```

## Build for iOS

```bash
npm run build:ios          # eas build -p ios --profile preview
```

iOS needs an Apple Developer account to install on a physical device.

## Other EAS profiles (see `eas.json`)

- `development` — dev client build (for native debugging)
- `preview` — internal distribution; Android emits an **APK**
- `production` — Android emits an **AAB** for the Play Store

```bash
eas build --platform android --profile production
```

## Notes

- **Sign-in:** same Xtream Codes credentials as the website (M3U playlists also work).
- **HTTP streams:** allowed on iOS via `NSAllowsArbitraryLoads` in `app.json` —
  most IPTV lines are plain HTTP.
- **Continue Watching** is stored on the device (AsyncStorage), separate from the
  website's browser storage.
- **One connection:** if your plan allows a single stream, close the app (or the
  website) before playing elsewhere, or the provider will reject the second one.
- The `android/` and `ios/` folders aren't committed — EAS regenerates them from
  `app.json` on every cloud build. Run `npx expo prebuild` only if you want to
  build locally with Android Studio/Xcode.
