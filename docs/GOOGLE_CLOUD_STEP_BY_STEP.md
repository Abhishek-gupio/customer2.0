# Google Cloud – Step-by-Step Guide for Google Sign-In

Follow these steps in order. You need a Google account.

---

## Step 1: Open Google Cloud Console

1. Go to: **https://console.cloud.google.com/**
2. Sign in with your Google account.

---

## Step 2: Create or Select a Project

1. At the top of the page, click the **project dropdown** (it may say "Select a project" or show an existing project name).
2. Click **"NEW PROJECT"** (or choose an existing project if you prefer).
3. **Project name:** e.g. `Gupio App` or `Customer App`.
4. Click **"CREATE"**.
5. Wait until the project is created, then **select this project** from the dropdown so it’s the active project (top bar should show its name).

---

## Step 3: Configure the OAuth Consent Screen (Required for Sign-In)

Before creating credentials, Google requires an OAuth consent screen. **Google’s UI can look different** (classic Cloud Console vs newer Auth pages). Use whichever path works for you.

---

### Option A: Classic Cloud Console (left menu)

1. Make sure your **project is selected** (top bar dropdown).
2. Open the **☰ (hamburger) menu** at the top-left.
3. Go to **APIs & Services** → **OAuth consent screen**.
   - Direct link (replace `YOUR_PROJECT_ID` if needed):  
     **https://console.cloud.google.com/apis/credentials/consent**
4. **If you see “Choose the user type” (first time setup):**
   - Select **External** → click **CREATE**.
   - Then you get **App information**: App name, User support email, Developer contact email → **SAVE AND CONTINUE**.
   - Then **Scopes** → **ADD OR REMOVE SCOPES** → add `userinfo.email`, `userinfo.profile`, `openid` → **UPDATE** → **SAVE AND CONTINUE**.
   - Then **Test users** (add your Gmail for testing) → **SAVE AND CONTINUE** → **BACK TO DASHBOARD**.
5. **If you already see a dashboard** (e.g. “OAuth consent screen” with Publishing status, App information):
   - Click **EDIT APP** (or the **pencil** on each section) to set App name, User support email, Scopes, and Test users. User type (External) is usually under the main dashboard or the first edit step.

---

### Option B: New Google Auth / Developer Console (direct links)

Google sometimes shows consent settings on separate “Auth” pages. Use these **only after selecting your project** in the top bar (project selector may appear on these pages).

1. **User type (External) and audience**
   - Open: **https://console.developers.google.com/auth/audience**
   - Select your **project** at the top if asked.
   - Set **User type** to **External** (so any Google account can sign in). Save if there’s a Save button.

2. **App name and support email (branding)**
   - Open: **https://console.developers.google.com/auth/branding**
   - **App name:** e.g. `Gupio` or your app name.
   - **User support email:** Pick your email from the dropdown (must be a Google account or Workspace account on the project).
   - **Developer contact email:** Your email.
   - Save.

3. **Scopes** (what the app can ask for)
   - In the **same Branding page** or in **OAuth consent screen** (Option A link), find **Scopes** or **App authorization**.
   - Add at least: **email**, **profile**, **openid** (or `userinfo.email`, `userinfo.profile`, `openid`). Save.

4. **Test users** (if the app is in “Testing”)
   - In **OAuth consent screen** or **Audience** page, find **Test users** and add the Gmail addresses that will sign in during development. Save.

---

### If you still don’t see “External”, “App name”, “email”, or “Scopes”

- **Confirm project:** Top bar must show your project name. If it says “No project” or the wrong project, click it and select (or create) the correct project.
- **Use direct links:** Try **https://console.cloud.google.com/apis/credentials/consent** (classic) and **https://console.developers.google.com/auth/audience** and **https://console.developers.google.com/auth/branding** (new). Same project must be selected.
- **Already configured?** If the consent screen was set up before, you may see a summary/dashboard. Use **EDIT APP** or open each section (App information, Scopes, Test users) to edit; **User type** is often on the main consent screen or under **Audience**.
- **Different language/region:** Menus can be translated. Look for: “OAuth consent screen”, “User type”, “External”, “App information”, “Scopes”, “Test users”.

