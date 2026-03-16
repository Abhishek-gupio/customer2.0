# Google Sign-In Setup

**For a full step-by-step guide in Google Cloud (every click and field), see [GOOGLE_CLOUD_STEP_BY_STEP.md](./GOOGLE_CLOUD_STEP_BY_STEP.md).**

## 1. Google Cloud Console

1. Go to [Google Cloud Console](https://console.cloud.google.com/).
2. Create or select a project.
3. Configure the **OAuth consent screen** (APIs & Services → OAuth consent screen) — required before creating credentials.
4. Go to **APIs & Services → Credentials** and create:
   - **OAuth 2.0 Client ID – Web application**  
     Use this value for **backend** and **mobile** (Web client ID).
   - **OAuth 2.0 Client ID – Android** (for Android app): add package name and SHA-1.
   - **OAuth 2.0 Client ID – iOS** (for iOS app): add bundle ID and optional URL scheme.

Use the **Web application** client ID as the single audience for ID token verification and for the mobile app’s `webClientId` (so the app gets an ID token).

## 2. Backend

- In `.env` (or your env source), set:
  ```env
  GOOGLE_CLIENT_ID=<your-web-application-client-id>.apps.googleusercontent.com
  ```
- Restart the server. The `POST /api/v1/auth/google` endpoint will verify the Google ID token and return app tokens.

## 3. Mobile (React Native)

- In `Mobile/src/config/index.ts`, set:
  ```ts
  export const GOOGLE_WEB_CLIENT_ID = '<same-web-application-client-id>.apps.googleusercontent.com';
  ```
  Use the **same** Web client ID as the backend.

### Android

- Add your app’s **SHA-1** to the Android OAuth client in Google Cloud (Credentials → Android).
- If you use a debug keystore:
  ```bash
  cd android && ./gradlew signingReport
  ```
  Use the SHA-1 from the debug variant.

### iOS

- In Xcode, add a URL scheme for the reversed client ID (e.g. `com.googleusercontent.apps.XXXXX`).
- Optionally add `GoogleService-Info.plist` if you use Firebase; the Google Sign-In library can work with only the Web client ID and URL scheme.

## 4. Database

- Run the migration that adds `googleId` to `Customer`:
  ```bash
  pnpm db:migrate
  ```
  Or apply manually: `prisma/prisma/migrations/20260314000000_add_customer_google_id/migration.sql`

## 5. Flow

1. User taps “Sign in with Google” on the Signin screen.
2. App uses `@react-native-google-signin/google-signin` to sign in and obtain an ID token.
3. App sends `POST /api/v1/auth/google` with `{ "idToken": "..." }`.
4. Backend verifies the token with Google, finds or creates a `Customer` (by `googleId` or email), and returns `accessToken` and `refreshToken`.
5. App stores tokens and navigates to the main app.
