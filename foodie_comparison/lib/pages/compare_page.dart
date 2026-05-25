import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../providers/compare_provider.dart';
import '../config/theme.dart';

class ComparePage extends StatefulWidget {
  const ComparePage({super.key});

  @override
  State<ComparePage> createState() => _ComparePageState();
}

class _ComparePageState extends State<ComparePage> {
  final _searchController = TextEditingController();
  final List<Map<String, String>> _platforms = [
    {'key': 'all', 'name': '全部'},
    {'key': 'meituan', 'name': '美团'},
    {'key': 'eleme', 'name': '饿了么'},
    {'key': 'jd_waimai', 'name': '京东外卖'},
    {'key': 'douyin_waimai', 'name': '抖音外卖'},
  ];

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      context.read<CompareProvider>().loadSavingRank();
    });
  }

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  void _doSearch() {
    final query = _searchController.text.trim();
    if (query.isEmpty) return;
    context.read<CompareProvider>().compareProduct(query);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppTheme.scaffoldBg,
      appBar: AppBar(
        title: const Text('智能比价'),
        backgroundColor: Colors.white,
        elevation: 0,
      ),
      body: Consumer<CompareProvider>(
        builder: (_, provider, __) {
          return RefreshIndicator(
            onRefresh: () => provider.loadSavingRank(),
            child: CustomScrollView(
              slivers: [
                SliverToBoxAdapter(child: _buildSearchBar(provider)),
                SliverToBoxAdapter(child: _buildPlatformTabs(provider)),
                if (provider.isLoading)
                  const SliverFillRemaining(
                    child: Center(child: CircularProgressIndicator()),
                  )
                else if (provider.results.isNotEmpty)
                  SliverToBoxAdapter(child: _buildCompareResults(provider))
                else
                  SliverToBoxAdapter(child: _buildSavingRank(provider)),
              ],
            ),
          );
        },
      ),
    );
  }

  Widget _buildSearchBar(CompareProvider provider) {
    return Container(
      margin: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(30),
        boxShadow: [
          BoxShadow(
            color: Colors.grey.withOpacity(0.1),
            blurRadius: 4,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: TextField(
        controller: _searchController,
        onSubmitted: (_) => _doSearch(),
        decoration: InputDecoration(
          hintText: '输入菜品名称比价，如"水煮鱼"',
          hintStyle: const TextStyle(color: Colors.grey),
          prefixIcon: const Icon(Icons.search, color: AppTheme.primaryColor),
          suffixIcon: IconButton(
            icon: const Icon(Icons.compare_arrows, color: AppTheme.primaryColor),
            onPressed: _doSearch,
          ),
          border: InputBorder.none,
          contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
        ),
      ),
    );
  }

  Widget _buildPlatformTabs(CompareProvider provider) {
    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 12),
      height: 44,
      child: ListView.separated(
        scrollDirection: Axis.horizontal,
        itemCount: _platforms.length,
        separatorBuilder: (_, __) => const SizedBox(width: 8),
        itemBuilder: (_, index) {
          final p = _platforms[index];
          final selected = provider.selectedPlatform == p['key'];
          return GestureDetector(
            onTap: () => provider.setPlatform(p['key']!),
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
              decoration: BoxDecoration(
                color: selected ? AppTheme.primaryColor : Colors.white,
                borderRadius: BorderRadius.circular(20),
                border: Border.all(
                  color: selected ? AppTheme.primaryColor : Colors.grey.shade300,
                ),
              ),
              child: Text(
                p['name']!,
                style: TextStyle(
                  color: selected ? Colors.white : AppTheme.textSecondary,
                  fontWeight: FontWeight.bold,
                  fontSize: 13,
                ),
              ),
            ),
          );
        },
      ),
    );
  }

  Widget _buildCompareResults(CompareProvider provider) {
    return Container(
      margin: const EdgeInsets.all(12),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Icon(Icons.compare, color: AppTheme.primaryColor, size: 20),
              const SizedBox(width: 8),
              Text(
                '"${provider.searchQuery}" 比价结果',
                style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
              ),
            ],
          ),
          const SizedBox(height: 12),
          ...provider.results.map((r) => _buildResultItem(r, provider.results.first == r)),
        ],
      ),
    );
  }

  Widget _buildResultItem(Map<String, dynamic> item, bool isBest) {
    final platformName = item['platform_name'] ?? item['platform'] ?? '';
    final finalPrice = (item['final_price'] ?? 0).toDouble();
    final originalTotal = (item['original_total'] ?? 0).toDouble();
    final savings = (item['savings'] ?? 0).toDouble();
    final deliveryFee = (item['delivery_fee'] ?? 0).toDouble();
    final isBestPrice = item['is_best_price'] == true;

    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: isBestPrice ? const Color(0xFFFFF5F5) : Colors.grey.shade50,
        borderRadius: BorderRadius.circular(12),
        border: isBestPrice
            ? Border.all(color: AppTheme.primaryColor.withOpacity(0.3))
            : null,
      ),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Text(
                      platformName,
                      style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 15),
                    ),
                    if (isBestPrice)
                      Container(
                        margin: const EdgeInsets.only(left: 8),
                        padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                        decoration: BoxDecoration(
                          color: AppTheme.primaryColor,
                          borderRadius: BorderRadius.circular(4),
                        ),
                        child: const Text(
                          '最低价',
                          style: TextStyle(color: Colors.white, fontSize: 10),
                        ),
                      ),
                  ],
                ),
                const SizedBox(height: 4),
                Text(
                  '配送费 ¥${deliveryFee.toStringAsFixed(1)}',
                  style: const TextStyle(color: AppTheme.textSecondary, fontSize: 12),
                ),
              ],
            ),
          ),
          Column(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Text(
                '¥${finalPrice.toStringAsFixed(2)}',
                style: TextStyle(
                  color: isBestPrice ? AppTheme.primaryColor : AppTheme.textPrimary,
                  fontSize: 20,
                  fontWeight: FontWeight.bold,
                ),
              ),
              if (originalTotal > finalPrice)
                Text(
                  '¥${originalTotal.toStringAsFixed(2)}',
                  style: const TextStyle(
                    color: AppTheme.textSecondary,
                    fontSize: 12,
                    decoration: TextDecoration.lineThrough,
                  ),
                ),
              if (savings > 0)
                Text(
                  '省¥${savings.toStringAsFixed(2)}',
                  style: const TextStyle(
                    color: AppTheme.successColor,
                    fontSize: 11,
                    fontWeight: FontWeight.bold,
                  ),
                ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildSavingRank(CompareProvider provider) {
    if (provider.savingRank.isEmpty) {
      return Container(
        margin: const EdgeInsets.all(24),
        child: Column(
          children: [
            const Icon(Icons.savings, size: 64, color: Colors.grey),
            const SizedBox(height: 16),
            const Text(
              '搜索菜品开始比价',
              style: TextStyle(color: AppTheme.textSecondary, fontSize: 16),
            ),
            const SizedBox(height: 8),
            const Text(
              '输入菜品名称，对比各大平台价格',
              style: TextStyle(color: AppTheme.textSecondary, fontSize: 13),
            ),
          ],
        ),
      );
    }

    return Container(
      margin: const EdgeInsets.all(12),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Row(
            children: [
              Icon(Icons.emoji_events, color: Color(0xFFFFD700), size: 20),
              SizedBox(width: 8),
              Text('省钱榜单', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
            ],
          ),
          const SizedBox(height: 12),
          ...provider.savingRank.asMap().entries.map((entry) {
            final index = entry.key;
            final item = entry.value;
            return _buildRankItem(item, index + 1);
          }),
        ],
      ),
    );
  }

  Widget _buildRankItem(Map<String, dynamic> item, int rank) {
    final productName = item['product_name'] ?? '';
    final shopName = item['shop_name'] ?? '';
    final lowestPrice = (item['lowest_price'] ?? 0).toDouble();
    final savings = (item['savings'] ?? 0).toDouble();
    final lowestPlatformName = item['lowest_platform_name'] ?? '';

    return Container(
      padding: const EdgeInsets.symmetric(vertical: 8),
      decoration: BoxDecoration(
        border: Border(bottom: BorderSide(color: Colors.grey.withOpacity(0.2))),
      ),
      child: Row(
        children: [
          Container(
            width: 28,
            height: 28,
            alignment: Alignment.center,
            decoration: BoxDecoration(
              color: rank == 1
                  ? const Color(0xFFFFD700)
                  : rank == 2
                      ? const Color(0xFFC0C0C0)
                      : const Color(0xFFCD7F32),
              borderRadius: BorderRadius.circular(8),
            ),
            child: Text(
              '$rank',
              style: const TextStyle(color: Colors.white, fontSize: 12, fontWeight: FontWeight.bold),
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(productName, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14)),
                Text(shopName, style: const TextStyle(color: AppTheme.textSecondary, fontSize: 12)),
              ],
            ),
          ),
          Column(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Text(
                '¥${lowestPrice.toStringAsFixed(0)}',
                style: const TextStyle(color: AppTheme.primaryColor, fontWeight: FontWeight.bold, fontSize: 16),
              ),
              Text(
                '$lowestPlatformName 省¥${savings.toStringAsFixed(0)}',
                style: const TextStyle(color: AppTheme.successColor, fontSize: 11),
              ),
            ],
          ),
        ],
      ),
    );
  }
}