import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:gupio_customer/presentation/providers/auth_provider.dart';
import 'package:gupio_customer/presentation/providers/customer_provider.dart';
import 'package:gupio_customer/presentation/router/app_router.dart';
import 'package:gupio_customer/presentation/theme/app_theme.dart';

class ProfileScreen extends ConsumerStatefulWidget {
  const ProfileScreen({super.key});

  @override
  ConsumerState<ProfileScreen> createState() => _ProfileScreenState();
}

class _ProfileScreenState extends ConsumerState<ProfileScreen> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      ref.read(customerProvider.notifier).fetchProfile();
    });
  }

  @override
  Widget build(BuildContext context) {
    final customer = ref.watch(customerProvider);
    final profile = customer.profile;
    final name = profile?['fullName']?.toString() ?? 'User';
    final phone = profile?['phoneNumber']?.toString() ?? '';
    final email = profile?['email']?.toString();

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(title: const Text('My Profile'), actions: [
        IconButton(icon: const Icon(Icons.settings), onPressed: () => context.push(AppRoutes.settings)),
      ]),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          _Avatar(name: name, imageUrl: profile?['profilePic']?.toString()),
          const SizedBox(height: 8),
          Center(child: Text(name, style: Theme.of(context).textTheme.headlineMedium)),
          if (phone.isNotEmpty) Center(child: Text(phone, style: Theme.of(context).textTheme.bodyMedium)),
          if (email != null) Center(child: Text(email, style: Theme.of(context).textTheme.bodyMedium)),
          const SizedBox(height: 24),
          _Section('Account', [
            _Tile(Icons.edit, 'Edit Profile', () {}),
            _Tile(Icons.notifications_outlined, 'Notifications', () {}),
            _Tile(Icons.lock_outline, 'Privacy', () => context.push(AppRoutes.privacy)),
          ]),
          _Section('Support', [
            _Tile(Icons.help_outline, 'Help & Support', () => context.push(AppRoutes.helpSupport)),
            _Tile(Icons.chat_bubble_outline, 'Contact Us', () => context.push(AppRoutes.contactSupport)),
            _Tile(Icons.receipt_outlined, 'My Tickets', () => context.push(AppRoutes.tickets)),
          ]),
          _Section('Legal', [
            _Tile(Icons.description_outlined, 'Terms & Conditions', () => context.push(AppRoutes.terms)),
            _Tile(Icons.privacy_tip_outlined, 'Privacy Policy', () => context.push(AppRoutes.privacy)),
          ]),
          _Section('Danger Zone', [
            _Tile(Icons.logout, 'Sign Out', _logout, color: AppColors.error),
          ]),
          const SizedBox(height: 80),
        ],
      ),
    );
  }

  void _logout() {
    showDialog(
      context: context,
      builder: (_) => AlertDialog(
        title: const Text('Sign Out'),
        content: const Text('Are you sure you want to sign out?'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context), child: const Text('Cancel')),
          TextButton(
            onPressed: () {
              Navigator.pop(context);
              ref.read(authProvider.notifier).logout();
            },
            child: const Text('Sign Out', style: TextStyle(color: AppColors.error)),
          ),
        ],
      ),
    );
  }
}

class _Avatar extends StatelessWidget {
  final String name;
  final String? imageUrl;
  const _Avatar({required this.name, this.imageUrl});

  @override
  Widget build(BuildContext context) {
    final initials = name.trim().split(' ').map((w) => w.isNotEmpty ? w[0] : '').take(2).join().toUpperCase();
    return Center(
      child: CircleAvatar(
        radius: 48,
        backgroundColor: AppColors.primary,
        backgroundImage: imageUrl != null ? NetworkImage(imageUrl!) : null,
        child: imageUrl == null ? Text(initials, style: const TextStyle(color: Colors.white, fontSize: 28, fontWeight: FontWeight.w700, fontFamily: 'Outfit')) : null,
      ),
    );
  }
}

class _Section extends StatelessWidget {
  final String title;
  final List<Widget> tiles;
  const _Section(this.title, this.tiles);

  @override
  Widget build(BuildContext context) => Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
    Padding(padding: const EdgeInsets.fromLTRB(4, 12, 4, 8), child: Text(title.toUpperCase(), style: Theme.of(context).textTheme.bodyMedium?.copyWith(fontSize: 11, letterSpacing: 1))),
    Container(
      decoration: BoxDecoration(color: AppColors.surface, borderRadius: BorderRadius.circular(14), border: Border.all(color: AppColors.border)),
      child: Column(children: tiles),
    ),
    const SizedBox(height: 8),
  ]);
}

class _Tile extends StatelessWidget {
  final IconData icon;
  final String label;
  final VoidCallback onTap;
  final Color? color;
  const _Tile(this.icon, this.label, this.onTap, {this.color});

  @override
  Widget build(BuildContext context) => ListTile(
    leading: Icon(icon, color: color ?? AppColors.textSecondary, size: 22),
    title: Text(label, style: TextStyle(fontFamily: 'Outfit', fontWeight: FontWeight.w500, color: color ?? AppColors.textPrimary)),
    trailing: const Icon(Icons.chevron_right, color: AppColors.textSecondary),
    onTap: onTap,
  );
}
