from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update, func
from sqlalchemy.orm import selectinload
from database import get_db
from models.producto import Producto, Categoria
from pydantic import BaseModel
from typing import Optional, List
from decimal import Decimal
from datetime import date

router = APIRouter(prefix="/api/stock", tags=["stock"])


# ── Schemas ──────────────────────────────────────────────────────────────────

class CategoriaIn(BaseModel):
    nombre: str
    descripcion: Optional[str] = None


class ProductoIn(BaseModel):
    nombre: str
    codigo: Optional[str] = None
    categoria_id: Optional[int] = None
    tipo_vino: Optional[str] = None
    precio_venta: Decimal
    precio_costo: Optional[Decimal] = None
    stock_actual: Decimal = Decimal("0")
    stock_minimo: Decimal = Decimal("0")
    unidad: str = "botella"
    fecha_vencimiento: Optional[date] = None


class AjusteStock(BaseModel):
    cantidad: Decimal
    motivo: Optional[str] = None


# ── Categorías ────────────────────────────────────────────────────────────────

@router.get("/categorias")
async def listar_categorias(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Categoria).order_by(Categoria.nombre))
    return result.scalars().all()


@router.post("/categorias")
async def crear_categoria(data: CategoriaIn, db: AsyncSession = Depends(get_db)):
    cat = Categoria(**data.model_dump())
    db.add(cat)
    await db.commit()
    await db.refresh(cat)
    return cat


# ── Productos ────────────────────────────────────────────────────────────────

@router.get("/productos")
async def listar_productos(
    categoria_id: Optional[int] = None,
    bajo_stock: Optional[bool] = None,
    activo: Optional[bool] = True,
    db: AsyncSession = Depends(get_db),
):
    q = select(Producto).options(selectinload(Producto.categoria))
    if categoria_id:
        q = q.where(Producto.categoria_id == categoria_id)
    if activo is not None:
        q = q.where(Producto.activo == activo)
    if bajo_stock:
        q = q.where(Producto.stock_actual <= Producto.stock_minimo)
    result = await db.execute(q.order_by(Producto.nombre))
    return result.scalars().all()


@router.post("/productos")
async def crear_producto(data: ProductoIn, db: AsyncSession = Depends(get_db)):
    prod = Producto(**data.model_dump())
    db.add(prod)
    await db.commit()
    await db.refresh(prod)
    return prod


@router.get("/productos/sku/{sku}")
async def obtener_producto_por_sku(sku: str, db: AsyncSession = Depends(get_db)):
    """Busca un producto por SKU/código exacto. Útil para lectores de código de barras."""
    result = await db.execute(
        select(Producto).options(selectinload(Producto.categoria))
        .where(Producto.codigo == sku, Producto.activo == True)
    )
    prod = result.scalar_one_or_none()
    if not prod:
        raise HTTPException(status_code=404, detail="Producto no encontrado para ese SKU")
    return prod


@router.get("/productos/{producto_id}")
async def obtener_producto(producto_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Producto).options(selectinload(Producto.categoria)).where(Producto.id == producto_id)
    )
    prod = result.scalar_one_or_none()
    if not prod:
        raise HTTPException(status_code=404, detail="Producto no encontrado")
    return prod


@router.put("/productos/{producto_id}")
async def actualizar_producto(producto_id: int, data: ProductoIn, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Producto).where(Producto.id == producto_id))
    prod = result.scalar_one_or_none()
    if not prod:
        raise HTTPException(status_code=404, detail="Producto no encontrado")
    for k, v in data.model_dump().items():
        setattr(prod, k, v)
    await db.commit()
    await db.refresh(prod)
    return prod


@router.delete("/productos/{producto_id}")
async def eliminar_producto(producto_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Producto).where(Producto.id == producto_id))
    prod = result.scalar_one_or_none()
    if not prod:
        raise HTTPException(status_code=404, detail="Producto no encontrado")
    prod.activo = False
    await db.commit()
    return {"ok": True}


@router.delete("/categorias/{categoria_id}")
async def eliminar_categoria(categoria_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Categoria).where(Categoria.id == categoria_id))
    cat = result.scalar_one_or_none()
    if not cat:
        raise HTTPException(status_code=404, detail="Categoría no encontrada")
    # Verificar que no tenga productos activos
    prods = await db.execute(
        select(func.count(Producto.id)).where(Producto.categoria_id == categoria_id, Producto.activo == True)
    )
    if prods.scalar() > 0:
        raise HTTPException(status_code=400, detail="No se puede eliminar una categoría con productos activos")
    await db.delete(cat)
    await db.commit()
    return {"ok": True}


@router.patch("/productos/{producto_id}/ajuste")
async def ajustar_stock(producto_id: int, data: AjusteStock, db: AsyncSession = Depends(get_db)):
    """Ajuste manual de stock (positivo = entrada, negativo = salida)."""
    result = await db.execute(select(Producto).where(Producto.id == producto_id))
    prod = result.scalar_one_or_none()
    if not prod:
        raise HTTPException(status_code=404, detail="Producto no encontrado")
    prod.stock_actual = prod.stock_actual + data.cantidad
    await db.commit()
    await db.refresh(prod)
    return prod


@router.get("/alertas")
async def alertas_stock(db: AsyncSession = Depends(get_db)):
    """Productos con stock_actual <= stock_minimo."""
    result = await db.execute(
        select(Producto)
        .options(selectinload(Producto.categoria))
        .where(Producto.stock_actual <= Producto.stock_minimo, Producto.activo == True)
        .order_by(Producto.stock_actual)
    )
    return result.scalars().all()
