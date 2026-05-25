import 'package:flutter/material.dart';
import '../widgets/cards/index.dart';
import '../data/mock_data.dart';

class HomePage extends StatefulWidget {
  const HomePage({super.key});

  @override
  State<HomePage> createState() => _HomePageState();
}

class _HomePageState extends State<HomePage> {
  final List<String> _platforms = ['美团', '饿了么', '京东外卖', '抖音外卖'];
  int _selectedPlatformIndex = 0;

  void _onPlatformChanged(int index) {
    setState(() {
      _selectedPlatformIndex = index;
    });
  }

  void _onSeeMoreCoupons() {
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(content: Text('领取更多红包')),
    );
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
      body: ListView(
        children: [
          const SizedBox(height: 12),
          _buildSearchBar(),
          const SizedBox(height: 12),
          _buildPlatformTabs(),
          const SizedBox(height: 12),
          CouponCard(
            coupons: mockCoupons,
            onSeeMore: _onSeeMoreCoupons,
          ),
          FlashSaleCard(flashSale: mockFlashSale),
          RecommendCard(shops: mockRecommendedShops),
          SavingRankCard(products: mockSavingRank),
          PlatformActivityCard(activities: mockPlatformActivities),
          const SizedBox(height: 20),
        ],
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
      child: const TextField(
        decoration: InputDecoration(
          hintText: '搜索店铺/菜品',
          hintStyle: TextStyle(color: Colors.grey),
          prefixIcon: Icon(Icons.search, color: Color(0xFFFF6B6B)),
          border: InputBorder.none,
          contentPadding: EdgeInsets.symmetric(horizontal: 16, vertical: 14),
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