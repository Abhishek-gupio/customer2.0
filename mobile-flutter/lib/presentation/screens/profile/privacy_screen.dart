import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:gupio_customer/presentation/theme/app_theme.dart';

class PrivacyScreen extends ConsumerWidget {
  const PrivacyScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(title: const Text('Privacy Policy')),
      body: ListView(
        padding: const EdgeInsets.all(20),
        children: const [
          _Section('Information We Collect',
              'We collect information you provide directly, such as your name, phone number, email, and vehicle details. We also collect data automatically when you use our App, including device information, location data, and driving patterns when telematics features are enabled.'),
          _Section('How We Use Your Information',
              '• To provide and improve our services\n• To personalize your experience\n• To send important notifications about your vehicle\n• To generate driving insights and safety scores\n• To comply with legal obligations\n• To process payments and prevent fraud'),
          _Section('Data Sharing',
              'We do not sell your personal information to third parties. We may share data with:\n• Service providers who help operate our App\n• Government authorities when required by law\n• Insurance partners (only with your explicit consent)\n• Emergency services when you trigger an SOS alert'),
          _Section('Location Data',
              'We collect precise location data when you use navigation, telematics, or valet features. You can disable location access in your device settings, but some features will not work without it.'),
          _Section('Driving Data',
              'Telematics data (speed, acceleration, braking patterns) is collected to generate safety scores. This data is stored securely and used only to provide insights to you. We do not share raw telematics data with insurance companies without your consent.'),
          _Section('Data Retention',
              'We retain your data as long as your account is active. You can request deletion of your account and associated data at any time through Settings > Account > Delete Account.'),
          _Section('Security',
              'We implement industry-standard security measures including encryption in transit and at rest, secure authentication, and regular security audits to protect your data.'),
          _Section('Your Rights',
              'You have the right to access, correct, or delete your personal data. You can also opt out of non-essential communications. To exercise these rights, contact privacy@gupio.tech.'),
          _Section('Children\'s Privacy',
              'Our services are not directed to children under 18. We do not knowingly collect personal information from minors.'),
          _Section('Contact Us',
              'For privacy-related questions or concerns, contact our Data Protection Officer at:\nprivacy@gupio.tech\nGupio Tech Pvt. Ltd.\nPune, Maharashtra 411001'),
          SizedBox(height: 32),
          Text('Last updated: January 2025', style: TextStyle(color: AppColors.textSecondary, fontSize: 12, fontFamily: 'Outfit')),
        ],
      ),
    );
  }
}

class _Section extends StatelessWidget {
  final String heading;
  final String body;
  const _Section(this.heading, this.body);

  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.only(bottom: 20),
    child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      Text(heading, style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w700, fontFamily: 'Outfit', color: AppColors.textPrimary)),
      const SizedBox(height: 8),
      Text(body, style: const TextStyle(fontSize: 14, color: AppColors.textSecondary, height: 1.6, fontFamily: 'Outfit')),
    ]),
  );
}
