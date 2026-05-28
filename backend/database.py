from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase
from sqlalchemy import text
import os
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql+asyncpg://postgres:vineria123@localhost:5432/vineria")

engine = create_async_engine(DATABASE_URL, echo=False)
AsyncSessionLocal = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


async def get_db():
    async with AsyncSessionLocal() as session:
        yield session


async def create_tables():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        # Idempotent migrations for new columns
        migrations = [
            "ALTER TABLE productos ADD COLUMN IF NOT EXISTS imagen_url VARCHAR(500)",
            "ALTER TABLE productos ADD COLUMN IF NOT EXISTS nota_sabor VARCHAR(500)",
            "ALTER TABLE productos ADD COLUMN IF NOT EXISTS maridaje VARCHAR(500)",
            "ALTER TABLE productos ADD COLUMN IF NOT EXISTS ocasion VARCHAR(500)",
        ]
        for sql in migrations:
            try:
                await conn.execute(text(sql))
            except Exception:
                pass
