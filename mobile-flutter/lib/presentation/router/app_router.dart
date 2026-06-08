import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:gupio_customer/presentation/providers/auth_provider.dart';
import 'package:gupio_customer/presentation/screens/auth/phone_entry_screen.dart';
import 'package:gupio_customer/presentation/screens/auth/otp_screen.dart';
import 'package:gupio_customer/presentation/screens/auth/login_success_screen.dart';
import 'package:gupio_customer/presentation/screens/auth/signup_screen.dart';
import 'package:gupio_customer/presentation/screens/main/shell_scaffold.dart';
import 'package:gupio_customer/presentation/screens/main/home_screen.dart';
import 'package:gupio_customer/presentation/screens/main/alerts_screen.dart';
import 'package:gupio_customer/presentation/screens/main/valet_screen.dart';
import 'package:gupio_customer/presentation/screens/garage/garage_screen.dart';
import 'package:gupio_customer/presentation/screens/garage/add_vehicle_screen.dart';
import 'package:gupio_customer/presentation/screens/garage/vehicle_detail_screen.dart';
import 'package:gupio_customer/presentation/screens/garage/challans_screen.dart';
import 'package:gupio_customer/presentation/screens/expenses/expense_list_screen.dart';
import 'package:gupio_customer/presentation/screens/expenses/add_expense_screen.dart';
import 'package:gupio_customer/presentation/screens/expenses/expense_analytics_screen.dart';
import 'package:gupio_customer/presentation/screens/expenses/budget_settings_screen.dart';
import 'package:gupio_customer/presentation/screens/documents/document_list_screen.dart';
import 'package:gupio_customer/presentation/screens/documents/digilocker_screen.dart';
import 'package:gupio_customer/presentation/screens/profile/profile_screen.dart';
import 'package:gupio_customer/presentation/screens/profile/settings_screen.dart';
import 'package:gupio_customer/presentation/screens/profile/help_support_screen.dart';
import 'package:gupio_customer/presentation/screens/profile/contact_support_screen.dart';
import 'package:gupio_customer/presentation/screens/profile/ticket_history_screen.dart';
import 'package:gupio_customer/presentation/screens/profile/ticket_detail_screen.dart';
import 'package:gupio_customer/presentation/screens/profile/terms_screen.dart';
import 'package:gupio_customer/presentation/screens/profile/privacy_screen.dart';
import 'package:gupio_customer/presentation/screens/profile/sos_screen.dart';
import 'package:gupio_customer/presentation/screens/ai_bot/ai_home_screen.dart';
import 'package:gupio_customer/presentation/screens/ai_bot/chat_sessions_screen.dart';
import 'package:gupio_customer/presentation/screens/telematics/driving_summary_screen.dart';
import 'package:gupio_customer/presentation/screens/telematics/driving_timeline_screen.dart';
import 'package:gupio_customer/presentation/screens/telematics/trip_detail_screen.dart';
import 'package:gupio_customer/presentation/screens/services/service_history_screen.dart';
import 'package:gupio_customer/presentation/screens/services/warranty_status_screen.dart';
import 'package:gupio_customer/presentation/screens/services/dl_verification_screen.dart';
import 'package:gupio_customer/presentation/screens/services/fastag_screen.dart';
import 'package:gupio_customer/presentation/screens/services/diy_guides_screen.dart';
import 'package:gupio_customer/presentation/screens/trip/trip_expense_screen.dart';
import 'package:gupio_customer/presentation/screens/trip/trip_insights_screen.dart';

/// Route path constants — mirrors RootStackParamList from React Native.
abstract final class AppRoutes {
  static const splash = '/';
  static const phoneEntry = '/auth/phone';
  static const otp = '/auth/otp';
  static const signup = '/auth/signup';
  static const loginSuccess = '/auth/success';
  static const home = '/home';
  static const alerts = '/alerts';
  static const valet = '/valet';
  static const garage = '/garage';
  static const addVehicle = '/garage/add';
  static const vehicleDetail = '/garage/:vehicleId';
  static const challans = '/garage/:vehicleId/challans';
  static const expenses = '/expenses';
  static const addExpense = '/expenses/add';
  static const expenseAnalytics = '/expenses/analytics';
  static const budgetSettings = '/expenses/budget';
  static const documents = '/documents';
  static const digilocker = '/documents/digilocker';
  static const profile = '/profile';
  static const settings = '/profile/settings';
  static const helpSupport = '/profile/support';
  static const contactSupport = '/profile/contact';
  static const tickets = '/profile/tickets';
  static const ticketDetail = '/profile/tickets/:ticketId';
  static const terms = '/profile/terms';
  static const privacy = '/profile/privacy';
  static const sos = '/profile/sos';
  static const aiHome = '/ai';
  static const chatSessions = '/ai/sessions';
  static const drivingSummary = '/telematics/summary';
  static const drivingTimeline = '/telematics/timeline';
  static const tripDetail = '/telematics/trip/:tripId';
  static const serviceHistory = '/services/history';
  static const warrantyStatus = '/services/warranty';
  static const dlVerification = '/services/dl';
  static const fastag = '/services/fastag';
  static const diyGuides = '/services/diy';
  static const tripExpense = '/trip';
  static const tripInsights = '/trip/insights';
}

