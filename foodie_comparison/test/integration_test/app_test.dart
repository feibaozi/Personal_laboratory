import 'package:flutter_test/flutter_test.dart';
import 'package:integration_test/integration_test.dart';
import 'package:foodie_comparison/main.dart' as app;

void main() {
  IntegrationTestWidgetsFlutterBinding.ensureInitialized();

  group('首页测试 (HomePage)', () {
    setUp(() async {
      app.main();
      await Future.delayed(const Duration(seconds: 2));
    });

    testWidgets('HOME-001: 正常搜索', (WidgetTester tester) async {
      await tester.pumpAndSettle();
      
      final searchField = find.byType(TextFormField).first;
      await tester.tap(searchField);
      await tester.enterText(searchField, '水煮鱼');
      await tester.testTextInput.receiveAction(TextInputAction.done);
      await tester.pumpAndSettle();

      expect(find.text('水煮鱼'), findsOneWidget);
    });

    testWidgets('HOME-002: 空搜索', (WidgetTester tester) async {
      await tester.pumpAndSettle();
      
      final searchField = find.byType(TextFormField).first;
      await tester.tap(searchField);
      await tester.testTextInput.receiveAction(TextInputAction.done);
      await tester.pumpAndSettle();

      expect(find.text('请输入搜索内容'), findsOneWidget);
    });

    testWidgets('HOME-005: 切换到美团', (WidgetTester tester) async {
      await tester.pumpAndSettle();
      
      final meituanTab = find.text('美团');
      await tester.tap(meituanTab);
      await tester.pumpAndSettle();

      expect(meituanTab, findsOneWidget);
    });

    testWidgets('HOME-010: 红包卡片显示', (WidgetTester tester) async {
      await tester.pumpAndSettle();
      
      final couponCards = find.byKey(const Key('coupon_card'));
      expect(couponCards, findsWidgets);
    });

    testWidgets('HOME-014: 限时特惠倒计时显示', (WidgetTester tester) async {
      await tester.pumpAndSettle();
      
      final flashSale = find.byKey(const Key('flash_sale'));
      expect(flashSale, findsOneWidget);
    });

    testWidgets('HOME-018: 推荐店铺网格', (WidgetTester tester) async {
      await tester.pumpAndSettle();
      
      final recommendCards = find.byKey(const Key('recommend_card'));
      expect(recommendCards, findsWidgets);
    });

    testWidgets('HOME-022: 省钱榜单排名显示', (WidgetTester tester) async {
      await tester.pumpAndSettle();
      
      final rankCard = find.byKey(const Key('saving_rank_card'));
      expect(rankCard, findsOneWidget);
    });

    testWidgets('HOME-025: 平台活动列表显示', (WidgetTester tester) async {
      await tester.pumpAndSettle();
      
      final activityCards = find.byKey(const Key('platform_activity_card'));
      expect(activityCards, findsWidgets);
    });
  });

  group('比价页测试 (ComparePage)', () {
    setUp(() async {
      app.main();
      await Future.delayed(const Duration(seconds: 2));
    });

    testWidgets('CMP-001: 正常比价搜索', (WidgetTester tester) async {
      await tester.pumpAndSettle();
      
      await tester.tap(find.text('比价'));
      await tester.pumpAndSettle();

      final searchField = find.byType(TextField).first;
      await tester.tap(searchField);
      await tester.enterText(searchField, '水煮鱼');
      await tester.testTextInput.receiveAction(TextInputAction.done);
      await tester.pumpAndSettle();

      expect(find.text('比价结果'), findsOneWidget);
    });

    testWidgets('CMP-009: 筛选全部平台', (WidgetTester tester) async {
      await tester.pumpAndSettle();
      
      await tester.tap(find.text('比价'));
      await tester.pumpAndSettle();

      final allBtn = find.text('全部');
      await tester.tap(allBtn);
      await tester.pumpAndSettle();

      expect(allBtn, findsOneWidget);
    });

    testWidgets('CMP-010: 筛选美团', (WidgetTester tester) async {
      await tester.pumpAndSettle();
      
      await tester.tap(find.text('比价'));
      await tester.pumpAndSettle();

      final meituanBtn = find.text('美团');
      await tester.tap(meituanBtn);
      await tester.pumpAndSettle();

      expect(meituanBtn, findsOneWidget);
    });

    testWidgets('CMP-015: 榜单加载', (WidgetTester tester) async {
      await tester.pumpAndSettle();
      
      await tester.tap(find.text('比价'));
      await tester.pumpAndSettle();

      final rankList = find.byKey(const Key('saving_rank_list'));
      expect(rankList, findsOneWidget);
    });

    testWidgets('CMP-017: 下拉刷新', (WidgetTester tester) async {
      await tester.pumpAndSettle();
      
      await tester.tap(find.text('比价'));
      await tester.pumpAndSettle();

      await tester.drag(find.byType(ListView), const Offset(0, 100));
      await tester.pumpAndSettle();

      expect(find.byType(RefreshIndicator), findsOneWidget);
    });
  });

  group('推荐页测试 (RecommendPage)', () {
    setUp(() async {
      app.main();
      await Future.delayed(const Duration(seconds: 2));
    });

    testWidgets('REC-001: 切换到店铺推荐', (WidgetTester tester) async {
      await tester.pumpAndSettle();
      
      await tester.tap(find.text('推荐'));
      await tester.pumpAndSettle();

      final shopTab = find.text('店铺推荐');
      await tester.tap(shopTab);
      await tester.pumpAndSettle();

      expect(shopTab, findsOneWidget);
    });

    testWidgets('REC-002: 切换到菜品推荐', (WidgetTester tester) async {
      await tester.pumpAndSettle();
      
      await tester.tap(find.text('推荐'));
      await tester.pumpAndSettle();

      final productTab = find.text('菜品推荐');
      await tester.tap(productTab);
      await tester.pumpAndSettle();

      expect(productTab, findsOneWidget);
    });

    testWidgets('REC-006: 店铺卡片信息', (WidgetTester tester) async {
      await tester.pumpAndSettle();
      
      await tester.tap(find.text('推荐'));
      await tester.pumpAndSettle();

      final shopCards = find.byKey(const Key('recommend_shop_card'));
      expect(shopCards, findsWidgets);
    });

    testWidgets('REC-012: 菜品网格加载', (WidgetTester tester) async {
      await tester.pumpAndSettle();
      
      await tester.tap(find.text('推荐'));
      await tester.pumpAndSettle();

      await tester.tap(find.text('菜品推荐'));
      await tester.pumpAndSettle();

      final productCards = find.byKey(const Key('recommend_product_card'));
      expect(productCards, findsWidgets);
    });
  });

  group('全局交互测试', () {
    setUp(() async {
      app.main();
      await Future.delayed(const Duration(seconds: 2));
    });

    testWidgets('NAV-001: 切换到首页', (WidgetTester tester) async {
      await tester.pumpAndSettle();
      
      await tester.tap(find.text('比价'));
      await tester.pumpAndSettle();

      await tester.tap(find.text('首页'));
      await tester.pumpAndSettle();

      expect(find.byType(TextFormField).first, findsOneWidget);
    });

    testWidgets('NAV-002: 切换到比价页', (WidgetTester tester) async {
      await tester.pumpAndSettle();
      
      await tester.tap(find.text('比价'));
      await tester.pumpAndSettle();

      expect(find.text('智能比价'), findsOneWidget);
    });

    testWidgets('NAV-003: 切换到推荐页', (WidgetTester tester) async {
      await tester.pumpAndSettle();
      
      await tester.tap(find.text('推荐'));
      await tester.pumpAndSettle();

      expect(find.text('智能推荐'), findsOneWidget);
    });

    testWidgets('NAV-004: 切换到我的页', (WidgetTester tester) async {
      await tester.pumpAndSettle();
      
      await tester.tap(find.text('我的'));
      await tester.pumpAndSettle();

      expect(find.text('我的'), findsOneWidget);
    });
  });

  group('登录状态测试', () {
    setUp(() async {
      app.main();
      await Future.delayed(const Duration(seconds: 2));
    });

    testWidgets('AUTH-001: 未登录访问需要登录的功能', (WidgetTester tester) async {
      await tester.pumpAndSettle();
      
      await tester.tap(find.text('比价'));
      await tester.pumpAndSettle();

      final searchField = find.byType(TextField).first;
      await tester.tap(searchField);
      await tester.enterText(searchField, '测试');
      await tester.testTextInput.receiveAction(TextInputAction.done);
      await tester.pumpAndSettle();

      expect(find.text('请先登录'), findsOneWidget);
    });

    testWidgets('AUTH-004: 退出登录', (WidgetTester tester) async {
      await tester.pumpAndSettle();
      
      await tester.tap(find.text('我的'));
      await tester.pumpAndSettle();

      final logoutBtn = find.text('退出登录');
      if (logoutBtn.evaluate().isNotEmpty) {
        await tester.tap(logoutBtn);
        await tester.pumpAndSettle();
        
        await tester.tap(find.text('确定'));
        await tester.pumpAndSettle();

        expect(find.text('登录 / 注册'), findsOneWidget);
      }
    });
  });
}