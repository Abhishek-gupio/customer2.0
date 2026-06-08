import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:gupio_customer/infrastructure/http/dio_client.dart';
import 'package:gupio_customer/presentation/theme/app_theme.dart';

class SosScreen extends ConsumerStatefulWidget {
  const SosScreen({super.key});

  @override
  ConsumerState<SosScreen> createState() => _SosScreenState();
}

class _SosScreenState extends ConsumerState<SosScreen> {
  bool _sending = false;
  bool _sent = false;

  Future<void> _triggerSos() async {
    setState(() => _sending = true);
    try {
      final dio = createDioClient();
      await dio.post('/api/v1/sos', data: {'type': 'EMERGENCY', 'latitude': 0, 'longitude': 0});
      setState(() => _sent = true);
    } catch (_) {} finally {
      setState(() => _sending = false);
    }
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    backgroundColor: const Color(0xFFFFF0F0),
    appBar: AppBar(title: const Text('SOS Emergency'), backgroundColor: AppColors.error, foregroundColor: Colors.white),
    body: Center(
      child: _sent
          ? Column(mainAxisSize: MainAxisSize.min, children: [
              const Icon(Icons.check_circle, size: 80, color: AppColors.success),
              const SizedBox(height: 16),
              const Text('SOS Sent!', style: TextStyle(fontSize: 24, fontWeight: FontWeight.w700, fontFamily: 'Outfit')),
              const SizedBox(height: 8),
              const Text('Help is on the way', style: TextStyle(color: AppColors.textSecondary, fontFamily: 'Outfit')),
            ])
          : Column(mainAxisSize: MainAxisSize.min, children: [
              const Icon(Icons.warning_amber_rounded, size: 64, color: AppColors.error),
              const SizedBox(height: 16),
              const Text('Emergency SOS', style: TextStyle(fontSize: 24, fontWeight: FontWeight.w700, fontFamily: 'Outfit')),
              const SizedBox(height: 8),
              const Padding(
                padding: EdgeInsets.symmetric(horizontal: 32),
                child: Text('Tap the button below to send an SOS alert with your location to emergency contacts.', textAlign: TextAlign.center, style: TextStyle(color: AppColors.textSecondary, fontFamily: 'Outfit')),
              ),
              const SizedBox(height: 40),
              GestureDetector(
                onTap: _sending ? null : _triggerSos,
                child: Container(
                  width: 160, height: 160,
                  decoration: BoxDecoration(color: AppColors.error, shape: BoxShape.circle,
                    boxShadow: [BoxShadow(color: AppColors.error.withOpacity(0.4), blurRadius: 24, spreadRadius: 8)]),
                  child: Center(child: _sending
                    ? const CircularProgressIndicator(color: Colors.white)
                    : const Column(mainAxisSize: MainAxisSize.min, children: [
                        Icon(Icons.sos, color: Colors.white, size: 48),
                        SizedBox(height: 4),
                        Text('HELP', style: TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.w900, letterSpacing: 2, fontFamily: 'Outfit')),
                      ])),
                ),
              ),
            ]),
    ),
  );
}
