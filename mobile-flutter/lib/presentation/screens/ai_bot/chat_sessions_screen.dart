import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:gupio_customer/infrastructure/http/dio_client.dart';
import 'package:gupio_customer/presentation/router/app_router.dart';
import 'package:gupio_customer/presentation/theme/app_theme.dart';
import 'package:intl/intl.dart';

final _sessionsProvider = FutureProvider<List<Map<String, dynamic>>>((ref) async {
  final res = await createDioClient().get('/api/v1/chat/sessions');
  return (res.data['data'] as List).cast<Map<String, dynamic>>();
});

class ChatSessionsScreen extends ConsumerWidget {
  const ChatSessionsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final async = ref.watch(_sessionsProvider);
    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(title: const Text('Chat Sessions')),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () async {
          final res = await createDioClient().post('/api/v1/chat/sessions');
          final id = res.data['data']?['id']?.toString();
          if (id != null && context.mounted) {
            context.go(AppRoutes.aiHome);
          }
        },
        icon: const Icon(Icons.add_comment_outlined),
        label: const Text('New Chat'),
        backgroundColor: AppColors.primary,
        foregroundColor: Colors.white,
      ),
      body: async.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (_, __) => const Center(child: Text('Failed to load sessions')),
        data: (sessions) => sessions.isEmpty
            ? Center(child: Column(mainAxisSize: MainAxisSize.min, children: [
                const Icon(Icons.chat_bubble_outline, size: 80, color: AppColors.border),
                const SizedBox(height: 16),
                Text('No conversations yet', style: Theme.of(context).textTheme.titleLarge),
                const SizedBox(height: 8),
                const Text('Start a new chat with your AI vehicle coach', style: TextStyle(color: AppColors.textSecondary)),
              ]))
            : RefreshIndicator(
                onRefresh: () => ref.refresh(_sessionsProvider.future),
                child: ListView.separated(
                  padding: const EdgeInsets.fromLTRB(16, 16, 16, 96),
                  itemCount: sessions.length,
                  separatorBuilder: (_, __) => const SizedBox(height: 8),
                  itemBuilder: (_, i) => _SessionTile(session: sessions[i]),
                ),
              ),
      ),
    );
  }
}

class _SessionTile extends StatelessWidget {
  final Map<String, dynamic> session;
  const _SessionTile({required this.session});

  @override
  Widget build(BuildContext context) {
    final ts = session['updatedAt'] != null
        ? DateFormat('d MMM, h:mm a').format(DateTime.parse(session['updatedAt']))
        : '';
    final preview = session['lastMessage']?.toString() ?? 'No messages yet';
    return GestureDetector(
      onTap: () => context.go(AppRoutes.aiHome),
      child: Container(
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: AppColors.surface,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: AppColors.border),
        ),
        child: Row(children: [
          Container(
            width: 46, height: 46,
            decoration: BoxDecoration(
              gradient: const LinearGradient(colors: [Color(0xFF6366F1), Color(0xFF8B5CF6)]),
              borderRadius: BorderRadius.circular(12),
            ),
            child: const Icon(Icons.smart_toy_outlined, color: Colors.white, size: 24),
          ),
          const SizedBox(width: 12),
          Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Row(children: [
              Expanded(child: Text(
                session['title']?.toString() ?? 'Chat Session',
                style: Theme.of(context).textTheme.titleMedium?.copyWith(fontSize: 15),
              )),
              Text(ts, style: const TextStyle(fontSize: 11, color: AppColors.textSecondary)),
            ]),
            const SizedBox(height: 4),
            Text(preview,
                style: const TextStyle(fontSize: 13, color: AppColors.textSecondary),
                maxLines: 1,
                overflow: TextOverflow.ellipsis),
          ])),
        ]),
      ),
    );
  }
}
