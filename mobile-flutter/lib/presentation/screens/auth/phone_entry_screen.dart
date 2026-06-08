import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:google_sign_in/google_sign_in.dart';
import 'package:gupio_customer/core/config/app_config.dart';
import 'package:gupio_customer/presentation/providers/auth_provider.dart';
import 'package:gupio_customer/presentation/router/app_router.dart';
import 'package:gupio_customer/presentation/theme/app_theme.dart';

class PhoneEntryScreen extends ConsumerStatefulWidget {
  const PhoneEntryScreen({super.key});

  @override
  ConsumerState<PhoneEntryScreen> createState() => _PhoneEntryScreenState();
}

class _PhoneEntryScreenState extends ConsumerState<PhoneEntryScreen>
    with TickerProviderStateMixin {
  final _phoneCtrl = TextEditingController();
  late final AnimationController _slideCtrl;
  late final Animation<Offset> _slideAnim;
  bool _googleLoading = false;
  String _error = '';

  @override
  void initState() {
    super.initState();
    _slideCtrl = AnimationController(vsync: this, duration: const Duration(milliseconds: 700));
    _slideAnim = Tween<Offset>(begin: const Offset(1.2, 0), end: Offset.zero)
        .animate(CurvedAnimation(parent: _slideCtrl, curve: Curves.easeOutCubic));
    _slideCtrl.forward();
  }

  @override
  void dispose() {
    _slideCtrl.dispose();
    _phoneCtrl.dispose();
    super.dispose();
  }

  String _formatPhone(String raw) {
    final digits = raw.replaceAll(RegExp(r'\D'), '');
    if (digits.startsWith('91') && digits.length == 12) return '+$digits';
    if (digits.length == 10) return '+91$digits';
    return '+$digits';
  }

  bool _validPhone(String raw) {
    final digits = raw.replaceAll(RegExp(r'\D'), '');
    return RegExp(r'^[6-9]\d{9}$').hasMatch(
      digits.startsWith('91') && digits.length == 12 ? digits.substring(2) : digits,
    );
  }

  Future<void> _handleSubmit() async {
    final raw = _phoneCtrl.text.trim();
    if (!_validPhone(raw)) {
      setState(() => _error = 'Enter a valid 10-digit Indian mobile number');
      return;
    }
    setState(() => _error = '');
    final phone = _formatPhone(raw);
    await ref.read(authProvider.notifier).sendOtp(phone);
    final err = ref.read(authProvider).error;
    if (err != null && mounted) {
      setState(() => _error = err);
      return;
    }
    if (mounted) context.push('${AppRoutes.otp}?phone=${Uri.encodeComponent(phone)}');
  }

  Future<void> _handleGoogle() async {
    setState(() { _googleLoading = true; _error = ''; });
    try {
      final gSignIn = GoogleSignIn(clientId: googleWebClientId, scopes: ['email']);
      final acct = await gSignIn.signIn();
      if (acct == null) { setState(() => _googleLoading = false); return; }
      final auth = await acct.authentication;
      final idToken = auth.idToken;
      if (idToken == null) throw Exception('No ID token');
      final ok = await ref.read(authProvider.notifier).googleLogin(idToken);
      if (ok && mounted) context.go(AppRoutes.home);
    } catch (e) {
      setState(() => _error = 'Google sign-in failed');
    } finally {
      if (mounted) setState(() => _googleLoading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final auth = ref.watch(authProvider);
    return Scaffold(
      backgroundColor: AppColors.background,
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 32),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Center(
                child: SlideTransition(
                  position: _slideAnim,
                  child: Image.asset('assets/images/logo.png', height: 56, errorBuilder: (_, __, ___) =>
                    const Text('GuPio', style: TextStyle(fontSize: 32, fontWeight: FontWeight.w700, color: AppColors.primary))),
                ),
              ),
              const SizedBox(height: 40),
              Text('Welcome back', style: Theme.of(context).textTheme.headlineMedium),
              const SizedBox(height: 8),
              Text('Sign in to manage your vehicles', style: Theme.of(context).textTheme.bodyMedium),
              const SizedBox(height: 32),
              Text('Mobile Number', style: Theme.of(context).textTheme.labelLarge),
              const SizedBox(height: 8),
              TextField(
                controller: _phoneCtrl,
                keyboardType: TextInputType.phone,
                inputFormatters: [FilteringTextInputFormatter.digitsOnly, LengthLimitingTextInputFormatter(10)],
                decoration: const InputDecoration(
                  prefixText: '+91  ',
                  hintText: '9876543210',
                ),
                onSubmitted: (_) => _handleSubmit(),
              ),
              if (_error.isNotEmpty) ...[
                const SizedBox(height: 8),
                Text(_error, style: const TextStyle(color: AppColors.error, fontSize: 13)),
              ],
              const SizedBox(height: 24),
              ElevatedButton(
                onPressed: auth.isLoading ? null : _handleSubmit,
                child: auth.isLoading
                    ? const SizedBox(height: 20, width: 20, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                    : const Text('Send OTP'),
              ),
              const SizedBox(height: 20),
              Row(children: [
                const Expanded(child: Divider()),
                Padding(padding: const EdgeInsets.symmetric(horizontal: 12), child: Text('or', style: Theme.of(context).textTheme.bodyMedium)),
                const Expanded(child: Divider()),
              ]),
              const SizedBox(height: 20),
              OutlinedButton.icon(
                onPressed: _googleLoading ? null : _handleGoogle,
                icon: _googleLoading
                    ? const SizedBox(height: 18, width: 18, child: CircularProgressIndicator(strokeWidth: 2))
                    : const Icon(Icons.g_mobiledata, size: 24),
                label: const Text('Continue with Google'),
                style: OutlinedButton.styleFrom(
                  minimumSize: const Size.fromHeight(52),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
