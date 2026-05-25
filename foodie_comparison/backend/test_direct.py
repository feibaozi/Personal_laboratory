import asyncio, sys
sys.path.insert(0, '.')

async def main():
    from app.database import _get_async_engine, _get_async_session_local, init_db
    from app.models import User
    from app.services.auth_service import hash_password, verify_password, create_access_token, decode_access_token
    from sqlalchemy import select

    await init_db()
    
    session_local = _get_async_session_local()
    async with session_local() as db:
        # Test password hashing
        h = hash_password("test123")
        print(f"1. Hash: {h[:20]}... verify={verify_password('test123', h)}")
        
        # Test token
        t = create_access_token(1, "testuser")
        d = decode_access_token(t)
        print(f"2. Token: sub={d['sub']}, username={d['username']}")
        
        # Test user creation
        user = User(
            username="localtest",
            hashed_password=h,
            phone=None,
        )
        db.add(user)
        await db.commit()
        await db.refresh(user)
        print(f"3. User created: id={user.id}, username={user.username}")
        
        # Test query
        result = await db.execute(select(User).where(User.username == "localtest"))
        u = result.scalar_one()
        print(f"4. Query: found user id={u.id}")
        
    print("\n=== All direct tests PASSED ===")

asyncio.run(main())