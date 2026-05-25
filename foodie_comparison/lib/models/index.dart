class Coupon {
  final String id;
  final String title;
  final String type;
  final double value;
  final double minSpend;
  final String platform;
  final DateTime expireTime;
  final bool isClaimed;

  Coupon({
    required this.id,
    required this.title,
    required this.type,
    required this.value,
    required this.minSpend,
    required this.platform,
    required this.expireTime,
    required this.isClaimed,
  });
}

class Shop {
  final String id;
  final String name;
  final String imageUrl;
  final double rating;
  final double deliveryFee;
  final double minDeliveryTime;
  final double maxDeliveryTime;
  final Map<String, double> prices;
  final double savings;

  Shop({
    required this.id,
    required this.name,
    required this.imageUrl,
    required this.rating,
    required this.deliveryFee,
    required this.minDeliveryTime,
    required this.maxDeliveryTime,
    required this.prices,
    required this.savings,
  });
}

class Product {
  final String id;
  final String name;
  final String imageUrl;
  final Map<String, double> prices;
  final double savings;
  final String shopName;

  Product({
    required this.id,
    required this.name,
    required this.imageUrl,
    required this.prices,
    required this.savings,
    required this.shopName,
  });
}

class PlatformActivity {
  final String id;
  final String platform;
  final String title;
  final String description;
  final String icon;

  PlatformActivity({
    required this.id,
    required this.platform,
    required this.title,
    required this.description,
    required this.icon,
  });
}

class FlashSale {
  final String id;
  final String title;
  final String description;
  final double discount;
  final List<String> platforms;
  final DateTime endTime;

  FlashSale({
    required this.id,
    required this.title,
    required this.description,
    required this.discount,
    required this.platforms,
    required this.endTime,
  });
}