# Google Play Protect blocking APK install

When you install the **release APK** outside the Play Store (e.g. shared via WhatsApp or downloaded from a link), Android may show:

**"App blocked to protect your device"**  
*"This app can request access to sensitive data. This can increase the risk of identity theft or financial fraud."*

This is **Google Play Protect** being cautious about sideloaded apps that use permissions like SMS, location, or camera. It does **not** mean your app is malicious.

---

## How to install anyway (on the user’s phone)

1. Tap **"Got it"** on the Play Protect dialog.
2. You may see **"App not installed"** — that’s from the blocked attempt.
3. Open the APK again (from Files, Downloads, or the chat where you received it).
4. When the installer opens, look for:
   - **"Install anyway"** or **"Install"**, or
   - A link like **"More details"** → then **"Install anyway"**.
5. If you don’t see that, go to **Settings** → **Security** → **Google Play Protect** → **Settings** (gear). You can turn off **"Scan apps with Play Protect"** temporarily, install the app, then turn it back on. Or use **"Install unknown apps"** and allow your file manager/browser for that install.

Brand names differ (Samsung, Xiaomi, Pixel, etc.) but the idea is: dismiss the warning, then install from the same APK again and choose “Install anyway” when offered.

---

## Why this happens

- The APK is **not** from the Google Play Store.
- The app uses **sensitive permissions** (SMS, location, camera, etc.) for legitimate features (e.g. OTP, SOS, documents).
- Play Protect is stricter with such apps when they’re sideloaded.

---

## What we did in the project

- **App name** in the launcher is set to **"Gupio Customer"** (in `android/app/src/main/res/values/strings.xml`) so it’s clear and less generic than "Mobile".
- For **Play Store** release you’ll use a **release keystore** and Play App Signing; that doesn’t remove the warning when the same APK is shared and installed manually, but it’s required for store distribution.

---

## "Google Sign-In failed" / "No ID token from Google"

If after installing you see **"Google Sign-In failed"** and **"No ID token from Google"**:

1. **Release build** uses a different signing key (debug keystore or your release keystore). Google OAuth needs the **SHA-1 (and SHA-256)** of the key you use to sign the APK.
2. In **Google Cloud Console** → your project → **APIs & Services** → **Credentials** → open your **Android** OAuth 2.0 client:
   - Add the **package name**: `com.mobile1`
   - Add the **SHA-1** (and SHA-256) of the keystore used to sign the release APK.
3. Get SHA-1 for your keystore:
   - **Debug:**  
     `keytool -list -v -keystore Mobile/android/app/debug.keystore -alias androiddebugkey -storepass android -keypass android`
   - **Release:**  
     `keytool -list -v -keystore /path/to/your/release.keystore -alias your_alias`
4. Copy the SHA-1 (and SHA-256) from the output and add them to the Android OAuth client. Save. Wait a few minutes, then try Google Sign-In again in the app.

Once the correct SHA-1 for the build you’re installing is in the Android OAuth client, “No ID token from Google” should stop.
