import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../services/api_client.dart';

class AuthProvider extends ChangeNotifier {
  final ApiClient _api = ApiClient();

  bool _isLoggedIn = false;
  bool _isLoading = false;
  String _error = '';
  String _username = '';
  int _userId = 0;

  bool get isLoggedIn => _isLoggedIn;
  bool get isLoading => _isLoading;
  String get error => _error;
  String get username => _username;
  int get userId => _userId;

  Future<void> checkLoginStatus() async {
    final prefs = await SharedPreferences.getInstance();
    final token = prefs.getString('access_token');
    if (token != null) {
      try {
        final response = await _api.get('/api/auth/me');
        _isLoggedIn = true;
        _username = response.data['username'] ?? '';
        _userId = response.data['id'] ?? 0;
      } catch (_) {
        prefs.remove('access_token');
        _isLoggedIn = false;
      }
    }
    notifyListeners();
  }

  Future<bool> login(String username, String password) async {
    _isLoading = true;
    _error = '';
    notifyListeners();

    try {
      final response = await _api.post('/api/auth/login', data: {
        'username': username,
        'password': password,
      });

      final data = response.data;
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString('access_token', data['access_token']);

      _isLoggedIn = true;
      _username = data['username'] ?? username;
      _userId = data['user_id'] ?? 0;
      _isLoading = false;
      notifyListeners();
      return true;
    } catch (e) {
      _error = '登录失败: $e';
      _isLoading = false;
      notifyListeners();
      return false;
    }
  }

  Future<bool> register(String username, String password) async {
    _isLoading = true;
    _error = '';
    notifyListeners();

    try {
      final response = await _api.post('/api/auth/register', data: {
        'username': username,
        'password': password,
      });

      final data = response.data;
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString('access_token', data['access_token']);

      _isLoggedIn = true;
      _username = data['username'] ?? username;
      _userId = data['user_id'] ?? 0;
      _isLoading = false;
      notifyListeners();
      return true;
    } catch (e) {
      _error = '注册失败: $e';
      _isLoading = false;
      notifyListeners();
      return false;
    }
  }

  Future<void> logout() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove('access_token');
    _isLoggedIn = false;
    _username = '';
    _userId = 0;
    notifyListeners();
  }
}