import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:gupio_customer/infrastructure/http/dio_client.dart';
import 'package:gupio_customer/presentation/theme/app_theme.dart';

class AiHomeScreen extends ConsumerStatefulWidget {
  const AiHomeScreen({super.key});

  @override
  ConsumerState<AiHomeScreen> createState() => _AiHomeScreenState();
}

class _AiHomeScreenState extends ConsumerState<AiHomeScreen> {
  final _ctrl = TextEditingController();
  final _scroll = ScrollController();
  String? _sessionId;
  final List<_Msg> _messages = [];
  bool _loading = false;

  @override
  void initState() {
    super.initState();
    _createSession();
  }

  @override
  void dispose() {
    _ctrl.dispose();
    _scroll.dispose();
    super.dispose();
  }

  Future<void> _createSession() async {
    try {
      final dio = createDioClient();
      final res = await dio.post('/api/v1/chat/sessions');
      setState(() => _sessionId = res.data['data']['id']);
    } catch (_) {}
  }

  Future<void> _send() async {
    final text = _ctrl.text.trim();
    if (text.isEmpty || _sessionId == null) return;
    _ctrl.clear();
    setState(() {
      _messages.add(_Msg(text, true));
      _loading = true;
    });
    _scrollBottom();
    try {
      final dio = createDioClient();
      final res = await dio.post('/api/v1/chat/sessions/$_sessionId/message', data: {'content': text});
      final reply = res.data['data']['assistantMessage']['content'] as String;
      setState(() => _messages.add(_Msg(reply, false)));
    } catch (_) {
      setState(() => _messages.add(_Msg("Sorry, I couldn't process that. Please try again.", false)));
    } finally {
      setState(() => _loading = false);
      _scrollBottom();
    }
  }

  void _scrollBottom() {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (_scroll.hasClients) _scroll.animateTo(_scroll.position.maxScrollExtent, duration: const Duration(milliseconds: 300), curve: Curves.easeOut);
    });
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(title: const Text('AI Assistant'), backgroundColor: AppColors.surface),
    body: Column(children: [
      Expanded(
        child: _messages.isEmpty
            ? _WelcomeView()
            : ListView.builder(
                controller: _scroll,
                padding: const EdgeInsets.all(16),
                itemCount: _messages.length + (_loading ? 1 : 0),
                itemBuilder: (_, i) {
                  if (i == _messages.length) return const _TypingIndicator();
                  return _Bubble(msg: _messages[i]);
                },
              ),
      ),
      _InputBar(ctrl: _ctrl, onSend: _send, loading: _loading),
    ]),
  );
}

class _Msg { final String text; final bool isUser; const _Msg(this.text, this.isUser); }

class _Bubble extends StatelessWidget {
  final _Msg msg;
  const _Bubble({required this.msg});

  @override
  Widget build(BuildContext context) => Align(
    alignment: msg.isUser ? Alignment.centerRight : Alignment.centerLeft,
    child: Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      constraints: BoxConstraints(maxWidth: MediaQuery.of(context).size.width * 0.78),
      decoration: BoxDecoration(
        color: msg.isUser ? AppColors.primary : AppColors.surface,
        borderRadius: BorderRadius.circular(18).copyWith(
          bottomRight: msg.isUser ? Radius.zero : const Radius.circular(18),
          bottomLeft: msg.isUser ? const Radius.circular(18) : Radius.zero,
        ),
        border: msg.isUser ? null : Border.all(color: AppColors.border),
      ),
      child: Text(msg.text, style: TextStyle(color: msg.isUser ? Colors.white : AppColors.textPrimary, fontFamily: 'Outfit')),
    ),
  );
}

class _TypingIndicator extends StatelessWidget {
  const _TypingIndicator();

  @override
  Widget build(BuildContext context) => Align(
    alignment: Alignment.centerLeft,
    child: Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
      decoration: BoxDecoration(color: AppColors.surface, borderRadius: BorderRadius.circular(18), border: Border.all(color: AppColors.border)),
      child: Row(mainAxisSize: MainAxisSize.min, children: const [
        _Dot(delay: 0), SizedBox(width: 4), _Dot(delay: 200), SizedBox(width: 4), _Dot(delay: 400),
      ]),
    ),
  );
}

class _Dot extends StatefulWidget {
  final int delay;
  const _Dot({required this.delay});

  @override
  State<_Dot> createState() => _DotState();
}

class _DotState extends State<_Dot> with SingleTickerProviderStateMixin {
  late final AnimationController _ctrl;
  late final Animation<double> _anim;

  @override
  void initState() {
    super.initState();
    _ctrl = AnimationController(vsync: this, duration: const Duration(milliseconds: 600));
    _anim = CurvedAnimation(parent: _ctrl, curve: Curves.easeInOut);
    Future.delayed(Duration(milliseconds: widget.delay), () {
      if (mounted) _ctrl.repeat(reverse: true);
    });
  }

  @override
  void dispose() { _ctrl.dispose(); super.dispose(); }

  @override
  Widget build(BuildContext context) => FadeTransition(
    opacity: _anim,
    child: const CircleAvatar(radius: 4, backgroundColor: AppColors.textSecondary),
  );
}

class _InputBar extends StatelessWidget {
  final TextEditingController ctrl;
  final VoidCallback onSend;
  final bool loading;
  const _InputBar({required this.ctrl, required this.onSend, required this.loading});

  @override
  Widget build(BuildContext context) => Container(
    padding: EdgeInsets.fromLTRB(16, 8, 8, MediaQuery.of(context).viewInsets.bottom + 16),
    decoration: const BoxDecoration(color: AppColors.surface, border: Border(top: BorderSide(color: AppColors.border))),
    child: Row(children: [
      Expanded(child: TextField(
        controller: ctrl,
        maxLines: null,
        textCapitalization: TextCapitalization.sentences,
        decoration: InputDecoration(
          hintText: 'Ask about your vehicle...',
          filled: true, fillColor: AppColors.inputBackground,
          contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
          border: OutlineInputBorder(borderRadius: BorderRadius.circular(24), borderSide: BorderSide.none),
        ),
        onSubmitted: (_) => onSend(),
      )),
      const SizedBox(width: 8),
      IconButton(
        onPressed: loading ? null : onSend,
        icon: loading ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2)) : const Icon(Icons.send_rounded),
        color: AppColors.primary,
      ),
    ]),
  );
}

class _WelcomeView extends StatelessWidget {
  @override
  Widget build(BuildContext context) => Center(
    child: Column(mainAxisSize: MainAxisSize.min, children: [
      Container(padding: const EdgeInsets.all(20), decoration: BoxDecoration(color: AppColors.primary.withOpacity(0.1), shape: BoxShape.circle),
        child: const Icon(Icons.smart_toy, size: 48, color: AppColors.primary)),
      const SizedBox(height: 20),
      Text('GuPio AI Assistant', style: Theme.of(context).textTheme.headlineMedium),
      const SizedBox(height: 8),
      Text('Ask me anything about your vehicle', style: Theme.of(context).textTheme.bodyMedium),
      const SizedBox(height: 32),
      ...['When is my next service due?', 'Explain my expense report', 'Tips for better fuel efficiency'].map((q) => Padding(
        padding: const EdgeInsets.only(bottom: 8),
        child: ActionChip(label: Text(q), onPressed: () {}),
      )),
    ]),
  );
}
