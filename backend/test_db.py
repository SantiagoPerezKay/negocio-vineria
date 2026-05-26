import asyncio
import asyncpg

async def test():
    try:
        conn = await asyncpg.connect('postgresql://postgres:negocio1234@panel.automatizacionesspk.com:5437/negocio')
        print('Conexion exitosa')
        await conn.close()
    except Exception as e:
        print(f"Error de conexion: {e}")

asyncio.run(test())
