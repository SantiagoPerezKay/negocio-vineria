from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from database import get_db
from models.promo import Promo, PromoProducto
from models.producto import Producto
from pydantic import BaseModel
from typing import Optional, List
from decimal import Decimal

router = APIRouter(prefix="/api/promos", tags=["promos"])


class PromoProductoIn(BaseModel):
    producto_id: int
    cantidad: Decimal = Decimal("1")


class PromoIn(BaseModel):
    nombre: str
    descripcion: Optional[str] = None
    precio_promo: Decimal
    imagen_url: Optional[str] = None
    productos: List[PromoProductoIn] = []


@router.get("/")
async def listar_promos(activo: Optional[bool] = None, db: AsyncSession = Depends(get_db)):
    q = select(Promo).options(
        selectinload(Promo.productos).selectinload(PromoProducto.producto)
    )
    if activo is not None:
        q = q.where(Promo.activo == activo)
    q = q.order_by(Promo.nombre)
    result = await db.execute(q)
    return result.scalars().all()


@router.post("/")
async def crear_promo(data: PromoIn, db: AsyncSession = Depends(get_db)):
    if not data.productos:
        raise HTTPException(status_code=400, detail="La promo debe tener al menos un producto")

    promo = Promo(
        nombre=data.nombre,
        descripcion=data.descripcion,
        precio_promo=data.precio_promo,
        imagen_url=data.imagen_url,
    )
    db.add(promo)
    await db.flush()

    for p in data.productos:
        # Verificar que el producto existe
        result = await db.execute(select(Producto).where(Producto.id == p.producto_id))
        if not result.scalar_one_or_none():
            raise HTTPException(status_code=404, detail=f"Producto #{p.producto_id} no encontrado")
        pp = PromoProducto(promo_id=promo.id, producto_id=p.producto_id, cantidad=p.cantidad)
        db.add(pp)

    await db.commit()

    # Reload with relationships
    result = await db.execute(
        select(Promo).options(
            selectinload(Promo.productos).selectinload(PromoProducto.producto)
        ).where(Promo.id == promo.id)
    )
    return result.scalar_one()


@router.put("/{promo_id}")
async def actualizar_promo(promo_id: int, data: PromoIn, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Promo).options(selectinload(Promo.productos)).where(Promo.id == promo_id)
    )
    promo = result.scalar_one_or_none()
    if not promo:
        raise HTTPException(status_code=404, detail="Promo no encontrada")

    promo.nombre = data.nombre
    promo.descripcion = data.descripcion
    promo.precio_promo = data.precio_promo
    promo.imagen_url = data.imagen_url

    # Remove old products and add new ones
    for pp in promo.productos:
        await db.delete(pp)

    for p in data.productos:
        pp = PromoProducto(promo_id=promo.id, producto_id=p.producto_id, cantidad=p.cantidad)
        db.add(pp)

    await db.commit()

    result = await db.execute(
        select(Promo).options(
            selectinload(Promo.productos).selectinload(PromoProducto.producto)
        ).where(Promo.id == promo.id)
    )
    return result.scalar_one()


@router.delete("/{promo_id}")
async def desactivar_promo(promo_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Promo).where(Promo.id == promo_id))
    promo = result.scalar_one_or_none()
    if not promo:
        raise HTTPException(status_code=404, detail="Promo no encontrada")
    promo.activo = False
    await db.commit()
    return {"ok": True}


@router.get("/{promo_id}")
async def obtener_promo(promo_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Promo).options(
            selectinload(Promo.productos).selectinload(PromoProducto.producto)
        ).where(Promo.id == promo_id)
    )
    promo = result.scalar_one_or_none()
    if not promo:
        raise HTTPException(status_code=404, detail="Promo no encontrada")
    return promo
