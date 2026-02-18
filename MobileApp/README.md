# MobileApp

React Native app built with **Expo** and **Expo Router** (file-based routing, TypeScript).

## Setup

From the repo root:

```bash
pnpm install
```

Dependencies are hoisted by the pnpm workspace.

## Run

From repo root (runs all workspace `dev` scripts):

```bash
pnpm dev
```

Or run only the mobile app from this folder:

```bash
cd MobileApp
pnpm start
# or
pnpm ios      # iOS simulator
pnpm android  # Android emulator
pnpm web      # Web (Expo for web)
```

## Scripts

| Script     | Description                    |
|-----------|---------------------------------|
| `start`   | Start Expo dev server          |
| `dev`     | Same as `start` (for turbo)    |
| `ios`     | Open in iOS simulator          |
| `android` | Open in Android emulator       |
| `web`     | Run in browser                 |
| `build`   | Export for web (`expo export`) |
| `lint`    | Run Expo lint                  |

## Structure

- `app/` – Expo Router screens and layouts (file-based routing)
- `components/` – Reusable UI components
- `constants/` – Theme, colors, etc.
- `assets/` – Images, fonts

## Monorepo

This package is `@repo/mobile-app` and is part of the customer2.0 pnpm workspace. Use the Backend API and shared Prisma client from other packages as needed.
