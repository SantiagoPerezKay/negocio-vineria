import asyncio
from database import engine, Base
# Import all models so metadata knows what tables to drop/create
from models.producto import *
from models.venta import *
from models.caja import *
from models.proveedor import *
from models.cliente import *

async def reset():
    async with engine.begin() as conn:
        print("Borrando todas las tablas de la base de datos remota...")
        await conn.run_sync(Base.metadata.drop_all)
        print("Tablas borradas exitosamente.")
        
        print("Recreando estructuras de tablas...")
        await conn.run_sync(Base.metadata.create_all)
        print("Tablas recreadas exitosamente.")

if __name__ == "__main__":
    asyncio.run(reset())
