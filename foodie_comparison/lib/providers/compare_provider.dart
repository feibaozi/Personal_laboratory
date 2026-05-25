import 'package:flutter/material.dart';
import '../services/api_client.dart';

class CompareProvider extends ChangeNotifier {
  final ApiClient _api = ApiClient();

  List<Map<String, dynamic>> _results = [];
  List<Map<String, dynamic>> _savingRank = [];
  bool _isLoading = false;
  String _error = '';
  String _searchQuery = '';
  String _selectedPlatform = 'all';

  List<Map<String, dynamic>> get results => _results;
  List<Map<String, dynamic>> get savingRank => _savingRank;
  bool get isLoading => _isLoading;
  String get error => _error;
  String get searchQuery => _searchQuery;
  String get selectedPlatform => _selectedPlatform;

  void setSearchQuery(String query) {
    _searchQuery = query;
    notifyListeners();
  }

  void setPlatform(String platform) {
    _selectedPlatform = platform;
    notifyListeners();
  }

  Future<void> compareProduct(String productName) async {
    if (productName.trim().isEmpty) return;

    _isLoading = true;
    _error = '';
    notifyListeners();

    try {
      List<String> platforms = _selectedPlatform == 'all'
          ? ['meituan', 'eleme', 'jd_waimai', 'douyin_waimai']
          : [_selectedPlatform];

      final response = await _api.post('/api/compare/product', data: {
        'product_name': productName,
        'platforms': platforms,
      });
      _results = List<Map<String, dynamic>>.from(response.data['results'] ?? []);
    } catch (e) {
      _error = '比价失败: ${_parseError(e)}';
      _results = [];
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<void> loadSavingRank({String? platform, int limit = 10}) async {
    _isLoading = true;
    _error = '';
    notifyListeners();

    try {
      final params = <String, dynamic>{'limit': limit};
      if (platform != null && platform != 'all') {
        params['platform'] = platform;
      }
      final response = await _api.get('/api/compare/saving-rank', params: params);
      _savingRank = List<Map<String, dynamic>>.from(response.data['items'] ?? []);
    } catch (e) {
      _error = '加载省钱榜失败: ${_parseError(e)}';
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  String _parseError(dynamic e) {
    if (e.toString().contains('403')) return '请先登录';
    if (e.toString().contains('401')) return '登录已过期，请重新登录';
    return '网络错误，请稍后重试';
  }
}