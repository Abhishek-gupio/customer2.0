import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:gupio_customer/infrastructure/http/dio_client.dart';
import 'package:gupio_customer/presentation/providers/auth_provider.dart';
import 'package:gupio_customer/presentation/theme/app_theme.dart';

class SettingsScreen extends ConsumerStatefulWidget {
  const SettingsScreen({super.key});

  @override
  ConsumerState<SettingsScreen> createState() => _SettingsScreenState();
}

class _SettingsScreenState extends ConsumerState<SettingsScreen> {
  bool _pushEnabled = true;
  bool _emailEnabled = false;
  bool _smsEnabled = true;
  final _nameCtrl = TextEditingController();
  final _emailCtrl = TextEditingController();
  bool _saving = false;

  @override
  void initState() {
    super.initState();
    _nameCtrl.text = '';
    _emailCtrl.text = '';
  }

  @override
  void dispose() { _nameCtrl.dispose(); _emailCtrl.dispose(); super.dispose(); }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(title: const Text('Settings')),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          _SectionHeader('Profile'),
          _Card(children: [
            TextField(controller: _nameCtrl, decoration: const InputDecoration(labelText: 'Full Name')),
            const SizedBox(height: 12),
            TextField(controller: _emailCtrl, decoration: const InputDecoration(labelText: 'Email'), keyboardType: TextInputType.emailAddress),
            const SizedBox(height: 16),
            ElevatedButton(
              onPressed: _saving ? null : () async {
                setState(() => _saving = true);
                try {
                  await createDioClient().patch('/api/v1/customer/profile', data: {
                    'fullName': _nameCtrl.text.trim(),
                    if (_emailCtrl.text.trim().isNotEmpty) 'email': _emailCtrl.text.trim(),
                  });
                  if (mounted) ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Profile updated!')));
                } catch (_) {} finally { if (mounted) setState(() => _saving = false); }
              },
              child: _saving
                  ? const SizedBox(height: 22, width: 22, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                  : const Text('Save Profile'),
            ),
          ]),
          const SizedBox(height: 16),
          _SectionHeader('Notifications'),
          _Card(children: [
            _SwitchTile('Push Notifications', _pushEnabled, (v) => setState(() => _pushEnabled = v)),
            _SwitchTile('Email Alerts', _emailEnabled, (v) => setState(() => _emailEnabled = v)),
            _SwitchTile('SMS Alerts', _smsEnabled, (v) => setState(() => _smsEnabled = v)),
          ]),
          const SizedBox(height: 16),
          _SectionHeader('Account'),
          _Card(children: [
            _ActionTile(Icons.lock_outline, 'Change Phone Number', () {}),
            _ActionTile(Icons.delete_outline, 'Delete Account', () => _confirmDelete(context), isDestructive: true),
          ]),
          const SizedBox(height: 16),
          _SectionHeader('About'),
          _Card(children: [
            _ActionTile(Icons.info_outline, 'App Version', () {}, trailing: const Text('2.0.0', style: TextStyle(color: AppColors.textSecondary))),
            _ActionTile(Icons.star_outline, 'Rate the App', () {}),
          ]),
        ],
      ),
    );
  }

  void _confirmDelete(BuildContext context) {
    showDialog(context: context, builder: (_) => AlertDialog(
      title: const Text('Delete Account'),
      content: const Text('This will permanently delete your account and all data. This cannot be undone.'),
      actions: [
        TextButton(onPressed: () => Navigator.pop(context), child: const Text('Cancel')),
        TextButton(
          onPressed: () async {
            Navigator.pop(context);
            await createDioClient().delete('/api/v1/customer/account');
            ref.read(authProvider.notifier).logout();
          },
          child: const Text('Delete', style: TextStyle(color: AppColors.error)),
        ),
      ],
    ));
  }
}

class _SectionHeader extends StatelessWidget {
  final String title;
  const _SectionHeader(this.title);

  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.only(left: 4, bottom: 8),
    child: Text(title.toUpperCase(), style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w700, letterSpacing: 1.2, color: AppColors.textSecondary, fontFamily: 'Outfit')),
  );
}

class _Card extends StatelessWidget {
  final List<Widget> children;
  const _Card({required this.children});

  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.all(16),
    decoration: BoxDecoration(color: AppColors.surface, borderRadius: BorderRadius.circular(14), border: Border.all(color: AppColors.border)),
    child: Column(children: children),
  );
}

class _SwitchTile extends StatelessWidget {
  final String label;
  final bool value;
  final ValueChanged<bool> onChanged;
  const _SwitchTile(this.label, this.value, this.onChanged);

  @override
  Widget build(BuildContext context) => Row(children: [
    Expanded(child: Text(label, style: const TextStyle(fontFamily: 'Outfit', fontSize: 15))),
    Switch(value: value, onChanged: onChanged, activeColor: AppColors.primary),
  ]);
}

class _ActionTile extends StatelessWidget {
  final IconData icon;
  final String label;
  final VoidCallback onTap;
  final bool isDestructive;
  final Widget? trailing;
  const _ActionTile(this.icon, this.label, this.onTap, {this.isDestructive = false, this.trailing});

  @override
  Widget build(BuildContext context) => InkWell(
    onTap: onTap,
    borderRadius: BorderRadius.circular(8),
    child: Padding(
      padding: const EdgeInsets.symmetric(vertical: 10),
      child: Row(children: [
        Icon(icon, size: 20, color: isDestructive ? AppColors.error : AppColors.textSecondary),
        const SizedBox(width: 12),
        Expanded(child: Text(label, style: TextStyle(fontFamily: 'Outfit', fontSize: 15, color: isDestructive ? AppColors.error : AppColors.textPrimary))),
        trailing ?? const Icon(Icons.chevron_right, color: AppColors.textSecondary, size: 18),
      ]),
    ),
  );
}
