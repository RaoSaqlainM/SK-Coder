# SK Coder — Android APK Build Guide

This guide turns the SK Coder web app into a native Android APK with **Termux integration** for real on-device Linux (npm, python, gcc, bash) and **"Open with SK Coder"** support from any file manager.

---

## What you get in the APK

| Feature | Works offline? | Notes |
|---|---|---|
| Editor + file explorer | Yes | OPFS + SD card storage |
| HTML/CSS/JS/Python preview | Yes | Pyodide bundled |
| C/C++/Java/Go/Rust compile | No | Cloud compiler (Piston) |
| Real `npm install` / `npm run dev` | Yes (with Termux) | Requires Termux from F-Droid |
| Real `bash`, `git`, `gcc`, `python3` | Yes (with Termux) | Stored on SD card if you want |
| Cloud Shell (Codespaces) | No | Requires GitHub login |
| Open files from any app | Yes | Tap any code file → Open with → SK Coder |
| Background notifications | Yes | Build done, dev server ready |

---

## Build the APK (no Mac/Linux needed — works on Windows)

### Option A — GitHub Actions (zero local setup)
1. Push the project to a GitHub repo.
2. Add `.github/workflows/android.yml` (template below).
3. Trigger the workflow → download the signed APK from artifacts.

### Option B — Local with Android Studio
1. `git clone` the repo, then `npm install`.
2. `npm run build` (produces `dist/`).
3. `npx cap add android` (creates `android/` folder).
4. Copy native files (see "Wire Termux plugin" below).
5. `npx cap sync android`.
6. `npx cap open android` → in Android Studio: Build → Build Bundle / APK → Build APK.
7. Find APK in `android/app/build/outputs/apk/debug/`.

---

## Wire the Termux plugin (one-time)

After `npx cap add android`:

1. Create folder `android/app/src/main/java/app/lovable/fbf8d1fcf2504b7699cb7af913d34b5a/termux/`.
2. Copy `android-native/TermuxBridgePlugin.java` from this repo into that folder.
3. Open `android/app/src/main/java/.../MainActivity.java` and add:
   ```java
   import app.lovable.fbf8d1fcf2504b7699cb7af913d34b5a.termux.TermuxBridgePlugin;
   // Inside onCreate, before super.onCreate:
   registerPlugin(TermuxBridgePlugin.class);
   ```
4. Open `android/app/src/main/AndroidManifest.xml` and merge in the snippets from `android-native/AndroidManifest.snippet.xml`:
   - `<queries>` block at the root (sibling of `<application>`) so we can detect Termux on Android 11+.
   - The two `<intent-filter>` blocks inside `<activity android:name=".MainActivity">` so the app appears in "Open with" for code files.
5. `npx cap sync android` and rebuild.

---

## End-user setup (after they install the APK)

### Enable Termux (one-time, ~2 minutes)
1. Install **Termux from F-Droid** (NOT Play Store — Play version is broken):
   https://f-droid.org/en/packages/com.termux/
2. Open Termux and paste:
   ```bash
   termux-setup-storage
   echo 'allow-external-apps=true' >> ~/.termux/termux.properties
   pkg update -y && pkg install -y nodejs python clang git openssh
   mkdir -p ~/storage/shared/SKCoder
   ln -sf ~/storage/shared/SKCoder ~/skcoder-workspace
   ```
3. Fully close Termux and reopen it once.
4. Open SK Coder → Settings → Termux → tap "Run echo test". You should see ✓.

### Move package storage to SD card (optional)
After `termux-setup-storage`, packages live in `/data/data/com.termux/files/usr` (internal). To move them to SD card:
```bash
# Inside Termux:
cp -r $PREFIX /storage/<sd-card-id>/termux-prefix
# Then symlink — advanced; only do this if internal storage is full.
```

---

## GitHub Actions workflow template

Save as `.github/workflows/android.yml`:

```yaml
name: Build Android APK
on: [push, workflow_dispatch]
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20 }
      - uses: actions/setup-java@v4
        with: { distribution: temurin, java-version: 17 }
      - run: npm ci
      - run: npm run build
      - run: npx cap add android || true
      - run: npx cap sync android
      - run: cd android && ./gradlew assembleDebug
      - uses: actions/upload-artifact@v4
        with:
          name: sk-coder-debug-apk
          path: android/app/build/outputs/apk/debug/*.apk
```

---

## Troubleshooting

**"Failed to call Termux" error.** Termux not installed, or `allow-external-apps=true` not set, or you didn't restart Termux after editing `termux.properties`.

**SK Coder doesn't appear in "Open with".** You skipped the AndroidManifest intent-filter snippets. Re-merge them and run `npx cap sync android`.

**Cloud Shell sign-in shows "client_id missing".** The default OAuth client ID may have been removed. Create your own at https://github.com/settings/applications/new (Device Flow enabled) and paste it in Settings → Cloud Shell.

**Notifications don't fire.** Android 13+ requires explicit permission. Open Settings → Notifications → tap the toggle, then accept the system prompt.
