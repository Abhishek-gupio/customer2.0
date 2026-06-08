import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:gupio_customer/presentation/router/app_router.dart';
import 'package:gupio_customer/presentation/theme/app_theme.dart';

/// Bottom navigation shell — mirrors MainBottomTabs from React Native.
class ShellScaffold extends ConsumerWidget {
  final Widget child;
  const ShellScaffold({super.key, required this.child});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final location = GoRouterState.of(context).matchedLocation;
    final tabIndex = _tabIndex(location);

    return Scaffold(
      body: child,
      bottomNavigationBar: NavigationBar(
        selectedIndex: tabIndex < 0 ? 0 : tabIndex,
        onDestinationSelected: (i) => _onTab(context, i),
        destinations: const [
          NavigationDestination(icon: Icon(Icons.home_outlined), selectedIcon: Icon(Icons.home), label: 'Home'),
          NavigationDestination(icon: Icon(Icons.directions_car_outlined), selectedIcon: Icon(Icons.directions_car), label: 'Garage'),
          NavigationDestination(icon: Icon(Icons.receipt_long_outlined), selectedIcon: Icon(Icons.receipt_long), label: 'Expenses'),
          NavigationDestination(icon: Icon(Icons.smart_toy_outlined), selectedIcon: Icon(Icons.smart_toy), label: 'AI'),
          NavigationDestination(icon: Icon(Icons.person_outline), selectedIcon: Icon(Icons.person), label: 'Profile'),
        ],
      ),
    );
  }

  static int _tabIndex(String location) {
    if (location.startsWith(AppRoutes.garage)) return 1;
    if (location.startsWith(AppRoutes.expenses)) return 2;
    if (location.startsWith(AppRoutes.aiHome)) return 3;
    if (location.startsWith(AppRoutes.profile)) return 4;
    return 0;
  }

  static void _onTab(BuildContext context, int index) {
    const paths = [AppRoutes.home, AppRoutes.garage, AppRoutes.expenses, AppRoutes.aiHome, AppRoutes.profile];
    context.go(paths[index]);
  }
}
