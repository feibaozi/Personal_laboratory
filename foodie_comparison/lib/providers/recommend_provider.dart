import 'package:flutter/material.dart';
import '../services/api_client.dart';

class RecommendProvider extends ChangeNotifier {
  final ApiClient _api = ApiClient();

  List<Map<String, dynamic>> _shopRecommendations = [];
  List<Map<String, dynamic>> _productRecommendations = [];
  List<Map<String, dynamic>> _behaviors = [];
  List<Map<String, dynamic>> _history = [];
  bool _isLoading = false;
  String _error = '';

  List<Map<String, dynamic>> get shopRecommendations => _shopRecommendations;
  List<Map<String, dynamic>> get productRecommendations => _productRecommendations;
  List<Map<String, dynamic>> get behaviors => _behaviors;
  List<Map<String, dynamic>> get history => _history;
  bool get isLoading => _isLoading;
  String get error => _error;

  Future<void> loadShopRecommendations({int limit = 10, String? platform}) async {
    _isLoading = true;
    _error = '';
    notifyListeners();

    try {
      final data = <String, dynamic>{'limit': limit, 'recommend_type': 'shop'};
      if (platform != null) data['platform'] = platform;

      final response = await _api.post('/api/recommend/shops', data: data);
      _shopRecommendations = List<Map<String, dynamic>>.from(
        response.data['items'] ?? [],
      );
    } catch (e) {
      _error = '加载推荐失败: ${_parseError(e)}';
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<void> loadProductRecommendations({int limit = 10, String? platform}) async {
    _isLoading = true;
    _error = '';
    notifyListeners();

    try {
      final data = <String, dynamic>{'limit': limit, 'recommend_type': 'product'};
      if (platform != null) data['platform'] = platform;

      final response = await _api.post('/api/recommend/products', data: data);
      _productRecommendations = List<Map<String, dynamic>>.from(
        response.data['items'] ?? [],
      );
    } catch (e) {
      _error = '加载推荐失败: ${_parseError(e)}';
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<void> logBehavior({
    required String behaviorType,
    required String targetType,
    required int targetId,
    String targetName = '',
    Map<String, dynamic>? context,
  }) async {
    try {
      await _api.post('/api/recommend/behavior', data: {
        'behavior_type': behaviorType,
        'target_type': targetType,
        'target_id': targetId,
        'target_name': targetName,
        'context': context ?? {},
      });
    } catch (_) {}
  }

  Future<void> loadBehaviors({int limit = 50}) async {
    try {
      final response = await _api.get('/api/recommend/behaviors', params: {'limit': limit});
      _behaviors = List<Map<String, dynamic>>.from(
        response.data['behaviors'] ?? [],
      );
      notifyListeners();
    } catch (_) {}
  }

  Future<void> loadHistory({String type = 'shop', int limit = 5}) async {
    try {
      final response = await _api.get(
        '/api/recommend/history',
        params: {'recommend_type': type, 'limit': limit},
      );
      _history = List<Map<String, dynamic>>.from(
        response.data['history'] ?? [],
      );
      notifyListeners();
    } catch (_) {}
  }

  String _parseError(dynamic e) {
    if (e.toString().contains('403')) return '请先登录';
    if (e.toString().contains('401')) return '登录已过期，请重新登录';
    return '网络错误，请稍后重试';
  }
}