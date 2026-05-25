import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../providers/recommend_provider.dart';
import '../config/theme.dart';

class RecommendPage extends StatefulWidget {
  const RecommendPage({super.key});

  @override
  State<RecommendPage> createState() => _RecommendPageState();
}

class _RecommendPageState extends State<RecommendPage>
    with SingleTickerProviderStateMixin {
  late TabController _tabController;

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 2, vsync: this);
    WidgetsBinding.instance.addPostFrameCallback((_) {
      final provider = context.read<RecommendProvider>();
      provider.loadShopRecommendations();
      provider.loadProductRecommendations();
    });
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppTheme.scaffoldBg,
      appBar: AppBar(
        title: const Text('智能推荐'),
        backgroundColor: Colors.white,
        elevation: 0,
        bottom: TabBar(
          controller: _tabController,
          labelColor: AppTheme.primaryColor,
          unselectedLabelColor: AppTheme.textSecondary,
          indicatorColor: AppTheme.primaryColor,
          tabs: const [
            Tab(text: '店铺推荐'),
            Tab(text: '菜品推荐'),
          ],
        ),
      ),
      body: Consumer<RecommendProvider>(
        builder: (_, provider, __) {
          if (provider.isLoading) {
            return const Center(child: CircularProgressIndicator());
          }

          return TabBarView(
            controller: _tabController,
            children: [
              _buildShopList(provider),
              _buildProductList(provider),
            ],
          );
        },
      ),
    );
  }

  Widget _buildShopList(RecommendProvider provider) {
    if (provider.shopRecommendations.isEmpty) {
      return _buildEmptyState('暂无店铺推荐', '登录后获取个性化推荐');
    }

    return RefreshIndicator(
      onRefresh: () => provider.loadShopRecommendations(),
      child: ListView.builder(
        padding: const EdgeInsets.all(12),
        itemCount: provider.shopRecommendations.length,
        itemBuilder: (_, index) {
          final shop = provider.shopRecommendations[index];
          return _buildShopCard(shop, provider);
        },
      ),
    );
  }

  Widget _buildShopCard(Map<String, dynamic> shop, RecommendProvider provider) {
    final shopName = shop['shop_name'] ?? '';
    final rating = (shop['rating'] ?? 0).toDouble();
    final category = shop['category'] ?? '';
    final reason = shop['reason'] ?? '';
    final score = (shop['score'] ?? 0).toDouble();
    final savings = (shop['savings'] ?? 0).toDouble();
    final isColdStart = shop['is_cold_start'] == true;

    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        boxShadow: [
          BoxShadow(
            color: Colors.grey.withOpacity(0.08),
            blurRadius: 4,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(
                  shopName,
                  style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
              ),
              if (isColdStart)
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                  decoration: BoxDecoration(
                    color: Colors.orange.shade50,
                    borderRadius: BorderRadius.circular(4),
                  ),
                  child: const Text(
                    '热门',
                    style: TextStyle(color: Colors.orange, fontSize: 10),
                  ),
                ),
            ],
          ),
          const SizedBox(height: 8),
          Row(
            children: [
              if (category.isNotEmpty) ...[
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                  decoration: BoxDecoration(
                    color: AppTheme.primaryColor.withOpacity(0.1),
                    borderRadius: BorderRadius.circular(4),
                  ),
                  child: Text(
                    category,
                    style: const TextStyle(color: AppTheme.primaryColor, fontSize: 11),
                  ),
                ),
                const SizedBox(width: 8),
              ],
              const Icon(Icons.star, color: Colors.amber, size: 14),
              Text(
                rating.toStringAsFixed(1),
                style: const TextStyle(fontSize: 12),
              ),
            ],
          ),
          const SizedBox(height: 8),
          Row(
            children: [
              const Icon(Icons.lightbulb_outline, color: AppTheme.primaryColor, size: 14),
              const SizedBox(width: 4),
              Expanded(
                child: Text(
                  reason,
                  style: const TextStyle(color: AppTheme.textSecondary, fontSize: 12),
                ),
              ),
            ],
          ),
          if (savings > 0) ...[
            const SizedBox(height: 8),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
              decoration: BoxDecoration(
                color: const Color(0xFFE8F5E9),
                borderRadius: BorderRadius.circular(6),
              ),
              child: Text(
                '跨平台可省 ¥${savings.toStringAsFixed(1)}',
                style: const TextStyle(
                  color: AppTheme.successColor,
                  fontSize: 12,
                  fontWeight: FontWeight.bold,
                ),
              ),
            ),
          ],
        ],
      ),
    );
  }

  Widget _buildProductList(RecommendProvider provider) {
    if (provider.productRecommendations.isEmpty) {
      return _buildEmptyState('暂无菜品推荐', '登录后获取个性化推荐');
    }

    return RefreshIndicator(
      onRefresh: () => provider.loadProductRecommendations(),
      child: GridView.builder(
        padding: const EdgeInsets.all(12),
        gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
          crossAxisCount: 2,
          crossAxisSpacing: 12,
          mainAxisSpacing: 12,
          childAspectRatio: 0.9,
        ),
        itemCount: provider.productRecommendations.length,
        itemBuilder: (_, index) {
          final product = provider.productRecommendations[index];
          return _buildProductCard(product);
        },
      ),
    );
  }

  Widget _buildProductCard(Map<String, dynamic> product) {
    final name = product['product_name'] ?? '';
    final category = product['category'] ?? '';
    final reason = product['reason'] ?? '';

    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        boxShadow: [
          BoxShadow(
            color: Colors.grey.withOpacity(0.08),
            blurRadius: 4,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Container(
              width: double.infinity,
              height: 80,
              decoration: BoxDecoration(
                color: AppTheme.primaryColor.withOpacity(0.1),
                borderRadius: BorderRadius.circular(8),
              ),
              child: const Icon(Icons.restaurant, color: AppTheme.primaryColor, size: 32),
            ),
            const SizedBox(height: 8),
            Text(
              name,
              style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14),
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
            ),
            if (category.isNotEmpty)
              Text(
                category,
                style: const TextStyle(color: AppTheme.textSecondary, fontSize: 11),
              ),
            const SizedBox(height: 4),
            Text(
              reason,
              style: const TextStyle(color: AppTheme.primaryColor, fontSize: 11),
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildEmptyState(String title, String subtitle) {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          const Icon(Icons.recommend_outlined, size: 64, color: Colors.grey),
          const SizedBox(height: 16),
          Text(title, style: const TextStyle(color: AppTheme.textSecondary, fontSize: 16)),
          const SizedBox(height: 8),
          Text(subtitle, style: const TextStyle(color: AppTheme.textSecondary, fontSize: 13)),
        ],
      ),
    );
  }
}