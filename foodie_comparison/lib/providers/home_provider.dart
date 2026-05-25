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
      final results = await Future.wait([
        _api.get('/api/coupons/home', params: {'platform': _selectedPlatform}),
        _api.get('/api/recommend/shops', params: {'platform': _selectedPlatform}),
        _api.get('/api/compare/saving-rank', params: {'platform': _selectedPlatform}),
        _api.get('/api/platform/activities', params: {'platform': _selectedPlatform}),
        _api.get('/api/platform/flash-sale', params: {'platform': _selectedPlatform}),
      ]);

      _coupons = List<Map<String, dynamic>>.from(results[0].data);
      _shops = List<Map<String, dynamic>>.from(results[1].data);
      _savingRank = List<Map<String, dynamic>>.from(results[2].data);
      _activities = List<Map<String, dynamic>>.from(results[3].data);
      _flashSale = results[4].data;
    } catch (e) {
      _error = e.toString();
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }
}