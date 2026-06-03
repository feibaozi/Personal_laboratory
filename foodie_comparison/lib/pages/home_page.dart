import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../providers/home_provider.dart';
import '../providers/crawl_provider.dart';
import '../models/index.dart';
import '../widgets/cards/index.dart';

class HomePage extends StatefulWidget {
  const HomePage({super.key});

  @override
  State<HomePage> createState() => _HomePageState();
}

class _HomePageState extends State<HomePage> {
  final List<String> _platforms = ['全部', '美团', '饿了么', '京东外卖', '抖音外卖'];
  int _selectedPlatformIndex = 0;
  final _searchController = TextEditingController();

  static const _platformKeyMap = {
    0: 'all',
    1: 'meituan',
    2: 'eleme',
    3: 'jd',
    4: 'douyin',
  };

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      context.read<HomeProvider>().loadHomeData();
    });
  }

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  void _onSearch(String keyword) {
    if (keyword.trim().isEmpty) return;
    context.read<CrawlProvider>().searchShops(keyword);
  }

  void _onPlatformChanged(int index) {
    setState(() {
      _selectedPlatformIndex = index;
    });
    final platform = _platformKeyMap[index] ?? 'all';
    context.read<HomeProvider>().setPlatform(platform);
  }

  void _onSeeMoreCoupons() {
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(content: Text('领取更多红包')),
    );
  }

  List<Coupon> _parseCoupons(List<Map<String, dynamic>> raw) {
    return raw.map((c) => Coupon(
      id: (c['id'] ?? 0).toString(),
      title: c['title'] ?? '',
      type: c['type'] ?? 'direct',
      value: (c['value'] ?? 0).toDouble(),
      minSpend: (c['min_spend'] ?? 0).toDouble(),
      platform: c['platform'] ?? '',
      expireTime: c['expire_time'] != null
          ? DateTime.tryParse(c['expire_time'].toString()) ?? DateTime.now()
          : DateTime.now(),
      isClaimed: c['is_claimed'] ?? false,
    )).toList();
  }

  List<Shop> _parseShops(List<Map<String, dynamic>> raw) {
    return raw.map((s) {
      final prices = <String, double>{};
      (s['prices'] as Map?)?.forEach((k, v) {
        prices[k.toString()] = (v ?? 0).toDouble();
      });
      return Shop(
        id: (s['id'] ?? 0).toString(),
        name: s['shop_name'] ?? '',
        imageUrl: s['image_url'] ?? '',
        rating: (s['rating'] ?? 0).toDouble(),
        deliveryFee: (s['delivery_fee'] ?? 0).toDouble(),
        minDeliveryTime: (s['min_delivery_time'] ?? 25).toDouble(),
        maxDeliveryTime: (s['max_delivery_time'] ?? 45).toDouble(),
        prices: prices,
        savings: (s['savings'] ?? 0).toDouble(),
      );
    }).toList();
  }

  List<Product> _parseSavingRank(List<Map<String, dynamic>> raw) {
    return raw.map((p) {
      final prices = <String, double>{};
      (p['prices'] as Map?)?.forEach((k, v) {
        prices[k.toString()] = (v ?? 0).toDouble();
      });
      return Product(
        id: (p['rank'] ?? 0).toString(),
        name: p['product_name'] ?? '',
        imageUrl: '',
        prices: prices,
        savings: (p['savings'] ?? 0).toDouble(),
        shopName: p['shop_name'] ?? '',
      );
    }).toList();
  }

  FlashSale? _parseFlashSale(Map<String, dynamic>? raw) {
    if (raw == null) return null;
    return FlashSale(
      id: (raw['id'] ?? 0).toString(),
      title: raw['title'] ?? '',
      description: raw['description'] ?? '',
      discount: (raw['discount'] ?? 0).toDouble(),
      platforms: (raw['platforms'] as List?)?.map((e) => e.toString()).toList() ?? [],
      endTime: raw['end_time'] != null
          ? DateTime.tryParse(raw['end_time'].toString()) ?? DateTime.now()
          : DateTime.now(),
    );
  }

  List<PlatformActivity> _parseActivities(List<Map<String, dynamic>> raw) {
    return raw.map((a) => PlatformActivity(
      id: (a['id'] ?? 0).toString(),
      platform: a['platform'] ?? '',
      title: a['title'] ?? '',
      description: a['description'] ?? '',
      icon: a['icon'] ?? '',
    )).toList();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF5F5F5),
      appBar: AppBar(
        backgroundColor: Colors.white,
        elevation: 0,
        title: const Text(
          '外卖比价助手',
          style: TextStyle(
            color: Color(0xFFFF6B6B),
            fontSize: 20,
            fontWeight: FontWeight.bold,
          ),
        ),
        centerTitle: true,
      ),
      body: Consumer<HomeProvider>(
        builder: (context, provider, _) {
          if (provider.isLoading && provider.coupons.isEmpty) {
            return const Center(child: CircularProgressIndicator());
          }

          if (provider.error.isNotEmpty && provider.coupons.isEmpty) {
            return Center(
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  const Icon(Icons.error_outline, size: 48, color: Colors.grey),
                  const SizedBox(height: 16),
                  Text(provider.error, style: const TextStyle(color: Colors.grey)),
                  const SizedBox(height: 16),
                  ElevatedButton(
                    onPressed: () => provider.loadHomeData(),
                    child: const Text('重试'),
                  ),
                ],
              ),
            );
          }

          final coupons = _parseCoupons(provider.coupons);
          final shops = _parseShops(provider.shops);
          final savingRank = _parseSavingRank(provider.savingRank);
          final flashSale = _parseFlashSale(provider.flashSale);
          final activities = _parseActivities(provider.activities);

          return RefreshIndicator(
            onRefresh: () => provider.loadHomeData(),
            child: ListView(
              children: [
                const SizedBox(height: 12),
                _buildSearchBar(),
                const SizedBox(height: 12),
                _buildPlatformTabs(),
                const SizedBox(height: 12),
                if (coupons.isNotEmpty)
                  CouponCard(coupons: coupons, onSeeMore: _onSeeMoreCoupons),
                if (flashSale != null)
                  FlashSaleCard(flashSale: flashSale),
                if (shops.isNotEmpty)
                  RecommendCard(shops: shops),
                if (savingRank.isNotEmpty)
                  SavingRankCard(products: savingRank),
                if (activities.isNotEmpty)
                  PlatformActivityCard(activities: activities),
                const SizedBox(height: 20),
              ],
            ),
          );
        },
      ),
    );
  }

  Widget _buildSearchBar() {
    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 12),
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
        onSubmitted: _onSearch,
        decoration: InputDecoration(
          hintText: '搜索店铺/菜品，实时爬取美团数据',
          hintStyle: const TextStyle(color: Colors.grey),
          prefixIcon: const Icon(Icons.search, color: Color(0xFFFF6B6B)),
          suffixIcon: IconButton(
            icon: const Icon(Icons.send, color: Color(0xFFFF6B6B), size: 20),
            onPressed: () => _onSearch(_searchController.text),
          ),
          border: InputBorder.none,
          contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
        ),
      ),
    );
  }

  Widget _buildPlatformTabs() {
    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 12),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        boxShadow: [
          BoxShadow(
            color: Colors.grey.withOpacity(0.1),
            blurRadius: 4,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        children: _platforms.asMap().entries.map((entry) {
          final index = entry.key;
          final platform = entry.value;
          return Expanded(
            child: GestureDetector(
              onTap: () => _onPlatformChanged(index),
              child: Container(
                padding: const EdgeInsets.symmetric(vertical: 10),
                decoration: BoxDecoration(
                  color: _selectedPlatformIndex == index
                      ? const Color(0xFFFF6B6B)
                      : Colors.transparent,
                  borderRadius: BorderRadius.circular(8),
                ),
                margin: const EdgeInsets.symmetric(horizontal: 4),
                child: Text(
                  platform,
                  textAlign: TextAlign.center,
                  style: TextStyle(
                    color: _selectedPlatformIndex == index
                        ? Colors.white
                        : Colors.grey,
                    fontWeight: FontWeight.bold,
                  ),
                ),
              ),
            ),
          );
        }).toList(),
      ),
    );
  }
}
