"""
Seed inicial: categorías y productos de ejemplo para fotocopiadora/kiosco.
Ejecutar una sola vez: python seed.py
"""
import asyncio
from database import AsyncSessionLocal, engine, Base
from models.producto import Categoria, Producto
from models import *  # importa todos los modelos para crear tablas


async def seed():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async with AsyncSessionLocal() as db:
        # Categorías
        categorias_data = [
            ("Fotocopias", "Servicios de copiado e impresión"),
            ("Papelería", "Hojas y materiales de oficina"),
            ("Bebidas", "Gaseosas, aguas, jugos"),
            ("Golosinas", "Alfajores, chicles, caramelos, etc."),
            ("Cafetería", "Café, mate cocido, submarino"),
            ("Varios", "Otros productos"),
        ]
        cats = {}
        for nombre, desc in categorias_data:
            cat = Categoria(nombre=nombre, descripcion=desc)
            db.add(cat)
            await db.flush()
            cats[nombre] = cat.id

        # Productos
        productos_data = [
            # (nombre, categoria, tipo_hoja, precio_venta, precio_costo, stock, stock_min, unidad)
            ("Fotocopia hoja común A4", cats["Fotocopias"], "comun", 50, 10, 500, 100, "hoja"),
            ("Fotocopia hoja autoadhesiva", cats["Fotocopias"], "autoadhesiva", 150, 50, 100, 20, "hoja"),
            ("Fotocopia hoja ilustración", cats["Fotocopias"], "ilustracion", 120, 40, 100, 20, "hoja"),
            ("Fotocopia hoja fotográfica", cats["Fotocopias"], "fotografica", 200, 80, 50, 10, "hoja"),
            ("Resma A4 75g", cats["Papelería"], None, 5500, 4000, 10, 3, "unidad"),
            ("Coca Cola 500ml", cats["Bebidas"], None, 1500, 900, 24, 6, "unidad"),
            ("Agua mineral 500ml", cats["Bebidas"], None, 800, 500, 24, 6, "unidad"),
            ("Alfajor simple", cats["Golosinas"], None, 600, 350, 30, 10, "unidad"),
            ("Café con leche", cats["Cafetería"], None, 1200, 200, 999, 0, "unidad"),
            ("Mate cocido", cats["Cafetería"], None, 1000, 150, 999, 0, "unidad"),
        ]
        for nombre, cat_id, tipo_hoja, precio_venta, precio_costo, stock, stock_min, unidad in productos_data:
            prod = Producto(
                nombre=nombre,
                categoria_id=cat_id,
                tipo_hoja=tipo_hoja,
                precio_venta=precio_venta,
                precio_costo=precio_costo,
                stock_actual=stock,
                stock_minimo=stock_min,
                unidad=unidad,
            )
            db.add(prod)

        await db.commit()
        print("✅ Seed completado: categorías y productos cargados.")


if __name__ == "__main__":
    asyncio.run(seed())