Once **User type = External**, **App name** and **User support email** are set, and **email/profile/openid** scopes are added, you can create OAuth client IDs in Step 4.

---

## Step 4: Create OAuth 2.0 Credentials

1. In the left sidebar, go to: **APIs & Services** → **Credentials**  
   (or open: https://console.cloud.google.com/apis/credentials)
2. Click **"+ CREATE CREDENTIALS"** at the top.
3. Select **"OAuth client ID"**.

---

## Step 4a: Create Web Client ID (Used by Backend + Mobile)

1. **Application type:** Select **"Web application"**.
2. **Name:** e.g. `Web client (Backend + Mobile)`.
3. **Authorized JavaScript origins** (optional for backend-only verification; you can leave blank or add):
   - `http://localhost:4000` (if you have a web app)
   - Your production API URL if needed.
4. **Authorized redirect URIs** (optional for server-side; can leave blank for ID-token-only flow).
5. Click **"CREATE"**.
6. A popup shows your **Client ID** and **Client secret**.
   - **Copy the Client ID** (looks like: `123456789-xxxxxx.apps.googleusercontent.com`).
   - You will use this in:
     - **Backend** `.env` as `GOOGLE_CLIENT_ID`
     - **Mobile** `src/config/index.ts` as `GOOGLE_WEB_CLIENT_ID`
   - You do **not** need the Client secret for the mobile + backend flow described in this project.
7. Click **"OK"** to close the popup.

---

## Step 4b: Create Android OAuth Client (For Android App)

1. Again click **"+ CREATE CREDENTIALS"** → **"OAuth client ID"**.
2. **Application type:** Select **"Android"**.
3. **Name:** e.g. `Android app`.
4. **Package name:** Must match your React Native app.  
   - Typical format: `com.yourappname` or `com.company.gupio`.  
   - To find it: in your project open `android/app/build.gradle` (or `android/app/build.gradle.kts`) and look for `applicationId` (e.g. `applicationId "com.gupio"`). Use that value.
5. **SHA-1 certificate fingerprint:**
   - **Debug (development):**  
     In terminal, run:
     ```bash
     cd Mobile/android
     ./gradlew signingReport
     ```
     (On Windows: `gradlew.bat signingReport`)
   - In the output, find **SHA-1** under the **debug** variant (e.g. `Variant: debug`) and copy it (format like `AA:BB:CC:...`).
   - Paste it into the "SHA-1 certificate fingerprint" field.
6. Click **"CREATE"**. You don’t need to copy the Android Client ID for the app code; the Web client ID is used in the app. The Android client links your app’s package + SHA-1 to the same Google project.

---

## Step 4c: Create iOS OAuth Client (For iOS App)

1. Again click **"+ CREATE CREDENTIALS"** → **"OAuth client ID"**.
2. **Application type:** Select **"iOS"**.
3. **Name:** e.g. `iOS app`.
4. **Bundle ID:** Must match your iOS app.  
   - In Xcode, open the project under `Mobile/ios`, select the app target, and check **Bundle Identifier** (e.g. `org.reactjs.native.example.Gupio` or `com.company.gupio`). Use that value.
5. (Optional) **App Store ID** and **Team ID** can be left blank for development.
6. Click **"CREATE"**.

For iOS, you also need to add a **URL scheme** in Xcode so Google Sign-In can return to your app (see Step 6).

---

## Step 5: Where to Use the Web Client ID

You only need to copy the **Web application** Client ID from Step 4a.

| Place | Variable | Value |
|--------|----------|--------|
| **Backend** | In `Backend/.env` | `GOOGLE_CLIENT_ID=123456789-xxxxxx.apps.googleusercontent.com` |
| **Mobile** | In `Mobile/src/config/index.ts` | `export const GOOGLE_WEB_CLIENT_ID = '123456789-xxxxxx.apps.googleusercontent.com';` |

Use the **same** Web Client ID in both. Replace `123456789-xxxxxx...` with your actual value.

---

## Step 6: iOS – Add URL Scheme (For Sign-In to Return to App)

The Web Client ID looks like: `123456789-abcdefg.apps.googleusercontent.com`.  
The **reversed client ID** for the URL scheme is: `com.googleusercontent.apps.123456789-abcdefg` (replace the numbers and suffix with your Web client ID’s middle and end part).

1. Open the iOS project in Xcode: `Mobile/ios/<YourApp>.xcworkspace` (use `.xcworkspace`, not `.xcodeproj`).
2. In the left panel, click the **blue project icon** (top), then select the **app target** (e.g. "Gupio" or "Mobile").
3. Open the **"Info"** tab.
4. Under **"URL Types"** (or "URL Schemes"):
   - Click **"+"** to add a new URL type.
   - **Identifier:** e.g. `com.googleusercontent.apps`.
   - **URL Schemes:** one scheme, e.g. `com.googleusercontent.apps.123456789-abcdefg` (the reversed Web client ID: take `123456789-abcdefg.apps.googleusercontent.com` and turn it into `com.googleusercontent.apps.123456789-abcdefg`).
   - **Role:** Editor (or leave default).
5. Save (Cmd+S).

---

## Step 7: Get Your SHA-1 (Android) – Quick Reference

From project root:

```bash
cd Mobile/android
./gradlew signingReport
```

Use the **SHA-1** under the **debug** (or release) variant and add it to the **Android** OAuth client in Google Cloud (Step 4b). If you add a new build type or keystore later, add that SHA-1 as well in the same Android OAuth client or create another Android client.

---

## Step 8: Checklist Before Testing

- [ ] Google Cloud project created and selected.
- [ ] OAuth consent screen configured (External, app name, scopes, test users if in Testing).
- [ ] **Web application** OAuth client created; **Client ID** copied.
- [ ] **Android** OAuth client created with correct **package name** and **SHA-1**.
- [ ] **iOS** OAuth client created with correct **Bundle ID**.
- [ ] `Backend/.env`: `GOOGLE_CLIENT_ID=<Web Client ID>`.
- [ ] `Mobile/src/config/index.ts`: `GOOGLE_WEB_CLIENT_ID = '<Web Client ID>'`.
- [ ] iOS: URL scheme added (reversed Web client ID) in Xcode.
- [ ] Database migration for `Customer.googleId` applied (`pnpm db:migrate` or run the migration SQL).

---

## Step 9: Test

1. Start backend: e.g. `pnpm run dev` in Backend.
2. Run the mobile app (Android or iOS).
3. On the Sign in screen, tap **"Sign in with Google"**.
4. Choose a Google account (must be a test user if the app is in Testing mode).
5. You should be signed in and taken to the main app.

If you see "Developer Error" or "Sign-In failed", double-check:
- **Android:** Package name and SHA-1 match the Android OAuth client.
- **iOS:** Bundle ID matches the iOS OAuth client and the URL scheme is exactly the reversed Web client ID.
- **Backend & Mobile:** Same Web Client ID in both `.env` and `GOOGLE_WEB_CLIENT_ID`.

---

## Summary: What You Get from Google Cloud

| Item | Where to get it | Used in |
|------|-----------------|--------|
| **Web Client ID** | Credentials → OAuth 2.0 Client IDs → Web application | Backend `GOOGLE_CLIENT_ID`, Mobile `GOOGLE_WEB_CLIENT_ID` |
| **Android Client** | Same → Android (package name + SHA-1) | Links Android app to project; no ID in code |
| **iOS Client** | Same → iOS (Bundle ID) | Links iOS app to project; no ID in code |
| **Reversed Web Client ID** | Same Web Client ID, reordered as `com.googleusercontent.apps.XXXX` | iOS URL scheme in Xcode |

That’s all you need from Google Cloud for Google Sign-In in this project.
