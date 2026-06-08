import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:gupio_customer/presentation/providers/customer_provider.dart';
import 'package:gupio_customer/presentation/providers/vehicle_provider.dart';
import 'package:gupio_customer/presentation/providers/notification_provider.dart';
import 'package:gupio_customer/presentation/router/app_router.dart';
import 'package:gupio_customer/presentation/theme/app_theme.dart';

class HomeScreen extends ConsumerStatefulWidget {
  const HomeScreen({super.key});

  @override
  ConsumerState<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends ConsumerState<HomeScreen> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      ref.read(customerProvider.notifier).fetchProfile();
      ref.read(vehicleProvider.notifier).fetchVehicles();
      ref.read(notificationProvider.notifier).fetchNotifications();
    });
  }

  @override
  Widget build(BuildContext context) {
    final customer = ref.watch(customerProvider);
    final vehicles = ref.watch(vehicleProvider);
    final notifications = ref.watch(notificationProvider);

    final name = (customer.profile?['fullName'] ?? customer.profile?['phoneNumber'] ?? 'User').toString();
    final firstName = name.split(' ').first;

    return Scaffold(
      backgroundColor: AppColors.background,
      body: SafeArea(
        child: RefreshIndicator(
          onRefresh: () async {
            await Future.wait([
              ref.read(customerProvider.notifier).fetchProfile(),
              ref.read(vehicleProvider.notifier).fetchVehicles(),
            ]);
          },
          child: CustomScrollView(
            slivers: [
              SliverToBoxAdapter(child: _Header(firstName: firstName, unreadCount: notifications.unreadCount)),
              if (vehicles.vehicles.isNotEmpty) SliverToBoxAdapter(child: _VehicleCarousel(vehicles: vehicles.vehicles)),
              if (vehicles.vehicles.isEmpty && !vehicles.isLoading)
                SliverToBoxAdapter(child: _AddVehicleBanner()),
              SliverToBoxAdapter(child: _QuickActions()),
              SliverToBoxAdapter(child: _StatsRow(vehicles: vehicles.vehicles)),
              const SliverToBoxAdapter(child: SizedBox(height: 100)),
            ],
          ),
        ),
      ),
    );
  }
}

class _Header extends StatelessWidget {
  final String firstName;
  final int unreadCount;
  const _Header({required this.firstName, required this.unreadCount});

  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.fromLTRB(20, 16, 20, 8),
    child: Row(
      children: [
        Expanded(
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text('Hello, $firstName 👋', style: Theme.of(context).textTheme.headlineMedium),
            const SizedBox(height: 2),
            Text("What's on your mind today?", style: Theme.of(context).textTheme.bodyMedium),
          ]),
        ),
        Stack(
          children: [
            IconButton(
              icon: const Icon(Icons.notifications_outlined),
              onPressed: () {},
              iconSize: 28,
            ),
            if (unreadCount > 0) Positioned(
              right: 8, top: 8,
              child: Container(
                width: 16, height: 16,
                decoration: const BoxDecoration(color: AppColors.error, shape: BoxShape.circle),
                child: Center(child: Text('$unreadCount', style: const TextStyle(color: Colors.white, fontSize: 9, fontWeight: FontWeight.w700))),
              ),
            ),
          ],
        ),
      ],
    ),
  );
}

class _VehicleCarousel extends StatelessWidget {
  final List<Map<String, dynamic>> vehicles;
  const _VehicleCarousel({required this.vehicles});

  @override
  Widget build(BuildContext context) => SizedBox(
    height: 180,
    child: ListView.builder(
      scrollDirection: Axis.horizontal,
      padding: const EdgeInsets.symmetric(horizontal: 20),
      itemCount: vehicles.length,
      itemBuilder: (_, i) {
        final v = vehicles[i];
        final health = (v['healthScore']?['overallScore'] ?? v['healthScore'] ?? 0) as num;
        return GestureDetector(
          onTap: () => context.push('/garage/${v['id']}'),
          child: Container(
            width: 260,
            margin: const EdgeInsets.only(right: 12, bottom: 8),
            padding: const EdgeInsets.all(20),
            decoration: BoxDecoration(
              gradient: const LinearGradient(colors: [AppColors.primary, AppColors.primaryDark], begin: Alignment.topLeft, end: Alignment.bottomRight),
              borderRadius: BorderRadius.circular(20),
              boxShadow: [BoxShadow(color: AppColors.primary.withOpacity(0.3), blurRadius: 12, offset: const Offset(0, 6))],
            ),
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Row(children: [
                const Icon(Icons.directions_car, color: Colors.white70, size: 20),
                const SizedBox(width: 8),
                Text(v['brand']?.toString() ?? 'Vehicle', style: const TextStyle(color: Colors.white70, fontSize: 13, fontFamily: 'Outfit')),
              ]),
              const Spacer(),
              Text(v['registrationNumber']?.toString() ?? '', style: const TextStyle(color: Colors.white, fontSize: 22, fontWeight: FontWeight.w700, letterSpacing: 1, fontFamily: 'Outfit')),
              const SizedBox(height: 4),
              Text(v['model']?.toString() ?? '', style: const TextStyle(color: Colors.white70, fontSize: 13, fontFamily: 'Outfit')),
              const SizedBox(height: 12),
              Row(children: [
                const Icon(Icons.favorite, color: Colors.greenAccent, size: 14),
                const SizedBox(width: 4),
                Text('Health: ${health.toStringAsFixed(0)}%', style: const TextStyle(color: Colors.white, fontSize: 12, fontFamily: 'Outfit')),
              ]),
            ]),
          ),
        );
      },
    ),
  );
}

