import os
from sqlalchemy import create_engine
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase, sessionmaker
from config import settings

async_engine = create_async_engine(
    settings.database_url,
    echo=settings.debug,
)

async_session = async_sessionmaker(async_engine, class_=AsyncSession, expire_on_commit=False)

sync_url = settings.database_url.replace("+aiosqlite", "")
sync_engine = create_engine(sync_url, echo=settings.debug)
sync_session = sessionmaker(sync_engine, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


async def init_db():
    db_path = settings.database_url.split("///")[-1]
    db_dir = os.path.dirname(db_path)
    if db_dir:
        os.makedirs(db_dir, exist_ok=True)

    async with async_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)


async def get_session():
    async with async_session() as session:
        yield session


def get_sync_session():
    session = sync_session()
    try:
        yield session
    finally:
        session.close()
