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
        # Add new columns to existing tables (idempotent)
        migrations = [
            "ALTER TABLE ventas ADD COLUMN IF NOT EXISTS descuento_monto NUMERIC(12,2) NOT NULL DEFAULT 0",
            "ALTER TABLE venta_detalles ADD COLUMN IF NOT EXISTS descuento_porcentaje NUMERIC(5,2) NOT NULL DEFAULT 0",
            "ALTER TABLE productos ADD COLUMN IF NOT EXISTS fecha_vencimiento DATE",
            "ALTER TABLE gastos_caja ADD COLUMN IF NOT EXISTS categoria VARCHAR(100)",
            "ALTER TABLE productos ADD COLUMN IF NOT EXISTS tipo_vino VARCHAR(50)",
        ]
        for sql in migrations:
            try:
                await conn.execute(text(sql))
            except Exception:
                pass  # column already exists or other harmless error
