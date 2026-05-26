from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update
from sqlalchemy.orm import selectinload
from database import get_db
from models.devolucion import Devolucion, DevolucionDetalle
from models.venta import Venta, VentaDetalle
from models.producto import Producto
from pydantic import BaseModel
from typing import Optional, List
from decimal import Decimal

router = APIRouter(prefix="/api/devoluciones", tags=["devoluciones"])


class DevolucionDetalleIn(BaseModel):
    venta_detalle_id: Optional[int] = None
    producto_id: Optional[int] = None
    descripcion: Optional[str] = None
    cantidad: Decimal
    precio_unitario: Decimal


class DevolucionIn(BaseModel):
    venta_id: int
    motivo: Optional[str] = None
    metodo_devolucion: str = "efectivo"
    detalles: List[DevolucionDetalleIn]


@router.get("/")
async def listar_devoluciones(db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Devolucion).options(selectinload(Devolucion.detalles), selectinload(Devolucion.venta))
        .order_by(Devolucion.fecha.desc())
    )
    return result.scalars().all()


@router.post("/")
async def registrar_devolucion(data: DevolucionIn, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Venta).where(Venta.id == data.venta_id))
    venta = result.scalar_one_or_none()
    if not venta:
        raise HTTPException(status_code=404, detail="Venta no encontrada")

    monto_total = sum(d.cantidad * d.precio_unitario for d in data.detalles)

    dev = Devolucion(
        venta_id=data.venta_id,
        motivo=data.motivo,
        monto_devuelto=monto_total,
        metodo_devolucion=data.metodo_devolucion,
    )
    db.add(dev)
    await db.flush()

    for d in data.detalles:
        subtotal = d.cantidad * d.precio_unitario
        detalle = DevolucionDetalle(
            devolucion_id=dev.id,
            venta_detalle_id=d.venta_detalle_id,
            producto_id=d.producto_id,
            descripcion=d.descripcion,
            cantidad=d.cantidad,
            precio_unitario=d.precio_unitario,
            subtotal=subtotal,
        )
        db.add(detalle)
        # Restock
        if d.producto_id:
            await db.execute(
                update(Producto).where(Producto.id == d.producto_id)
                .values(stock_actual=Producto.stock_actual + d.cantidad)
            )

    await db.commit()
    await db.refresh(dev)
    return dev


@router.get("/{devolucion_id}")
async def obtener_devolucion(devolucion_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Devolucion).options(selectinload(Devolucion.detalles)).where(Devolucion.id == devolucion_id)
    )
    dev = result.scalar_one_or_none()
    if not dev:
        raise HTTPException(status_code=404, detail="No encontrada")
    return dev
