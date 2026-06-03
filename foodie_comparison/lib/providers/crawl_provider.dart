import 'package:flutter/material.dart';
import '../services/api_client.dart';

class CrawlProvider extends ChangeNotifier {
  final ApiClient _api = ApiClient();

  List<Map<String, dynamic>> _shops = [];
  Map<String, dynamic>? _shopDetail;
  bool _isLoading = false;
  bool _isCrawling = false;
  String _error = '';
  String _source = '';
  String _lastKeyword = '';

  List<Map<String, dynamic>> get shops => _shops;
  Map<String, dynamic>? get shopDetail => _shopDetail;
  bool get isLoading => _isLoading;
  bool get isCrawling => _isCrawling;
  String get error => _error;
  String get source => _source;
  String get lastKeyword => _lastKeyword;

  Future<void> searchShops(String keyword, {String city = '北京', String platform = 'meituan'}) async {
    if (keyword.trim().isEmpty) return;

    _isLoading = true;
    _error = '';
    _lastKeyword = keyword;
    notifyListeners();

    try {
      final response = await _api.get('/api/crawl/shops/search', params: {
        'keyword': keyword,
        'city': city,
        'platform': platform,
      });

      _source = response.data['source'] ?? '';
      _shops = List<Map<String, dynamic>>.from(response.data['shops'] ?? []);

      if (_source == 'crawling') {
        _isCrawling = true;
      } else {
        _isCrawling = false;
      }
    } catch (e) {
      _error = _parseError(e);
      _shops = [];
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<void> loadShopDetail(int shopId) async {
    _isLoading = true;
    _error = '';
    notifyListeners();

    try {
      final response = await _api.get('/api/crawl/shops/$shopId');
      _shopDetail = response.data['data'];
      _source = response.data['source'] ?? '';
    } catch (e) {
      _error = _parseError(e);
      _shopDetail = null;
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<void> crawlFromUrl(String url) async {
    _isLoading = true;
    _error = '';
    notifyListeners();

    try {
      final response = await _api.post('/api/crawl/url', data: {'url': url});
      _source = 'crawler';
    } catch (e) {
      _error = _parseError(e);
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<Map<String, dynamic>?> getComplianceReport() async {
    try {
      final response = await _api.get('/api/crawl/compliance');
      return response.data;
    } catch (e) {
      return null;
    }
  }

  Future<List<Map<String, dynamic>>> getPlatforms() async {
    try {
      final response = await _api.get('/api/crawl/platforms');
      return List<Map<String, dynamic>>.from(response.data['platforms'] ?? []);
    } catch (e) {
      return [];
    }
  }

  Future<String?> triggerPopularCrawl() async {
    try {
      final response = await _api.post('/api/crawl/trigger/popular');
      return response.data['message'];
    } catch (e) {
      return null;
    }
  }

  void clearResults() {
    _shops = [];
    _shopDetail = null;
    _error = '';
    _source = '';
    _isCrawling = false;
    notifyListeners();
  }

  String _parseError(dynamic e) {
    final msg = e.toString();
    if (msg.contains('403')) return '请先登录';
    if (msg.contains('401')) return '登录已过期，请重新登录';
    if (msg.contains('404')) return '数据不存在';
    return '网络错误，请稍后重试';
  }
}
