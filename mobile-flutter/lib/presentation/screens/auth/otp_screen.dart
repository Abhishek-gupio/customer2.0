import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:gupio_customer/presentation/providers/auth_provider.dart';
import 'package:gupio_customer/presentation/router/app_router.dart';
import 'package:gupio_customer/presentation/theme/app_theme.dart';

class OtpScreen extends ConsumerStatefulWidget {
  final String phone;
  const OtpScreen({super.key, required this.phone});

  @override
  ConsumerState<OtpScreen> createState() => _OtpScreenState();
}

class _OtpScreenState extends ConsumerState<OtpScreen> {
  static const _length = 6;
  final _ctrls = List.generate(_length, (_) => TextEditingController());
  final _focusNodes = List.generate(_length, (_) => FocusNode());
  int _resendSec = 30;
  Timer? _timer;
  String _error = '';

  @override
  void initState() {
    super.initState();
    _startTimer();
    WidgetsBinding.instance.addPostFrameCallback((_) => _focusNodes[0].requestFocus());
  }

  void _startTimer() {
    _timer?.cancel();
    setState(() => _resendSec = 30);
    _timer = Timer.periodic(const Duration(seconds: 1), (t) {
      if (_resendSec == 0) { t.cancel(); return; }
      setState(() => _resendSec--);
    });
  }

  @override
  void dispose() {
    _timer?.cancel();
    for (final c in _ctrls) c.dispose();
    for (final f in _focusNodes) f.dispose();
    super.dispose();
  }

  String get _otpValue => _ctrls.map((c) => c.text).join();

  void _onChanged(int idx, String val) {
    if (val.length > 1) {
      // Handle paste
      final digits = val.replaceAll(RegExp(r'\D'), '').substring(0, _length.clamp(0, val.length));
      for (int i = 0; i < digits.length && i < _length; i++) {
        _ctrls[i].text = digits[i];
      }
      if (digits.length >= _length) _verify();
      return;
    }
    if (val.isNotEmpty && idx < _length - 1) {
      _focusNodes[idx + 1].requestFocus();
    }
    if (_otpValue.length == _length) _verify();
  }

  void _onKeyEvent(int idx, RawKeyEvent event) {
    if (event is RawKeyDownEvent &&
        event.logicalKey == LogicalKeyboardKey.backspace &&
        _ctrls[idx].text.isEmpty &&
        idx > 0) {
      _focusNodes[idx - 1].requestFocus();
      _ctrls[idx - 1].clear();
    }
  }

  Future<void> _verify() async {
    final otp = _otpValue;
    if (otp.length < _length) return;
    setState(() => _error = '');
    final ok = await ref.read(authProvider.notifier).verifyOtp(widget.phone, otp);
    if (ok && mounted) {
      context.go(AppRoutes.home);
    } else {
      final err = ref.read(authProvider).error;
      setState(() => _error = err ?? 'Invalid OTP');
      for (final c in _ctrls) c.clear();
      _focusNodes[0].requestFocus();
    }
  }

  Future<void> _resend() async {
    if (_resendSec > 0) return;
    await ref.read(authProvider.notifier).sendOtp(widget.phone);
    _startTimer();
  }

  @override
  Widget build(BuildContext context) {
    final auth = ref.watch(authProvider);
    return Scaffold(
      appBar: AppBar(title: const Text('Verify OTP')),
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text('Enter the 6-digit OTP sent to', style: Theme.of(context).textTheme.bodyLarge),
              Text(widget.phone, style: Theme.of(context).textTheme.titleMedium?.copyWith(color: AppColors.primary)),
              const SizedBox(height: 32),
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: List.generate(_length, (i) => SizedBox(
                  width: 46,
                  child: RawKeyboardListener(
                    focusNode: FocusNode(),
                    onKey: (e) => _onKeyEvent(i, e),
                    child: TextField(
                      controller: _ctrls[i],
                      focusNode: _focusNodes[i],
                      keyboardType: TextInputType.number,
                      textAlign: TextAlign.center,
                      maxLength: 1,
                      inputFormatters: [FilteringTextInputFormatter.digitsOnly],
                      style: const TextStyle(fontSize: 24, fontWeight: FontWeight.w700),
                      decoration: InputDecoration(
                        counterText: '',
                        filled: true,
                        fillColor: AppColors.inputBackground,
                        contentPadding: const EdgeInsets.symmetric(vertical: 14),
                        border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: const BorderSide(color: AppColors.border)),
                      ),
                      onChanged: (v) => _onChanged(i, v),
                    ),
                  ),
                )),
              ),
              const SizedBox(height: 16),
              if (_error.isNotEmpty) Text(_error, style: const TextStyle(color: AppColors.error, fontSize: 13)),
              const SizedBox(height: 32),
              ElevatedButton(
                onPressed: (auth.isLoading || _otpValue.length < _length) ? null : _verify,
                child: auth.isLoading
                    ? const SizedBox(height: 20, width: 20, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                    : const Text('Verify'),
              ),
              const SizedBox(height: 20),
              Center(
                child: _resendSec > 0
                    ? Text('Resend OTP in ${_resendSec}s', style: Theme.of(context).textTheme.bodyMedium)
                    : TextButton(onPressed: _resend, child: const Text('Resend OTP')),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
