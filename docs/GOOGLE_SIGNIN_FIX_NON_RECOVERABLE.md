# Fix: Google Sign-In errors on Android

These errors appear **after** you tap "Sign in with Google" and select an account:

- **"A non-recoverable sign in failure occurred"**
- **"DEVELOPER_ERROR"** (with link to troubleshooting)
- **"No ID token from Google"**

They usually mean the **SHA-1 fingerprint** of the app you're running does **not** match the one registered in the Google Cloud **Android** OAuth client for package **`com.mobile1`**.

---

## Fix: Android OAuth client must have your debug SHA-1

Your app uses **package name `com.mobile1`**. In Google Cloud you need an **Android** OAuth 2.0 client for that package with the **exact** SHA-1 of the keystore that signs your debug build.

### 1. Get your debug SHA-1

From **project root** (customer2.0):

```bash
keytool -keystore Mobile/android/app/debug.keystore -list -v -storepass android -alias androiddebugkey
```

Copy the **SHA1** line (e.g. `5E:8F:16:06:2E:A3:CD:2C:4A:0D:54:78:76:BA:A6:F3:8C:AB:F6:25`).  
(For release builds, use your release keystore and add that SHA-1 too.)

### 2. Add this SHA-1 in Google Cloud

1. Open **https://console.cloud.google.com/apis/credentials**
2. Select the **same project** where your Web client and Android client live.
3. Under **OAuth 2.0 Client IDs**, find the **Android** client with package name **`com.mobile1`**.
   - If you don't have one: **Create credentials → OAuth client ID → Application type: Android**. Set package name to `com.mobile1` and add the SHA-1 from step 1.
   - If you already have one: click its name (or the pencil icon).
4. Under **SHA-1 certificate fingerprint**, click **+ ADD FINGERPRINT** and paste **your** SHA-1 from step 1.
5. Click **SAVE**.

### 3. Use the Web client ID in the app

The app must use the **Web application** client ID (not the Android client ID) so the backend can verify the ID token:

- **App:** `Mobile/src/config/index.ts` → `GOOGLE_WEB_CLIENT_ID` = Web client ID (e.g. `789540291597-...apps.googleusercontent.com`).
- **Backend:** `Backend/.env` → `GOOGLE_CLIENT_ID` = **same** Web client ID.

### 4. Wait and test again

- Wait **2–5 minutes** for Google to apply credential changes.
- Fully close the app (swipe away) or uninstall and reinstall.
- Try **Sign in with Google** again.

---

## Optional: Config doctor

From the **Mobile** folder:

```bash
npx @react-native-google-signin/config-doctor
```

This checks package name, google-services.json, and suggests fixes.

---

## If it still fails

- **Same project:** Web and Android OAuth clients must be in the **same** GCP project. `GOOGLE_WEB_CLIENT_ID` must be the **Web** client from that project.
- **Test user:** If the OAuth consent screen is in **Testing** mode, the Google account you use must be in **Test users** (APIs & Services → OAuth consent screen → Test users).
- **Device:** Use a device/emulator with **Google Play Services** and a Google account signed in.
- **Cache:** Try clearing app data for your app, or uninstall and install again, then retry.
