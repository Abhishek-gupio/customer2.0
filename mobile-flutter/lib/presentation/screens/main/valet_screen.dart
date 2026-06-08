import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:gupio_customer/presentation/theme/app_theme.dart';

class ValetScreen extends ConsumerWidget {
  const ValetScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(title: const Text('Valet Parking')),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          _InfoBanner(),
          const SizedBox(height: 16),
          _QuickActions(),
          const SizedBox(height: 16),
          _FeaturedLocations(),
        ],
      ),
    );
  }
}

class _InfoBanner extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          colors: [Color(0xFF1E40AF), Color(0xFF3B82F6)],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(16),
      ),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        const Icon(Icons.local_parking, color: Colors.white, size: 36),
        const SizedBox(height: 12),
        const Text('Smart Valet', style: TextStyle(color: Colors.white, fontSize: 22, fontWeight: FontWeight.w700, fontFamily: 'Outfit')),
        const SizedBox(height: 6),
        const Text('Book hassle-free valet parking at top locations across the city.',
            style: TextStyle(color: Colors.white70, fontSize: 14, fontFamily: 'Outfit')),
        const SizedBox(height: 16),
        ElevatedButton(
          onPressed: () {},
          style: ElevatedButton.styleFrom(
            backgroundColor: Colors.white,
            foregroundColor: AppColors.primary,
            padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 12),
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
          ),
          child: const Text('Find Parking', style: TextStyle(fontWeight: FontWeight.w700)),
        ),
      ]),
    );
  }
}

class _QuickActions extends StatelessWidget {
  static const _actions = [
    {'icon': Icons.search, 'label': 'Find Slot'},
    {'icon': Icons.history, 'label': 'History'},
    {'icon': Icons.qr_code_scanner, 'label': 'Scan QR'},
    {'icon': Icons.support_agent, 'label': 'Support'},
  ];

  @override
  Widget build(BuildContext context) {
    return Row(
      children: _actions.map((a) {
        return Expanded(
          child: GestureDetector(
            onTap: () {},
            child: Container(
              margin: const EdgeInsets.only(right: 8),
              padding: const EdgeInsets.symmetric(vertical: 16),
              decoration: BoxDecoration(
                color: AppColors.surface,
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: AppColors.border),
              ),
              child: Column(children: [
                Icon(a['icon'] as IconData, color: AppColors.primary, size: 26),
                const SizedBox(height: 6),
                Text(a['label'] as String, style: const TextStyle(fontSize: 12, fontFamily: 'Outfit', fontWeight: FontWeight.w600)),
              ]),
            ),
          ),
        );
      }).toList(),
    );
  }
}

class _FeaturedLocations extends StatelessWidget {
  static const _locs = [
    {'name': 'Phoenix Mall', 'area': 'Wakad', 'price': '₹50/hr', 'rating': '4.8'},
    {'name': 'JW Marriott', 'area': 'Senapati Bapat Rd', 'price': '₹80/hr', 'rating': '4.9'},
    {'name': 'Inorbit Mall', 'area': 'Viman Nagar', 'price': '₹40/hr', 'rating': '4.6'},
  ];

  @override
  Widget build(BuildContext context) {
    return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      Text('Featured Locations', style: Theme.of(context).textTheme.titleMedium),
      const SizedBox(height: 12),
      ..._locs.map((l) => Container(
            margin: const EdgeInsets.only(bottom: 10),
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              color: AppColors.surface,
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: AppColors.border),
            ),
            child: Row(children: [
              Container(
                width: 48, height: 48,
                decoration: BoxDecoration(color: AppColors.primary.withOpacity(0.1), borderRadius: BorderRadius.circular(10)),
                child: const Icon(Icons.local_parking, color: AppColors.primary),
              ),
              const SizedBox(width: 12),
              Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text(l['name']!, style: Theme.of(context).textTheme.titleMedium),
                Text(l['area']!, style: const TextStyle(color: AppColors.textSecondary, fontSize: 13)),
              ])),
              Column(crossAxisAlignment: CrossAxisAlignment.end, children: [
                Text(l['price']!, style: const TextStyle(color: AppColors.primary, fontWeight: FontWeight.w700, fontFamily: 'Outfit')),
                Row(children: [
                  const Icon(Icons.star, color: Color(0xFFF59E0B), size: 14),
                  const SizedBox(width: 2),
                  Text(l['rating']!, style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600)),
                ]),
              ]),
            ]),
          )),
    ]);
  }
}
