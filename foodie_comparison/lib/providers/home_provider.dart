import 'package:flutter/material.dart';
import '../services/api_client.dart';

class HomeProvider extends ChangeNotifier {
  final ApiClient _api = ApiClient();

  List<Map<String, dynamic>> _coupons = [];
  List<Map<String, dynamic>> _shops = [];
  List<Map<String, dynamic>> _savingRank = [];
  List<Map<String, dynamic>> _activities = [];
  Map<String, dynamic>? _flashSale;

  bool _isLoading = false;
  String _error = '';
  String _selectedPlatform = 'all';

  List<Map<String, dynamic>> get coupons => _coupons;
  List<Map<String, dynamic>> get shops => _shops;
  List<Map<String, dynamic>> get savingRank => _savingRank;
  List<Map<String, dynamic>> get activities => _activities;
  Map<String, dynamic>? get flashSale => _flashSale;
  bool get isLoading => _isLoading;
  String get error => _error;
  String get selectedPlatform => _selectedPlatform;

  void setPlatform(String platform) {
    _selectedPlatform = platform;
    notifyListeners();
    loadHomeData();
  }

  Future<void> loadHomeData() async {
    _isLoading = true;
    _error = '';
    notifyListeners();

    try {
      final params = {'platform': _selectedPlatform};

      final couponsRes = await _api.get('/api/coupons/home', params: params);
      _coupons = List<Map<String, dynamic>>.from(couponsRes.data['coupons'] ?? []);

      final shopsRes = await _api.get('/api/recommend/shops', params: {
        'platform': _selectedPlatform,
        'limit': 10,
      });
      _shops = List<Map<String, dynamic>>.from(shopsRes.data['shops'] ?? []);

      final rankRes = await _api.get('/api/compare/saving-rank', params: params);
      _savingRank = List<Map<String, dynamic>>.from(rankRes.data['items'] ?? []);

      final activitiesRes = await _api.get('/api/platform/activities', params: params);
      _activities = List<Map<String, dynamic>>.from(activitiesRes.data['activities'] ?? []);

      final flashRes = await _api.get('/api/platform/flash-sale', params: params);
      final sales = List<Map<String, dynamic>>.from(flashRes.data['sales'] ?? []);
      _flashSale = sales.isNotEmpty ? sales.first : null;
    } catch (e) {
      _error = e.toString();
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }
}
