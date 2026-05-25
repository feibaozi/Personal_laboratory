from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, DeclarativeBase

from app.config import settings

_async_engine = None
_sync_engine = None
_AsyncSessionLocal = None
_SyncSessionLocal = None


def _is_sqlite(url: str) -> bool:
    return "sqlite" in url


def _get_async_engine():
    global _async_engine
    if _async_engine is None:
        if _is_sqlite(settings.database_url):
            _async_engine = create_async_engine(
                settings.database_url,
                echo=(settings.log_level == "DEBUG"),
            )
        else:
            _async_engine = create_async_engine(
                settings.database_url,
                echo=(settings.log_level == "DEBUG"),
                pool_size=10,
                max_overflow=20,
            )
    return _async_engine


def _get_sync_engine():
    global _sync_engine
    if _sync_engine is None:
        if _is_sqlite(settings.database_url_sync):
            _sync_engine = create_engine(
                settings.database_url_sync,
                echo=False,
            )
        else:
            _sync_engine = create_engine(
                settings.database_url_sync,
                echo=False,
                pool_size=5,
            )
    return _sync_engine


def _get_async_session_local():
    global _AsyncSessionLocal
    if _AsyncSessionLocal is None:
        _AsyncSessionLocal = async_sessionmaker(
            _get_async_engine(),
            class_=AsyncSession,
            expire_on_commit=False,
        )
    return _AsyncSessionLocal


def _get_sync_session_local():
    global _SyncSessionLocal
    if _SyncSessionLocal is None:
        _SyncSessionLocal = sessionmaker(
            autocommit=False,
            autoflush=False,
            bind=_get_sync_engine(),
        )
    return _SyncSessionLocal


class Base(DeclarativeBase):
    pass


async def get_db():
    session_local = _get_async_session_local()
    async with session_local() as session:
        try:
            yield session
        finally:
            await session.close()


def get_sync_db():
    session_local = _get_sync_session_local()
    db = session_local()
    try:
        yield db
    finally:
        db.close()


async def init_db():
    engine = _get_async_engine()
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)


async def close_db():
    global _async_engine, _sync_engine
    if _async_engine is not None:
        await _async_engine.dispose()
        _async_engine = None
    _sync_engine = None