/// GoRouter provider — replaces RootNavigator + MainBottomTabs from React Native.
final routerProvider = Provider<GoRouter>((ref) {
  final authState = ref.watch(authProvider);
  return GoRouter(
    initialLocation: AppRoutes.splash,
    redirect: (context, state) {
      // Hold on splash while session restore is in progress
      if (authState.isLoading) return null;
      final isAuth = authState.isAuthenticated;
      final isOnAuthPage = state.matchedLocation.startsWith('/auth');
      // Not authenticated → send to phone entry (covers '/' too)
      if (!isAuth && !isOnAuthPage) return AppRoutes.phoneEntry;
      // Authenticated but on auth page or splash → send home
      if (isAuth && (isOnAuthPage || state.matchedLocation == '/')) return AppRoutes.home;
      return null;
    },
    routes: [
      GoRoute(path: '/', builder: (_, __) => const _SplashRedirect()),
      GoRoute(path: AppRoutes.phoneEntry, builder: (_, __) => const PhoneEntryScreen()),
      GoRoute(
        path: AppRoutes.otp,
        builder: (_, state) => OtpScreen(phone: state.uri.queryParameters['phone'] ?? ''),
      ),
      GoRoute(path: AppRoutes.signup, builder: (_, __) => const SignupScreen()),
      GoRoute(path: AppRoutes.loginSuccess, builder: (_, __) => const LoginSuccessScreen()),

      // Shell scaffold wraps home, garage, expenses, profile, AI (bottom tabs)
      ShellRoute(
        builder: (_, __, child) => ShellScaffold(child: child),
        routes: [
          GoRoute(path: AppRoutes.home, builder: (_, __) => const HomeScreen()),
          GoRoute(path: AppRoutes.alerts, builder: (_, __) => const AlertsScreen()),
          GoRoute(path: AppRoutes.valet, builder: (_, __) => const ValetScreen()),
          GoRoute(
            path: AppRoutes.garage,
            builder: (_, __) => const GarageScreen(),
            routes: [
              GoRoute(path: 'add', builder: (_, __) => const AddVehicleScreen()),
              GoRoute(
                path: ':vehicleId',
                builder: (_, state) => VehicleDetailScreen(vehicleId: state.pathParameters['vehicleId']!),
                routes: [
                  GoRoute(
                    path: 'challans',
                    builder: (_, state) => ChallansScreen(vehicleId: state.pathParameters['vehicleId']!),
                  ),
                ],
              ),
            ],
          ),
          GoRoute(
            path: AppRoutes.expenses,
            builder: (_, __) => const ExpenseListScreen(),
            routes: [
              GoRoute(path: 'add', builder: (_, __) => const AddExpenseScreen()),
              GoRoute(path: 'analytics', builder: (_, __) => const ExpenseAnalyticsScreen()),
              GoRoute(path: 'budget', builder: (_, __) => const BudgetSettingsScreen()),
            ],
          ),
          GoRoute(
            path: AppRoutes.documents,
            builder: (_, __) => const DocumentListScreen(),
            routes: [
              GoRoute(path: 'digilocker', builder: (_, __) => const DigiLockerScreen()),
            ],
          ),
          GoRoute(
            path: AppRoutes.profile,
            builder: (_, __) => const ProfileScreen(),
            routes: [
              GoRoute(path: 'settings', builder: (_, __) => const SettingsScreen()),
              GoRoute(path: 'support', builder: (_, __) => const HelpSupportScreen()),
              GoRoute(path: 'contact', builder: (_, __) => const ContactSupportScreen()),
              GoRoute(
                path: 'tickets',
                builder: (_, __) => const TicketHistoryScreen(),
                routes: [
                  GoRoute(
                    path: ':ticketId',
                    builder: (_, s) => TicketDetailScreen(ticketId: s.pathParameters['ticketId']!),
                  ),
                ],
              ),
              GoRoute(path: 'terms', builder: (_, __) => const TermsScreen()),
              GoRoute(path: 'privacy', builder: (_, __) => const PrivacyScreen()),
              GoRoute(path: 'sos', builder: (_, __) => const SosScreen()),
            ],
          ),
          GoRoute(
            path: AppRoutes.aiHome,
            builder: (_, __) => const AiHomeScreen(),
            routes: [
              GoRoute(path: 'sessions', builder: (_, __) => const ChatSessionsScreen()),
            ],
          ),
        ],
      ),

      // Non-tab routes
      GoRoute(path: AppRoutes.drivingSummary, builder: (_, __) => const DrivingSummaryScreen()),
      GoRoute(path: AppRoutes.drivingTimeline, builder: (_, __) => const DrivingTimelineScreen()),
      GoRoute(
        path: '/telematics/trip/:tripId',
        builder: (_, s) => TripDetailScreen(tripId: s.pathParameters['tripId']!),
      ),
      GoRoute(path: AppRoutes.serviceHistory, builder: (_, __) => const ServiceHistoryScreen()),
      GoRoute(path: AppRoutes.warrantyStatus, builder: (_, __) => const WarrantyStatusScreen()),
      GoRoute(path: AppRoutes.dlVerification, builder: (_, __) => const DlVerificationScreen()),
      GoRoute(path: AppRoutes.fastag, builder: (_, __) => const FastagScreen()),
      GoRoute(path: AppRoutes.diyGuides, builder: (_, __) => const DiyGuidesScreen()),
      GoRoute(path: AppRoutes.tripExpense, builder: (_, __) => const TripExpenseScreen()),
      GoRoute(path: AppRoutes.tripInsights, builder: (_, __) => const TripInsightsScreen()),
    ],
  );
});

class _SplashRedirect extends StatelessWidget {
  const _SplashRedirect();
  @override
  Widget build(BuildContext context) => const Scaffold(
        body: Center(child: CircularProgressIndicator()),
      );
}
