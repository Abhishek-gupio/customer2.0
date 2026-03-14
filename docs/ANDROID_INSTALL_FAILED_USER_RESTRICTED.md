# Fix: INSTALL_FAILED_USER_RESTRICTED (run on physical device)

The app **builds successfully**. The failure is the **install** step when you run `pnpm android` with a physical device. Use the steps below so the device allows the install and you can run normally.

## 1. Developer options (do all that apply)

- **Settings** → **Developer options**
- Turn **ON**: **USB debugging**
- Turn **ON**: **Install via USB** / **USB debugging (Security settings)** / **Disable permission monitoring** (name varies by brand)
- **Xiaomi/Redmi:** Log in with Mi account; "Install via USB" can take 24–168 hours to activate in some regions. Also try turning **OFF** "MIUI optimization" (Developer options) temporarily.

## 2. When you run `pnpm android`

- Keep the **phone screen on** and **unlocked** when the build finishes.
- As soon as the install starts, the phone may show **"Allow install?"** / **"Install this app?"** — tap **Allow** or **Install**. If you miss it or tap Cancel, run `pnpm android` again and accept the prompt.

## 3. Revoke and re-allow USB debugging

- **Settings** → **Developer options** → **Revoke USB debugging authorizations**
- Unplug the USB cable, then plug it back in
- On the phone, tap **Allow** when it asks to allow this computer
- Run `pnpm android` again and, when the install prompt appears, tap **Allow**

## 4. Try wireless debugging (Android 11+)

Sometimes install works over WiFi when it fails over USB:

- **Settings** → **Developer options** → **Wireless debugging** → ON
- Tap **Wireless debugging** → **Pair device with pairing code**. Note the IP:port and pairing code.
- On your Mac (same Wi‑Fi):  
  `adb pair <IP>:<pairing_port>`  
  Enter the pairing code when asked.  
  Then:  
  `adb connect <IP>:5555`
- Unplug USB. Run `pnpm android` (device will be found over WiFi). When the install prompt appears on the phone, tap **Allow**.

## 5. Cable and connection

- Use a **data-capable USB cable** (some cables are charge-only).
- Try another USB port.
- Ensure only one device is connected: `adb devices` should list a single device.

---

After the device allows the install once, future `pnpm android` runs should install and launch the app on the physical device without building a separate APK.

---

## If nothing works: build once, install from phone

Some devices (especially Xiaomi, Oppo, Vivo) block USB installs no matter what. Use this flow to **run on the physical device** without relying on "Install via USB":

1. **Build the app (no install):**
   ```bash
   cd Mobile && pnpm android:build
   ```
   This only compiles; it does not run the install step, so you won't see INSTALL_FAILED_USER_RESTRICTED.

2. **Copy the APK to your phone**  
   Path: `Mobile/android/app/build/outputs/apk/debug/app-debug.apk`  
   Copy via:
   - USB: connect phone as file transfer (MTP), copy the file to the phone’s Download folder, or
   - Google Drive / WhatsApp / Telegram: upload the APK, then download it on the phone.

3. **On the phone:** Open the APK (Files / My Files / Downloads) and tap **Install**. If asked, allow **Install unknown apps** for that app. This uses normal app install, not USB install, so the restriction usually doesn’t apply.

4. **Start Metro and open the app:**
   - On your Mac: `cd Mobile && pnpm start` (keep this running).
   - On the phone: open the installed app. It will connect to Metro and load the JS bundle (ensure phone and Mac are on the same Wi‑Fi and that Metro is reachable; you may need to shake the device and set the debug server to your Mac’s IP:port if it doesn’t connect automatically).

For the next code change: run `pnpm android:build` again, copy the new APK to the phone, and install (replace the existing app). Or, once the device allows USB install in the future, you can switch back to `pnpm android`.
