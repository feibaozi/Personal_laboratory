from celery import Celery
from celery.schedules import crontab
from app.config import settings

celery_app = Celery(
    "foodie_comparison",
    broker=settings.redis_url,
    backend=settings.redis_url,
    include=[
        "app.tasks.price_sync",
        "app.tasks.coupon_sync",
        "app.tasks.platform_sync",
        "app.tasks.recommend_rebuild",
        "app.tasks.cleanup",
    ],
)

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="Asia/Shanghai",
    enable_utc=True,
    beat_schedule={
        "sync-prices": {
            "task": "app.tasks.price_sync.sync_all_prices",
            "schedule": crontab(minute="*/120"),
        },
        "sync-coupons": {
            "task": "app.tasks.coupon_sync.sync_all_coupons",
            "schedule": crontab(minute="0", hour="*/1"),
        },
        "sync-platforms": {
            "task": "app.tasks.platform_sync.sync_platform_activities",
            "schedule": crontab(hour="8", minute="0"),
        },
        "rebuild-recommend": {
            "task": "app.tasks.recommend_rebuild.rebuild_recommendations",
            "schedule": crontab(hour="2", minute="0"),
        },
        "cleanup-old-data": {
            "task": "app.tasks.cleanup.cleanup_old_data",
            "schedule": crontab(hour="3", minute="0", day_of_week="0"),
        },
    },
)