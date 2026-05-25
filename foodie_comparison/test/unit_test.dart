import 'package:flutter_test/flutter_test.dart';
import 'package:mockito/mockito.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../lib/services/api_client.dart';
import '../lib/providers/auth_provider.dart';
import '../lib/providers/compare_provider.dart';
import '../lib/providers/recommend_provider.dart';

class MockApiClient extends Mock implements ApiClient {}

void main() {
  group('ApiClient 测试', () {
    late ApiClient apiClient;

    setUp(() {
      apiClient = ApiClient();
    });

    test('单例模式验证', () {
      final instance1 = ApiClient();
      final instance2 = ApiClient();
      expect(instance1, same(instance2));
    });

    test('基础URL配置', () {
      expect(apiClient.dio.options.baseUrl, isNotEmpty);
    });
  });

  group('AuthProvider 测试', () {
    late AuthProvider authProvider;
    late MockApiClient mockApi;

    setUp(() {
      mockApi = MockApiClient();
      authProvider = AuthProvider();
    });

    test('初始状态 - 未登录', () {
      expect(authProvider.isLoggedIn, false);
      expect(authProvider.username, '');
      expect(authProvider.token, '');
    });

    test('登录状态检查 - 无Token', () async {
      SharedPreferences.setMockInitialValues({});
      await authProvider.checkLoginStatus();
      expect(authProvider.isLoggedIn, false);
    });

    test('登录状态检查 - 有Token', () async {
      SharedPreferences.setMockInitialValues({
        'access_token': 'test_token',
        'username': 'test_user',
      });
      await authProvider.checkLoginStatus();
      expect(authProvider.isLoggedIn, true);
      expect(authProvider.username, 'test_user');
    });

    test('登出功能', () async {
      SharedPreferences.setMockInitialValues({
        'access_token': 'test_token',
        'username': 'test_user',
      });
      await authProvider.checkLoginStatus();
      
      await authProvider.logout();
      expect(authProvider.isLoggedIn, false);
      expect(authProvider.username, '');
    });
  });

  group('CompareProvider 测试', () {
    late CompareProvider provider;

    setUp(() {
      provider = CompareProvider();
    });

    test('初始状态', () {
      expect(provider.results, []);
      expect(provider.savingRank, []);
      expect(provider.isLoading, false);
      expect(provider.error, '');
      expect(provider.searchQuery, '');
      expect(provider.selectedPlatform, 'all');
    });

    test('设置搜索查询', () {
      provider.setSearchQuery('水煮鱼');
      expect(provider.searchQuery, '水煮鱼');
    });

    test('设置平台筛选', () {
      provider.setPlatform('meituan');
      expect(provider.selectedPlatform, 'meituan');
    });

    test('重置平台筛选', () {
      provider.setPlatform('meituan');
      provider.setPlatform('all');
      expect(provider.selectedPlatform, 'all');
    });
  });

  group('RecommendProvider 测试', () {
    late RecommendProvider provider;

    setUp(() {
      provider = RecommendProvider();
    });

    test('初始状态', () {
      expect(provider.shopRecommendations, []);
      expect(provider.productRecommendations, []);
      expect(provider.behaviors, []);
      expect(provider.history, []);
      expect(provider.isLoading, false);
      expect(provider.error, '');
    });
  });

  group('数据模型测试', () {
    test('Coupon 模型创建', () {
      final coupon = Coupon(
        id: '1',
        title: '测试优惠券',
        type: 'direct',
        value: 10,
        minSpend: 50,
        platform: 'meituan',
        expireTime: DateTime.now(),
        isClaimed: false,
      );

      expect(coupon.id, '1');
      expect(coupon.title, '测试优惠券');
      expect(coupon.value, 10);
      expect(coupon.minSpend, 50);
      expect(coupon.isClaimed, false);
    });

    test('Shop 模型创建', () {
      final shop = Shop(
        id: '1',
        name: '测试店铺',
        imageUrl: 'https://test.com',
        rating: 4.5,
        deliveryFee: 3,
        minDeliveryTime: 20,
        maxDeliveryTime: 35,
        prices: {'meituan': 30.0},
        savings: 5.0,
      );

      expect(shop.name, '测试店铺');
      expect(shop.rating, 4.5);
      expect(shop.deliveryFee, 3);
      expect(shop.savings, 5.0);
    });

    test('Product 模型创建', () {
      final product = Product(
        id: '1',
        name: '测试菜品',
        imageUrl: 'https://test.com',
        prices: {'meituan': 25.0, 'eleme': 22.0},
        savings: 3.0,
        shopName: '测试店铺',
      );

      expect(product.name, '测试菜品');
      expect(product.prices.length, 2);
      expect(product.savings, 3.0);
    });

    test('FlashSale 模型创建', () {
      final flashSale = FlashSale(
        id: '1',
        title: '限时特惠',
        description: '满30减15',
        discount: 15,
        platforms: ['美团', '饿了么'],
        endTime: DateTime.now().add(const Duration(hours: 5)),
      );

      expect(flashSale.title, '限时特惠');
      expect(flashSale.discount, 15);
      expect(flashSale.platforms.length, 2);
    });

    test('PlatformActivity 模型创建', () {
      final activity = PlatformActivity(
        id: '1',
        platform: '美团',
        title: '品牌日',
        description: '满50减20',
        icon: '🍔',
      );

      expect(activity.platform, '美团');
      expect(activity.title, '品牌日');
      expect(activity.icon, '🍔');
    });
  });

  group('Mock数据测试', () {
    test('mockCoupons 数据完整性', () {
      expect(mockCoupons.length, 4);
      for (var coupon in mockCoupons) {
        expect(coupon.id, isNotEmpty);
        expect(coupon.title, isNotEmpty);
        expect(coupon.value, greaterThan(0));
      }
    });

    test('mockRecommendedShops 数据完整性', () {
      expect(mockRecommendedShops.length, 4);
      for (var shop in mockRecommendedShops) {
        expect(shop.id, isNotEmpty);
        expect(shop.name, isNotEmpty);
        expect(shop.rating, greaterThanOrEqualTo(4.0));
      }
    });

    test('mockSavingRank 数据完整性', () {
      expect(mockSavingRank.length, 3);
      for (var item in mockSavingRank) {
        expect(item.id, isNotEmpty);
        expect(item.name, isNotEmpty);
        expect(item.savings, greaterThan(0));
      }
    });

    test('mockPlatformActivities 数据完整性', () {
      expect(mockPlatformActivities.length, 4);
      for (var activity in mockPlatformActivities) {
        expect(activity.id, isNotEmpty);
        expect(activity.platform, isNotEmpty);
        expect(activity.icon, isNotEmpty);
      }
    });
  });
}