class _AddVehicleBanner extends StatelessWidget {
  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 8),
    child: GestureDetector(
      onTap: () => context.push(AppRoutes.addVehicle),
      child: Container(
        padding: const EdgeInsets.all(20),
        decoration: BoxDecoration(
          color: AppColors.surface,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: AppColors.border, style: BorderStyle.solid),
        ),
        child: Row(children: [
          Container(padding: const EdgeInsets.all(12), decoration: BoxDecoration(color: AppColors.primary.withOpacity(0.1), borderRadius: BorderRadius.circular(12)),
            child: const Icon(Icons.add, color: AppColors.primary)),
          const SizedBox(width: 16),
          Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text('Add your first vehicle', style: Theme.of(context).textTheme.titleMedium),
            const SizedBox(height: 2),
            Text('Tap to register your car, bike or truck', style: Theme.of(context).textTheme.bodyMedium),
          ])),
          const Icon(Icons.chevron_right, color: AppColors.textSecondary),
        ]),
      ),
    ),
  );
}

class _QuickActions extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    final actions = [
      _QA('Expenses', Icons.receipt_long, AppColors.warning, AppRoutes.expenses),
      _QA('Documents', Icons.folder_open, AppColors.accent, AppRoutes.documents),
      _QA('Services', Icons.build_circle, AppColors.primary, AppRoutes.serviceHistory),
      _QA('AI Coach', Icons.smart_toy, const Color(0xFF8B5CF6), AppRoutes.aiHome),
    ];
    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 20, 20, 0),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Text('Quick Actions', style: Theme.of(context).textTheme.titleMedium),
        const SizedBox(height: 12),
        Row(
          children: actions.map((a) => Expanded(
            child: Padding(
              padding: const EdgeInsets.only(right: 8),
              child: GestureDetector(
                onTap: () => context.push(a.route),
                child: Container(
                  padding: const EdgeInsets.symmetric(vertical: 16),
                  decoration: BoxDecoration(
                    color: a.color.withOpacity(0.08),
                    borderRadius: BorderRadius.circular(14),
                    border: Border.all(color: a.color.withOpacity(0.15)),
                  ),
                  child: Column(children: [
                    Icon(a.icon, color: a.color, size: 24),
                    const SizedBox(height: 6),
                    Text(a.label, style: TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: a.color, fontFamily: 'Outfit')),
                  ]),
                ),
              ),
            ),
          )).toList(),
        ),
      ]),
    );
  }
}

class _QA {
  final String label, route;
  final IconData icon;
  final Color color;
  const _QA(this.label, this.icon, this.color, this.route);
}

class _StatsRow extends StatelessWidget {
  final List<Map<String, dynamic>> vehicles;
  const _StatsRow({required this.vehicles});

  @override
  Widget build(BuildContext context) {
    final avgHealth = vehicles.isEmpty ? 0 : (vehicles.map((v) => ((v['healthScore']?['overallScore'] ?? 0) as num).toDouble()).fold(0.0, (a, b) => a + b) / vehicles.length).round();
    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 20, 20, 0),
      child: Row(children: [
        _StatCard('Vehicles', '${vehicles.length}', Icons.directions_car, AppColors.primary),
        const SizedBox(width: 12),
        _StatCard('Avg Health', '$avgHealth%', Icons.favorite, AppColors.success),
      ]),
    );
  }
}

class _StatCard extends StatelessWidget {
  final String label, value;
  final IconData icon;
  final Color color;
  const _StatCard(this.label, this.value, this.icon, this.color);

  @override
  Widget build(BuildContext context) => Expanded(
    child: Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(color: AppColors.surface, borderRadius: BorderRadius.circular(14), border: Border.all(color: AppColors.border)),
      child: Row(children: [
        Icon(icon, color: color, size: 22),
        const SizedBox(width: 10),
        Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text(value, style: TextStyle(fontSize: 18, fontWeight: FontWeight.w700, color: color, fontFamily: 'Outfit')),
          Text(label, style: Theme.of(context).textTheme.bodyMedium?.copyWith(fontSize: 11)),
        ]),
      ]),
    ),
  );
}
