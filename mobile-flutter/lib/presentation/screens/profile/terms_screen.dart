import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:gupio_customer/presentation/theme/app_theme.dart';

class TermsScreen extends ConsumerWidget {
  const TermsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(title: const Text('Terms & Conditions')),
      body: ListView(
        padding: const EdgeInsets.all(20),
        children: const [
          _Section('1. Acceptance of Terms',
              'By downloading, installing, or using the Gupio Customer application ("App"), you agree to be bound by these Terms and Conditions. If you do not agree to these terms, please do not use the App.'),
          _Section('2. User Account',
              'You must create an account to use our services. You are responsible for maintaining the confidentiality of your account credentials and for all activities that occur under your account. You must provide accurate and complete information during registration.'),
          _Section('3. Services',
              'Gupio provides vehicle management, expense tracking, document storage, telematics, and related services. We reserve the right to modify, suspend, or discontinue any service at any time without notice.'),
          _Section('4. Vehicle Data',
              'When you use our telematics features, we collect driving data including location, speed, acceleration, and braking patterns. This data is used to provide safety scores and insights. By using these features, you consent to this data collection.'),
          _Section('5. Privacy',
              'Your use of the App is also governed by our Privacy Policy, which is incorporated into these Terms by reference. Please review our Privacy Policy to understand our practices.'),
          _Section('6. Payments',
              'Any payments made through the App for premium features, valet services, or FASTag recharges are processed securely through our payment partners. All charges are non-refundable unless otherwise stated.'),
          _Section('7. Prohibited Uses',
              'You may not use the App for any unlawful purpose, to transmit harmful content, to impersonate any person or entity, or to interfere with the proper functioning of the App.'),
          _Section('8. Limitation of Liability',
              'To the maximum extent permitted by law, Gupio shall not be liable for any indirect, incidental, special, consequential, or punitive damages resulting from your use of the App.'),
          _Section('9. Changes to Terms',
              'We reserve the right to modify these Terms at any time. We will notify users of significant changes via the App or email. Your continued use of the App after changes constitutes acceptance of the new Terms.'),
          _Section('10. Contact',
              'If you have any questions about these Terms, please contact us at legal@gupio.tech.'),
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
