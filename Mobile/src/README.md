# Gupio Customer App – `src/` structure

This folder follows **GUPIO_FRONTEND_PLAN.md**: folder structure and dependencies only. All files are placeholders ready for implementation.

## Structure

| Folder        | Purpose |
|---------------|---------|
| `assets/`     | icons, images, fonts, animations |
| `components/` | 40+ UI components (Button, Card, VehicleCard, etc.) |
| `screens/`    | Auth, Main, Valet, Vehicles, Documents, Expenses, RTO, Profile, Other |
| `navigation/` | RootNavigator, BottomTabNavigator, AuthNavigator, MainNavigator, linking |
| `context/`   | Auth, Vehicle, Theme, Notification |
| `hooks/`      | useAuth, useVehicle, useVoiceInput, useLocation, etc. |
| `services/`  | api, auth, vehicle, expense, document, rto, ai, valet, analytics |
| `store/`     | Zustand: auth, vehicle, chat, expense, notification |
| `theme/`     | colors, typography, spacing, shadows, borderRadius |
| `types/`     | navigation, vehicle, expense, document, api |
| `utils/`     | formatters, validators, constants, dateHelpers, permissions, errorHandlers |
| `validation/`| vehicleSchema, expenseSchema, profileSchema (zod) |
| `lib/`       | queryClient, sentry |
| `config/`    | app config |

## Installed dependencies (from plan)

- **Navigation:** @react-navigation/bottom-tabs, react-native-gesture-handler
- **State:** zustand, @tanstack/react-query
- **UI:** lucide-react-native, react-native-paper, @shopify/flash-list, moti, react-native-svg
- **Forms:** react-hook-form, zod
- **Networking:** axios
- **Storage:** @react-native-async-storage/async-storage
- **Utils:** date-fns, lodash, @react-native-community/netinfo

Native modules (voice, maps, PDF, Firebase, Sentry) can be added when you move to a development build or Expo config plugins.
