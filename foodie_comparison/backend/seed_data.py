"""Seed the database with test data for demo purposes.

Run:  python seed_data.py
"""
import datetime
import json
import sys
import os

sys.path.insert(0, os.path.dirname(__file__))

from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from app.database import Base
from app.models import (
    User, UserPreference,
    Shop, ShopPlatformLink,
    Product, CrossPlatformProduct,
    PriceSnapshot, DeliveryFeeSnapshot,
    Coupon, CouponType, UserCoupon,
    OrderHistory,
    PlatformActivity, FlashSale,
    UserBehavior, RecommendResult,
)
from app.config import settings

now = datetime.datetime.utcnow
PLATFORMS = ["meituan", "eleme", "jd", "douyin"]


def seed():
    engine = create_engine(settings.database_url_sync, echo=False)
    Base.metadata.create_all(engine)

    with Session(engine) as db:
        if db.query(Shop).first():
            print("Database already seeded. Skipping.")
            return

        print("Seeding database...")

        u1 = User(username="testuser", phone="13800138000",
                  hashed_password="pbkdf2_sha256$870000$test-hash", nickname="美食达人",
                  default_address="北京市朝阳区望京SOHO", is_active=True,
                  created_at=now(), updated_at=now())
        u2 = User(username="foodie_xiao", phone="13900139000",
                  hashed_password="pbkdf2_sha256$870000$test-hash-2", nickname="小吃货",
                  default_address="北京市海淀区中关村", is_active=True,
                  created_at=now(), updated_at=now())
        db.add_all([u1, u2])
        db.flush()

        db.add(UserPreference(
            user_id=u1.id,
            cuisine_weights={"麻辣烫": 0.9, "烧烤": 0.8, "炸鸡": 0.7, "奶茶": 0.6, "螺蛳粉": 0.7, "煎饼果子": 0.5},
            taste_weights={"辣": 0.9, "咸": 0.7, "甜": 0.5, "酸": 0.4},
            avg_order_amount=38.0, price_sensitivity=0.6,
            preferred_platforms=["meituan", "eleme"],
            preferred_delivery_time=30, updated_at=now()))
        db.add(UserPreference(
            user_id=u2.id,
            cuisine_weights={"日料": 0.9, "奶茶": 0.8, "川菜": 0.7, "粤菜": 0.6, "海鲜": 0.7, "甜品": 0.8},
            taste_weights={"鲜": 0.9, "甜": 0.7, "辣": 0.6, "清淡": 0.5},
            avg_order_amount=55.0, price_sensitivity=0.3,
            preferred_platforms=["eleme", "jd"],
            preferred_delivery_time=40, updated_at=now()))
        db.flush()

        shop_defs = [
            ("杨记麻辣烫", "麻辣烫", 4.7, "朝阳区望京街10号", False),
            ("老北京炙子烤肉", "烧烤", 4.8, "朝阳区阜通西大街5号", False),
            ("樱花寿司屋", "日料", 4.6, "海淀区中关村大街15号", False),
            ("快乐柠檬", "奶茶", 4.5, "朝阳区望京SOHO T1-B1", True),
            ("叫了个炸鸡", "炸鸡", 4.4, "朝阳区望京西路8号", True),
            ("眉州东坡", "川菜", 4.8, "海淀区五道口购物中心3F", True),
            ("海底捞火锅", "火锅", 4.9, "朝阳区三里屯路19号", True),
            ("真功夫中式快餐", "快餐", 4.3, "朝阳区建国路88号", True),
            ("兰州马记拉面", "面馆", 4.5, "海淀区学院路32号", False),
            ("东北大馅饺子王", "饺子", 4.6, "朝阳区安立路66号", False),
            ("陶陶居酒家", "粤菜", 4.8, "东城区王府井大街138号", True),
            ("首尔炸鸡啤酒屋", "韩料", 4.5, "朝阳区望京西园四区", False),
            ("暹罗之味泰餐厅", "泰餐", 4.6, "朝阳区三里屯太古里南区", False),
            ("意面工坊", "西餐", 4.4, "海淀区中关村欧美汇购物中心", False),
            ("满记甜品", "甜品", 4.7, "朝阳区望京凯德Mall B1", True),
            ("粥全道养生粥铺", "粥店", 4.3, "海淀区知春路22号", False),
            ("味多美烘焙工坊", "烘焙", 4.5, "朝阳区建国路89号", True),
            ("沙拉日记轻食", "沙拉", 4.4, "海淀区中关村软件园二期", False),
            ("鲜上渔海鲜大排档", "海鲜", 4.7, "朝阳区亮马桥路48号", False),
            ("新疆大盘鸡之家", "新疆菜", 4.6, "海淀区成府路28号", False),
            ("剁椒鱼头王", "湘菜", 4.5, "朝阳区劲松南路12号", False),
            ("东北人家菜馆", "东北菜", 4.4, "海淀区清河小营东路18号", False),
            ("云南过桥米线", "云南菜", 4.5, "朝阳区双井富力广场B1", False),
            ("清心素食馆", "素食", 4.3, "海淀区万寿路甲15号", False),
            ("绝味鸭脖", "卤味", 4.5, "朝阳区望京花园东区底商", True),
            ("烤匠烤鱼", "烤鱼", 4.6, "朝阳区大望路SOHO现代城", True),
            ("好欢螺螺蛳粉", "螺蛳粉", 4.4, "海淀区五道口华联商厦B1", False),
            ("秦镇凉皮", "凉皮", 4.3, "朝阳区望京新城底商", False),
            ("老潼关肉夹馍", "肉夹馍", 4.5, "海淀区魏公村路8号", False),
            ("煎饼侠", "煎饼果子", 4.2, "朝阳区望京SOHO T2底商", False),
        ]
        shops = []
        for i, (name, cat, rating, addr, chain) in enumerate(shop_defs):
            s = Shop(name=name, image_url="", rating=rating, category=cat, address=addr,
                     latitude=39.98 + i * 0.003, longitude=116.45 + i * 0.003,
                     is_chain=chain, created_at=now(), updated_at=now())
            db.add(s)
            shops.append(s)
        db.flush()

        for s in shops:
            for plat in PLATFORMS:
                db.add(ShopPlatformLink(
                    shop_id=s.id, platform=plat,
                    platform_shop_id=f"{plat}_{s.id}",
                    platform_url=f"https://{plat}.com/shop/{s.id}",
                    extra_data={}, created_at=now()))
        db.flush()

        product_defs = {
            "杨记麻辣烫": [
                ("招牌麻辣烫(大份)", "主食", "满满一大碗，料超足", 28.0),
                ("麻辣烫(小份)", "主食", "一人食刚好", 18.0),
                ("酸辣粉", "主食", "地道四川酸辣味", 15.0),
                ("冰粉", "甜品", "解辣神器", 8.0),
            ],
            "老北京炙子烤肉": [
                ("招牌烤羊肉", "烤肉", "鲜嫩多汁", 48.0),
                ("烤牛肉大份", "烤肉", "秘制酱料腌制", 55.0),
                ("烤鸡翅(6只)", "烤肉", "外焦里嫩", 22.0),
                ("烤韭菜", "素菜", "经典搭配", 10.0),
                ("烤馒头片", "主食", "焦香酥脆", 6.0),
            ],
            "樱花寿司屋": [
                ("三文鱼刺身(8片)", "刺身", "挪威进口三文鱼", 68.0),
                ("鳗鱼饭", "主食", "蒲烧鳗鱼配玉子", 45.0),
                ("樱花卷(6枚)", "寿司", "颜值担当", 32.0),
                ("味增汤", "汤品", "日料标配", 12.0),
            ],
            "快乐柠檬": [
                ("经典珍珠奶茶(大杯)", "奶茶", "Q弹珍珠+醇香奶茶", 18.0),
                ("满杯西柚", "果茶", "新鲜西柚果肉", 22.0),
                ("柠檬绿茶", "果茶", "清爽解腻", 15.0),
                ("奥利奥奶茶", "奶茶", "饼干碎+奶油顶", 20.0),
            ],
            "叫了个炸鸡": [
                ("整只炸鸡", "炸鸡", "外酥里嫩一整只", 36.0),
                ("炸鸡腿(2个)", "炸鸡", "超大腿满足感", 18.0),
                ("鸡米花", "小食", "一口一个", 12.0),
                ("薯条大份", "小食", "金黄酥脆", 12.0),
            ],
            "眉州东坡": [
                ("东坡肘子", "大菜", "软糯入味招牌菜", 78.0),
                ("水煮牛肉", "川菜", "麻辣鲜香", 58.0),
                ("麻婆豆腐", "川菜", "麻辣下饭", 28.0),
                ("回锅肉", "川菜", "经典川味", 32.0),
            ],
            "海底捞火锅": [
                ("番茄锅底", "锅底", "酸甜浓郁经典款", 68.0),
                ("麻辣锅底", "锅底", "正宗川味麻辣", 68.0),
                ("精品肥牛卷", "肉类", "雪花纹理入口即化", 58.0),
                ("虾滑", "海鲜", "手打鲜虾滑", 38.0),
                ("捞面", "主食", "现场拉面表演", 12.0),
            ],
            "真功夫中式快餐": [
                ("香汁排骨饭", "套餐", "招牌排骨套餐", 28.0),
                ("冬菇鸡腿饭", "套餐", "鲜嫩鸡腿配冬菇", 26.0),
                ("鱼香肉丝饭", "套餐", "经典家常味", 22.0),
                ("紫菜蛋花汤", "汤品", "清淡爽口", 5.0),
            ],
            "兰州马记拉面": [
                ("牛肉拉面(大碗)", "主食", "一清二白三红四绿", 18.0),
                ("牛肉拉面(小碗)", "主食", "经典兰州味", 14.0),
                ("凉拌牛肉", "凉菜", "鲜香入味", 28.0),
                ("茶叶蛋", "小食", "入味茶叶蛋", 3.0),
            ],
            "东北大馅饺子王": [
                ("猪肉白菜水饺(20只)", "主食", "皮薄馅大汁多", 28.0),
                ("三鲜水饺(20只)", "主食", "虾仁韭菜鸡蛋", 32.0),
                ("酸菜猪肉水饺(20只)", "主食", "东北特色", 26.0),
                ("拍黄瓜", "凉菜", "爽脆开胃", 8.0),
            ],
            "陶陶居酒家": [
                ("虾饺皇", "点心", "晶莹剔透鲜虾满满", 38.0),
                ("叉烧包", "点心", "蜜汁叉烧流心", 22.0),
                ("白切鸡半只", "大菜", "皮爽肉滑", 58.0),
                ("干炒牛河", "主食", "镬气十足", 32.0),
            ],
            "首尔炸鸡啤酒屋": [
                ("韩式原味炸鸡", "炸鸡", "酥脆外皮鲜嫩鸡肉", 42.0),
                ("甜辣炸鸡", "炸鸡", "韩式甜辣酱裹满", 45.0),
                ("部队锅(2人份)", "火锅", "韩式经典部队锅", 88.0),
                ("石锅拌饭", "主食", "滋滋作响锅巴香", 28.0),
            ],
            "暹罗之味泰餐厅": [
                ("冬阴功汤", "汤品", "酸辣鲜香泰式经典", 38.0),
                ("泰式菠萝炒饭", "主食", "菠萝船装盛酸甜可口", 32.0),
                ("绿咖喱鸡", "大菜", "椰香浓郁微辣", 42.0),
                ("芒果糯米饭", "甜品", "香甜软糯", 22.0),
            ],
            "意面工坊": [
                ("奶油培根意面", "主食", "浓郁奶油酱配脆培根", 38.0),
                ("番茄肉酱意面", "主食", "经典博洛尼亚肉酱", 35.0),
                ("玛格丽特披萨(9寸)", "主食", "手工薄底新鲜罗勒", 48.0),
                ("凯撒沙拉", "沙拉", "罗马生菜配帕玛森", 28.0),
            ],
            "满记甜品": [
                ("芒果班戟", "甜品", "新鲜芒果配奶油皮", 22.0),
                ("杨枝甘露", "甜品", "经典港式甜品", 18.0),
                ("榴莲忘返", "甜品", "猫山王榴莲果肉", 28.0),
                ("芝麻糊", "甜品", "手工现磨浓香", 15.0),
            ],
            "粥全道养生粥铺": [
                ("皮蛋瘦肉粥", "粥品", "绵密鲜香经典款", 16.0),
                ("南瓜小米粥", "粥品", "养胃暖身", 12.0),
                ("鲜虾砂锅粥(2人份)", "粥品", "鲜虾满满砂锅慢熬", 48.0),
                ("油条(2根)", "小食", "酥脆金黄", 4.0),
            ],
            "味多美烘焙工坊": [
                ("提拉米苏蛋糕", "甜品", "意式经典浓香咖啡", 32.0),
                ("牛角包(3个)", "烘焙", "层层酥脆黄油香", 18.0),
                ("全麦吐司", "烘焙", "健康粗粮早餐首选", 15.0),
                ("肉松小贝(4个)", "烘焙", "沙拉酱肉松绝配", 20.0),
            ],
            "沙拉日记轻食": [
                ("凯撒鸡胸肉沙拉", "沙拉", "高蛋白低脂健康餐", 32.0),
                ("藜麦牛油果沙拉", "沙拉", "超级食物组合", 38.0),
                ("烟熏三文鱼沙拉", "沙拉", "北欧风味轻食", 42.0),
                ("鲜榨果蔬汁", "饮品", "每日新鲜现榨", 18.0),
            ],
            "鲜上渔海鲜大排档": [
                ("蒜蓉粉丝蒸扇贝(6只)", "海鲜", "蒜香浓郁粉丝吸汁", 38.0),
                ("香辣蟹(2只)", "海鲜", "秘制香辣酱爆炒", 88.0),
                ("清蒸鲈鱼", "海鲜", "鲜嫩原味清蒸", 58.0),
                ("椒盐皮皮虾", "海鲜", "酥脆咸香连壳吃", 48.0),
            ],
            "新疆大盘鸡之家": [
                ("新疆大盘鸡(中份)", "大菜", "土豆鸡块皮带面", 58.0),
                ("羊肉串(5串)", "烤肉", "孜然飘香肥瘦相间", 25.0),
                ("手抓饭", "主食", "胡萝卜羊肉焖饭", 28.0),
                ("酸奶", "饮品", "新疆手工酸奶", 8.0),
            ],
            "剁椒鱼头王": [
                ("招牌剁椒鱼头", "大菜", "鲜辣入味湘菜灵魂", 68.0),
                ("小炒黄牛肉", "湘菜", "辣椒炒肉鲜嫩爽", 42.0),
                ("长沙臭豆腐", "小食", "外酥里嫩闻着臭吃着香", 18.0),
                ("糖油粑粑", "甜品", "软糯香甜长沙味", 12.0),
            ],
            "东北人家菜馆": [
                ("锅包肉", "大菜", "酸甜酥脆东北名菜", 38.0),
                ("小鸡炖蘑菇", "大菜", "榛蘑炖鸡鲜到眉毛掉", 48.0),
                ("地三鲜", "素菜", "土豆茄子青椒经典", 22.0),
                ("大拉皮", "凉菜", "麻酱拌拉皮爽滑", 15.0),
            ],
            "云南过桥米线": [
                ("过桥米线(大份)", "主食", "鸡汤滚烫配菜丰富", 32.0),
                ("小锅米线", "主食", "一人小锅鲜香", 22.0),
                ("汽锅鸡", "大菜", "云南传统蒸制", 48.0),
                ("鲜花饼(2个)", "甜品", "玫瑰花瓣馅料", 10.0),
            ],
            "清心素食馆": [
                ("罗汉斋", "大菜", "十八种素菜汇聚", 38.0),
                ("素水饺(15只)", "主食", "菌菇蔬菜馅清新", 22.0),
                ("松茸汤", "汤品", "鲜香浓郁养生汤", 28.0),
                ("五谷杂粮饭", "主食", "健康粗粮搭配", 12.0),
            ],
            "绝味鸭脖": [
                ("麻辣鸭脖(中份)", "卤味", "麻辣鲜香越啃越有味", 22.0),
                ("鸭锁骨(中份)", "卤味", "肉多味足过瘾", 18.0),
                ("鸭肠(小份)", "卤味", "脆爽弹牙", 15.0),
                ("毛豆(小份)", "小食", "开胃下酒小菜", 8.0),
            ],
            "烤匠烤鱼": [
                ("麻辣烤鱼(鲈鱼)", "大菜", "先烤后炖麻辣入味", 78.0),
                ("蒜香烤鱼(清江鱼)", "大菜", "蒜香浓郁鲜嫩多汁", 72.0),
                ("烤鱼配菜拼盘", "配菜", "豆腐土豆藕片魔芋", 18.0),
                ("冰粉", "甜品", "解辣解腻", 6.0),
            ],
            "好欢螺螺蛳粉": [
                ("经典原味螺蛳粉", "主食", "酸笋臭香正宗柳州味", 18.0),
                ("加臭加辣螺蛳粉", "主食", "重口味爱好者首选", 20.0),
                ("螺蛳粉加鸭脚", "主食", "炸鸭脚吸满汤汁", 25.0),
                ("豆奶", "饮品", "螺蛳粉标配", 5.0),
            ],
            "秦镇凉皮": [
                ("秘制凉皮(大份)", "主食", "筋道爽滑辣油香", 12.0),
                ("凉皮+肉夹馍套餐", "套餐", "经典搭配超值", 22.0),
                ("擀面皮", "主食", "更有嚼劲的口感", 12.0),
                ("冰峰汽水", "饮品", "西安老字号", 4.0),
            ],
            "老潼关肉夹馍": [
                ("经典腊汁肉夹馍", "主食", "千层饼皮卤肉香", 12.0),
                ("优质肉夹馍(加肉)", "主食", "肉量加倍满足", 18.0),
                ("凉皮", "主食", "爽滑酸辣", 10.0),
                ("粉丝汤", "汤品", "鲜香暖胃", 8.0),
            ],
            "煎饼侠": [
                ("经典煎饼果子", "主食", "薄脆鸡蛋葱花标配", 10.0),
                ("双蛋加肠煎饼果子", "主食", "双倍鸡蛋加火腿肠", 15.0),
                ("加辣条煎饼果子", "主食", "辣条加持童年味", 13.0),
                ("豆浆", "饮品", "现磨浓香豆浆", 5.0),
            ],
        }

        platform_mult = {"meituan": 1.00, "eleme": 0.95, "jd": 1.08, "douyin": 0.90}
        platform_delivery = {"meituan": 3.0, "eleme": 2.5, "jd": 4.0, "douyin": 0.0}

        all_prods = {}
        for s in shops:
            if s.name not in product_defs:
                continue
            all_prods[s.name] = []
            for pname, pcat, pdesc, pbase in product_defs[s.name]:
                p = Product(shop_id=s.id, name=pname, image_url="", category=pcat,
                            description=pdesc, is_available=True,
                            created_at=now(), updated_at=now())
                db.add(p)
                db.flush()
                all_prods[s.name].append((p, pbase))

        for sname, prods in all_prods.items():
            shop_obj = next(s for s in shops if s.name == sname)
            for p, pbase in prods:
                for plat in PLATFORMS:
                    db.add(CrossPlatformProduct(
                        product_id=p.id, platform=plat,
                        platform_product_id=f"{plat}_p{p.id}",
                        platform_shop_id=f"{plat}_s{shop_obj.id}",
                        match_confidence=0.92, created_at=now()))

                    base_price = round(pbase * platform_mult[plat], 2)
                    delivery = platform_delivery[plat]
                    package = round(base_price * 0.03, 2)
                    db.add(PriceSnapshot(
                        product_id=p.id, platform=plat,
                        base_price=base_price, package_fee=package,
                        delivery_fee=delivery,
                        min_order_amount=15.0 if plat != "jd" else 20.0,
                        discount_info=json.dumps(
                            {"满减": f"满{int(base_price * 3)}减{int(base_price * 0.5)}"},
                            ensure_ascii=False),
                        final_price=round(base_price + package + delivery, 2),
                        source="seed", recorded_at=now()))
        db.flush()

        for s in shops:
            for plat in PLATFORMS:
                db.add(DeliveryFeeSnapshot(
                    platform=plat, shop_id=s.id,
                    user_lat=39.98, user_lng=116.45,
                    delivery_fee=platform_delivery[plat] + (hash(s.name) % 3),
                    estimated_time_min=25, estimated_time_max=45,
                    distance_km=1.5 + (hash(s.name) % 10) / 5.0,
                    recorded_at=now()))
        db.flush()

        coupon_defs = [
            ("美团满35减8元红包", CouponType.FULL_REDUCTION, 8.0, 35.0, "meituan", "满35元可用", 7),
            ("美团新用户立减15元", CouponType.NEW_USER, 15.0, 0.0, "meituan", "新用户专享", 15),
            ("美团满50减12元", CouponType.FULL_REDUCTION, 12.0, 50.0, "meituan", "大额满减限量抢", 5),
            ("美团配送费减免券", CouponType.DELIVERY_FREE, 5.0, 20.0, "meituan", "免配送费", 10),
            ("美团平台通用红包3元", CouponType.PLATFORM, 3.0, 0.0, "meituan", "全品类通用", 3),
            ("饿了么满30减7元", CouponType.FULL_REDUCTION, 7.0, 30.0, "eleme", "品质联盟券", 14),
            ("饿了么配送费减免", CouponType.DELIVERY_FREE, 5.0, 25.0, "eleme", "免配送费", 10),
            ("饿了么新用户立减12元", CouponType.NEW_USER, 12.0, 0.0, "eleme", "新用户专享红包", 15),
            ("饿了么满60减15元", CouponType.FULL_REDUCTION, 15.0, 60.0, "eleme", "大额满减周末特惠", 5),
            ("饿了么超级会员红包5元", CouponType.PLATFORM, 5.0, 0.0, "eleme", "超级会员专享", 7),
            ("京东外卖满40减10元", CouponType.FULL_REDUCTION, 10.0, 40.0, "jd", "京东外卖专属", 10),
            ("京东平台通用红包", CouponType.PLATFORM, 6.0, 20.0, "jd", "全品类通用", 20),
            ("京东新用户立减20元", CouponType.NEW_USER, 20.0, 0.0, "jd", "京东外卖新人礼包", 30),
            ("京东满80减18元", CouponType.FULL_REDUCTION, 18.0, 80.0, "jd", "大额满减限量发放", 5),
            ("京东配送费减免", CouponType.DELIVERY_FREE, 4.0, 30.0, "jd", "免配送费优惠", 10),
            ("抖音外卖新人15元券", CouponType.NEW_USER, 15.0, 0.0, "douyin", "抖音新人礼包", 30),
            ("抖音满25减6元", CouponType.FULL_REDUCTION, 6.0, 25.0, "douyin", "天天领红包", 15),
            ("抖音满50减12元", CouponType.FULL_REDUCTION, 12.0, 50.0, "douyin", "午间限时满减", 3),
            ("抖音配送费全免券", CouponType.DELIVERY_FREE, 6.0, 15.0, "douyin", "抖音专享免配送费", 7),
            ("抖音团购通用红包8元", CouponType.PLATFORM, 8.0, 0.0, "douyin", "团购外卖通用", 10),
            ("美团满20减5元下午茶", CouponType.FULL_REDUCTION, 5.0, 20.0, "meituan", "下午茶时段专享", 5),
            ("饿了么夜宵满30减8元", CouponType.FULL_REDUCTION, 8.0, 30.0, "eleme", "22点后夜宵专享", 5),
        ]
        coupons = []
        for title, ctype, value, min_spend, plat, desc, days in coupon_defs:
            c = Coupon(
                title=title, type=ctype, value=value, min_spend=min_spend, platform=plat,
                platform_coupon_id=f"{plat}_coupon_{abs(hash(title)) % 10000}",
                description=desc,
                start_time=now() - datetime.timedelta(days=3),
                expire_time=now() + datetime.timedelta(days=days),
                total_quota=1000, remaining_quota=500 + (abs(hash(title)) % 500),
                is_active=True, claim_url="", claim_method="redirect",
                created_at=now(), updated_at=now())
            db.add(c)
            coupons.append(c)
        db.flush()

        for i, c in enumerate(coupons[:8]):
            uid = u1.id if i % 2 == 0 else u2.id
            db.add(UserCoupon(
                user_id=uid, coupon_id=c.id, claim_status="claimed",
                claim_time=now() - datetime.timedelta(hours=i),
                used=(i < 3), created_at=now()))
        db.flush()

        order_defs = [
            (u1.id, "杨记麻辣烫", "meituan", 36.0, 28.0, 8.0,
             ["招牌麻辣烫(大份)", "酸辣粉"], ["美团满35减8元红包"], 5, "味道不错"),
            (u1.id, "老北京炙子烤肉", "eleme", 80.0, 73.0, 7.0,
             ["招牌烤羊肉", "烤牛肉大份", "烤韭菜"], ["饿了么满30减7元"], 4, ""),
            (u1.id, "快乐柠檬", "meituan", 22.0, 22.0, 0.0,
             ["满杯西柚"], [], 3, ""),
            (u1.id, "叫了个炸鸡", "meituan", 48.0, 40.0, 8.0,
             ["整只炸鸡", "鸡米花"], ["美团满35减8元红包"], 4, "炸鸡很脆"),
            (u1.id, "好欢螺螺蛳粉", "douyin", 25.0, 19.0, 6.0,
             ["螺蛳粉加鸭脚", "豆奶"], ["抖音满25减6元"], 5, "臭香臭香的太上头了"),
            (u1.id, "煎饼侠", "meituan", 20.0, 15.0, 5.0,
             ["双蛋加肠煎饼果子", "豆浆"], ["美团满20减5元下午茶"], 4, ""),
            (u1.id, "绝味鸭脖", "eleme", 40.0, 33.0, 7.0,
             ["麻辣鸭脖(中份)", "鸭锁骨(中份)", "毛豆(小份)"], ["饿了么满30减7元"], 4, ""),
            (u1.id, "秦镇凉皮", "meituan", 22.0, 22.0, 0.0,
             ["凉皮+肉夹馍套餐", "冰峰汽水"], [], 5, "夏天吃凉皮太爽了"),
            (u1.id, "兰州马记拉面", "eleme", 32.0, 25.0, 7.0,
             ["牛肉拉面(大碗)", "凉拌牛肉"], ["饿了么满30减7元"], 4, ""),
            (u2.id, "樱花寿司屋", "eleme", 80.0, 80.0, 0.0,
             ["三文鱼刺身(8片)", "味增汤"], [], 5, "很新鲜"),
            (u2.id, "眉州东坡", "jd", 60.0, 50.0, 10.0,
             ["麻婆豆腐", "回锅肉"], ["京东外卖满40减10元"], 4, ""),
            (u2.id, "陶陶居酒家", "eleme", 92.0, 77.0, 15.0,
             ["虾饺皇", "白切鸡半只", "干炒牛河"], ["饿了么满60减15元"], 5, "虾饺太好吃了"),
            (u2.id, "满记甜品", "meituan", 46.0, 38.0, 8.0,
             ["芒果班戟", "杨枝甘露", "榴莲忘返"], ["美团满35减8元红包"], 5, "甜品很正"),
            (u2.id, "暹罗之味泰餐厅", "jd", 96.0, 78.0, 18.0,
             ["冬阴功汤", "绿咖喱鸡", "芒果糯米饭"], ["京东满80减18元"], 4, ""),
            (u2.id, "鲜上渔海鲜大排档", "eleme", 126.0, 111.0, 15.0,
             ["香辣蟹(2只)", "蒜蓉粉丝蒸扇贝(6只)"], ["饿了么满60减15元"], 5, "螃蟹很新鲜"),
            (u2.id, "意面工坊", "jd", 86.0, 76.0, 10.0,
             ["奶油培根意面", "玛格丽特披萨(9寸)"], ["京东外卖满40减10元"], 4, ""),
        ]
        shop_name_to_obj = {s.name: s for s in shops}
        for uid, sname, plat, amt, actual, saving, items, cps, rating, fb in order_defs:
            shop_obj = shop_name_to_obj.get(sname)
            sid = shop_obj.id if shop_obj else 0
            db.add(OrderHistory(
                user_id=uid, shop_id=sid, shop_name=sname, platform=plat,
                order_amount=amt, actual_amount=actual, savings=saving,
                items=json.dumps(items, ensure_ascii=False),
                coupons_used=json.dumps(cps, ensure_ascii=False),
                user_rating=rating, feedback=fb,
                order_time=now() - datetime.timedelta(days=abs(hash(sname)) % 10),
                created_at=now()))
        db.flush()

        activities = [
            ("meituan", "美团外卖节", "全场满减加倍，最高满100减30", "🎉",
             now(), now() + datetime.timedelta(days=3)),
            ("meituan", "美团下午茶5折起", "每日14:00-17:00下午茶特惠", "☕",
             now(), now() + datetime.timedelta(days=5)),
            ("meituan", "美团夜宵狂欢", "每晚22点后下单享专属优惠", "🌙",
             now(), now() + datetime.timedelta(days=7)),
            ("eleme", "饿了么超级会员日", "会员下单享双倍积分", "👑",
             now(), now() + datetime.timedelta(days=2)),
            ("eleme", "饿了么品质联盟周", "品质商家满减升级最高减20", "⭐",
             now() - datetime.timedelta(days=1), now() + datetime.timedelta(days=6)),
            ("jd", "京东外卖新店特惠", "新入驻店铺全场8折", "🆕",
             now() - datetime.timedelta(days=1), now() + datetime.timedelta(days=5)),
            ("jd", "京东PLUS会员专享", "PLUS会员外卖额外95折", "💎",
             now(), now() + datetime.timedelta(days=10)),
            ("douyin", "抖音团购外卖补贴", "抖音专享外卖最高减20元", "🎁",
             now(), now() + datetime.timedelta(days=7)),
            ("douyin", "抖音直播间专属优惠", "看直播下单额外立减", "📺",
             now(), now() + datetime.timedelta(days=4)),
        ]
        for plat, title, desc, icon, st, et in activities:
            db.add(PlatformActivity(
                platform=plat, title=title, description=desc, icon=icon,
                activity_url=f"https://{plat}.com/activity",
                extra_data={}, start_time=st, end_time=et,
                is_active=True, created_at=now()))
        db.flush()

        fl_sales = [
            ("晚8点限时秒杀", "每天20:00限量抢购", 0.7, ["meituan", "eleme"],
             "麻辣烫;奶茶;炸鸡;卤味",
             now().replace(hour=20, minute=0), now() + datetime.timedelta(days=7)),
            ("午间特惠12点", "工作日午餐特价", 0.65, ["meituan", "jd", "douyin"],
             "川菜;日料;快餐;面馆",
             now().replace(hour=12, minute=0), now() + datetime.timedelta(days=7)),
            ("深夜食堂10点场", "夜宵专属折扣", 0.75, ["eleme", "meituan"],
             "烧烤;炸鸡;螺蛳粉;烤鱼",
             now().replace(hour=22, minute=0), now() + datetime.timedelta(days=7)),
            ("周末早午餐9点场", "周末懒人早午餐特惠", 0.8, ["jd", "douyin", "eleme"],
             "粤菜;粥店;烘焙;甜品",
             now().replace(hour=9, minute=0), now() + datetime.timedelta(days=7)),
            ("下午茶3点场", "下午茶时光限时折扣", 0.7, ["meituan", "douyin"],
             "奶茶;甜品;烘焙;沙拉",
             now().replace(hour=15, minute=0), now() + datetime.timedelta(days=7)),
        ]
        for title, desc, discount, plats, shops_str, st, et in fl_sales:
            db.add(FlashSale(
                title=title, description=desc, discount=discount,
                platforms=json.dumps(plats), applicable_shops=shops_str,
                start_time=st, end_time=et, is_active=True, created_at=now()))
        db.flush()

        behaviors = [
            (u1.id, "click", "shop", 0, "杨记麻辣烫", {"platform": "meituan"}, 1.0),
            (u1.id, "click", "shop", 0, "老北京炙子烤肉", {"platform": "eleme"}, 1.0),
            (u1.id, "compare", "shop", 0, "杨记麻辣烫",
             {"platforms": ["meituan", "eleme"]}, 3.0),
            (u1.id, "view", "product", 0, "招牌麻辣烫(大份)", {"duration": 15}, 0.5),
            (u1.id, "favorite", "shop", 0, "快乐柠檬", {"platform": "meituan"}, 5.0),
            (u1.id, "order", "shop", 0, "杨记麻辣烫", {"amount": 28.0}, 10.0),
            (u1.id, "search", "shop", 0, "麻辣烫",
             {"query": "麻辣烫", "platform": "meituan"}, 2.0),
            (u1.id, "click", "shop", 0, "叫了个炸鸡", {"platform": "meituan"}, 1.0),
            (u1.id, "order", "shop", 0, "老北京炙子烤肉", {"amount": 73.0}, 10.0),
            (u1.id, "view", "shop", 0, "眉州东坡", {"duration": 8}, 0.5),
            (u1.id, "search", "shop", 0, "螺蛳粉",
             {"query": "螺蛳粉", "platform": "douyin"}, 2.0),
            (u1.id, "click", "shop", 0, "好欢螺螺蛳粉", {"platform": "douyin"}, 1.0),
            (u1.id, "compare", "shop", 0, "好欢螺螺蛳粉",
             {"platforms": ["meituan", "douyin"]}, 3.0),
            (u1.id, "order", "shop", 0, "好欢螺螺蛳粉", {"amount": 25.0}, 10.0),
            (u1.id, "view", "shop", 0, "煎饼侠", {"duration": 10}, 0.5),
            (u1.id, "click", "shop", 0, "煎饼侠", {"platform": "meituan"}, 1.0),
            (u1.id, "order", "shop", 0, "煎饼侠", {"amount": 20.0}, 10.0),
            (u1.id, "favorite", "shop", 0, "绝味鸭脖", {"platform": "eleme"}, 5.0),
            (u1.id, "search", "shop", 0, "凉皮",
             {"query": "凉皮", "platform": "meituan"}, 2.0),
            (u1.id, "click", "shop", 0, "秦镇凉皮", {"platform": "meituan"}, 1.0),
            (u1.id, "order", "shop", 0, "绝味鸭脖", {"amount": 40.0}, 10.0),
            (u1.id, "view", "product", 0, "经典原味螺蛳粉", {"duration": 12}, 0.5),
            (u1.id, "search", "shop", 0, "炸鸡",
             {"query": "炸鸡", "platform": "meituan"}, 2.0),
            (u1.id, "compare", "shop", 0, "叫了个炸鸡",
             {"platforms": ["meituan", "eleme", "douyin"]}, 3.0),
            (u1.id, "view", "shop", 0, "兰州马记拉面", {"duration": 6}, 0.5),
            (u2.id, "compare", "shop", 0, "樱花寿司屋",
             {"platforms": ["eleme", "jd"]}, 3.0),
            (u2.id, "order", "shop", 0, "樱花寿司屋", {"amount": 80.0}, 10.0),
            (u2.id, "click", "shop", 0, "快乐柠檬", {"platform": "jd"}, 1.0),
            (u2.id, "order", "shop", 0, "眉州东坡", {"amount": 50.0}, 10.0),
            (u2.id, "favorite", "shop", 0, "眉州东坡", {"platform": "jd"}, 5.0),
            (u2.id, "search", "shop", 0, "粤菜",
             {"query": "粤菜", "platform": "eleme"}, 2.0),
            (u2.id, "click", "shop", 0, "陶陶居酒家", {"platform": "eleme"}, 1.0),
            (u2.id, "compare", "shop", 0, "陶陶居酒家",
             {"platforms": ["eleme", "jd"]}, 3.0),
            (u2.id, "order", "shop", 0, "陶陶居酒家", {"amount": 92.0}, 10.0),
            (u2.id, "view", "shop", 0, "满记甜品", {"duration": 12}, 0.5),
            (u2.id, "favorite", "shop", 0, "满记甜品", {"platform": "meituan"}, 5.0),
            (u2.id, "order", "shop", 0, "满记甜品", {"amount": 46.0}, 10.0),
            (u2.id, "search", "shop", 0, "泰餐",
             {"query": "泰餐", "platform": "jd"}, 2.0),
            (u2.id, "click", "shop", 0, "暹罗之味泰餐厅", {"platform": "jd"}, 1.0),
            (u2.id, "order", "shop", 0, "暹罗之味泰餐厅", {"amount": 96.0}, 10.0),
            (u2.id, "view", "shop", 0, "鲜上渔海鲜大排档", {"duration": 15}, 0.5),
            (u2.id, "compare", "shop", 0, "鲜上渔海鲜大排档",
             {"platforms": ["eleme", "jd"]}, 3.0),
            (u2.id, "search", "shop", 0, "海鲜",
             {"query": "海鲜", "platform": "eleme"}, 2.0),
            (u2.id, "click", "shop", 0, "意面工坊", {"platform": "jd"}, 1.0),
            (u2.id, "order", "shop", 0, "意面工坊", {"amount": 86.0}, 10.0),
            (u2.id, "view", "product", 0, "虾饺皇", {"duration": 10}, 0.5),
            (u2.id, "search", "shop", 0, "甜品",
             {"query": "甜品", "platform": "meituan"}, 2.0),
        ]

        shop_name_to_id = {s.name: s.id for s in shops}
        prod_name_to_id = {}
        for sname, prods in all_prods.items():
            for p, _ in prods:
                prod_name_to_id[p.name] = p.id

        for uid, btype, ttype, tid, tname, ctx, w in behaviors:
            if ttype == "shop" and tname in shop_name_to_id:
                tid = shop_name_to_id[tname]
            elif ttype == "product" and tname in prod_name_to_id:
                tid = prod_name_to_id[tname]
            db.add(UserBehavior(
                user_id=uid, behavior_type=btype, target_type=ttype,
                target_id=tid, target_name=tname, context=ctx, weight=w,
                behavior_time=now() - datetime.timedelta(hours=abs(hash(tname)) % 48)))
        db.flush()

        for uid in [u1.id, u2.id]:
            rec_items = []
            for s in shops[:8]:
                rec_items.append({
                    "shop_id": s.id, "shop_name": s.name, "platform": "meituan",
                    "rank_score": round(0.7 + (abs(hash(s.name)) % 30) / 100.0, 2),
                    "reason": "口味偏好匹配" if s.category in ("麻辣烫", "烧烤", "炸鸡", "奶茶", "螺蛳粉", "煎饼果子", "卤味", "凉皮")
                              else "高评分推荐",
                })
            db.add(RecommendResult(
                user_id=uid, recommend_type="shop",
                items=json.dumps(rec_items, ensure_ascii=False),
                algorithm_version="v1.0", generated_at=now(),
                expires_at=now() + datetime.timedelta(hours=6)))
        db.flush()

        db.commit()

    total_products = sum(len(v) for v in product_defs.values())
    print(r"""
╔══════════════════════════════════════╗
║     🎉 种子数据生成完毕！           ║
╠══════════════════════════════════════╣
║  用户:   2 个                       ║
║  店铺:   30 个                      ║
║  商品:   {:<3d} 个                     ║
║  价格快照: ~{} 条 (4平台)         ║
║  优惠券: 22 张                      ║
║  订单:   16 笔                      ║
║  活动:   9 个                       ║
║  秒杀:   5 场                       ║
║  行为:   47 条                      ║
║  推荐:   2 组                       ║
╠══════════════════════════════════════╣
║  测试账号: testuser / 密码随意      ║
║  API: http://localhost:8000/docs    ║
╚══════════════════════════════════════╝
""".format(total_products, total_products * 4))


if __name__ == "__main__":
    force = "--force" in sys.argv
    if force:
        print("Force mode: clearing existing data...")
        engine = create_engine(settings.database_url_sync, echo=False)
        Base.metadata.drop_all(engine)
        Base.metadata.create_all(engine)
    seed()
