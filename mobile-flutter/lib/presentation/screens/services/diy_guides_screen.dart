import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:gupio_customer/infrastructure/http/dio_client.dart';
import 'package:gupio_customer/presentation/theme/app_theme.dart';

final _guidesProvider = FutureProvider<List<Map<String, dynamic>>>((ref) async {
  final res = await createDioClient().get('/api/v1/diy/guides');
  return (res.data['data'] as List).cast<Map<String, dynamic>>();
});

final _categoriesProvider = FutureProvider<List<String>>((ref) async {
  final res = await createDioClient().get('/api/v1/diy/categories');
  return (res.data['data'] as List).map((c) => c.toString()).toList();
});

class DiyGuidesScreen extends ConsumerStatefulWidget {
  const DiyGuidesScreen({super.key});

  @override
  ConsumerState<DiyGuidesScreen> createState() => _DiyGuidesScreenState();
}

class _DiyGuidesScreenState extends ConsumerState<DiyGuidesScreen> {
  String _selected = 'All';

  @override
  Widget build(BuildContext context) {
    final guidesAsync = ref.watch(_guidesProvider);
    final catsAsync = ref.watch(_categoriesProvider);

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(title: const Text('DIY Guides')),
      body: Column(children: [
        catsAsync.when(
          loading: () => const SizedBox(height: 48),
          error: (_, __) => const SizedBox(height: 48),
          data: (cats) => _CategoryChips(
            categories: ['All', ...cats],
            selected: _selected,
            onSelect: (c) => setState(() => _selected = c),
          ),
        ),
        Expanded(
          child: guidesAsync.when(
            loading: () => const Center(child: CircularProgressIndicator()),
            error: (_, __) => const Center(child: Text('Failed to load guides')),
            data: (guides) {
              final filtered = _selected == 'All'
                  ? guides
                  : guides.where((g) => g['category']?.toString() == _selected).toList();
              return filtered.isEmpty
                  ? const Center(child: Text('No guides in this category'))
                  : GridView.builder(
                      padding: const EdgeInsets.all(16),
                      gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                        crossAxisCount: 2, crossAxisSpacing: 12, mainAxisSpacing: 12, childAspectRatio: 0.85,
                      ),
                      itemCount: filtered.length,
                      itemBuilder: (_, i) => _GuideCard(guide: filtered[i]),
                    );
            },
          ),
        ),
      ]),
    );
  }
}

class _CategoryChips extends StatelessWidget {
  final List<String> categories;
  final String selected;
  final void Function(String) onSelect;
  const _CategoryChips({required this.categories, required this.selected, required this.onSelect});

  @override
  Widget build(BuildContext context) => SizedBox(
    height: 52,
    child: ListView(
      scrollDirection: Axis.horizontal,
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
      children: categories.map((c) => Padding(
        padding: const EdgeInsets.only(right: 8),
        child: ChoiceChip(
          label: Text(c),
          selected: selected == c,
          onSelected: (_) => onSelect(c),
          selectedColor: AppColors.primary,
          labelStyle: TextStyle(
            color: selected == c ? Colors.white : AppColors.textPrimary,
            fontFamily: 'Outfit',
            fontWeight: FontWeight.w600,
          ),
        ),
      )).toList(),
    ),
  );
}

class _GuideCard extends StatelessWidget {
  final Map<String, dynamic> guide;
  const _GuideCard({required this.guide});

  @override
  Widget build(BuildContext context) {
    final difficulty = guide['difficulty']?.toString() ?? 'Easy';
    final diffColor = difficulty == 'Hard' ? AppColors.error : difficulty == 'Medium' ? AppColors.warning : AppColors.success;
    return GestureDetector(
      onTap: () => _showGuideDetail(context, guide),
      child: Container(
        decoration: BoxDecoration(
          color: AppColors.surface,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: AppColors.border),
        ),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Container(
            height: 90,
            decoration: BoxDecoration(
              color: AppColors.primary.withOpacity(0.08),
              borderRadius: const BorderRadius.vertical(top: Radius.circular(14)),
            ),
            child: Center(child: Icon(Icons.build_circle_outlined, size: 40, color: AppColors.primary)),
          ),
          Padding(
            padding: const EdgeInsets.all(10),
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(guide['title']?.toString() ?? 'Guide',
                  style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w700, fontFamily: 'Outfit'),
                  maxLines: 2, overflow: TextOverflow.ellipsis),
              const SizedBox(height: 6),
              Row(children: [
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                  decoration: BoxDecoration(
                    color: diffColor.withOpacity(0.1),
                    borderRadius: BorderRadius.circular(4),
                  ),
                  child: Text(difficulty, style: TextStyle(fontSize: 10, color: diffColor, fontWeight: FontWeight.w700)),
                ),
                const SizedBox(width: 6),
                const Icon(Icons.access_time, size: 12, color: AppColors.textSecondary),
                const SizedBox(width: 2),
                Text('${guide['estimatedTime'] ?? '30'} min',
                    style: const TextStyle(fontSize: 10, color: AppColors.textSecondary)),
              ]),
            ]),
          ),
        ]),
      ),
    );
  }

  void _showGuideDetail(BuildContext context, Map<String, dynamic> guide) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
      builder: (_) => DraggableScrollableSheet(
        initialChildSize: 0.7,
        maxChildSize: 0.95,
        expand: false,
        builder: (_, ctrl) => SingleChildScrollView(
          controller: ctrl,
          padding: const EdgeInsets.all(20),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(guide['title']?.toString() ?? 'Guide', style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w700, fontFamily: 'Outfit')),
            const SizedBox(height: 12),
            Text(guide['description']?.toString() ?? 'No description available.', style: const TextStyle(color: AppColors.textSecondary, fontSize: 14)),
            const SizedBox(height: 20),
            if (guide['steps'] != null) ...[
              const Text('Steps', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700, fontFamily: 'Outfit')),
              const SizedBox(height: 12),
              ...(guide['steps'] as List).asMap().entries.map((e) => Padding(
                padding: const EdgeInsets.only(bottom: 10),
                child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Container(
                    width: 24, height: 24,
                    decoration: const BoxDecoration(color: AppColors.primary, shape: BoxShape.circle),
                    child: Center(child: Text('${e.key + 1}', style: const TextStyle(color: Colors.white, fontSize: 12, fontWeight: FontWeight.w700))),
                  ),
                  const SizedBox(width: 10),
                  Expanded(child: Text(e.value.toString(), style: const TextStyle(fontSize: 14))),
                ]),
              )),
            ],
          ]),
        ),
      ),
    );
  }
}
