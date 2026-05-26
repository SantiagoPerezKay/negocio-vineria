from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, update
from sqlalchemy.orm import selectinload
from database import get_db
from models.venta import Venta, VentaDetalle
from models.caja import CajaApertura, GastoCaja
from models.cliente import Cliente
from models.producto import Producto
from pydantic import BaseModel
from typing import Optional, List
from decimal import Decimal
from datetime import datetime

router = APIRouter(prefix="/api/ventas", tags=["ventas"])


# ── Schemas ──────────────────────────────────────────────────────────────────

class DetalleIn(BaseModel):
    producto_id: Optional[int] = None
    descripcion: Optional[str] = None
    cantidad: Decimal = Decimal("1")
    precio_unitario: Decimal


class VentaIn(BaseModel):
    detalle_libre: Optional[str] = None
    efectivo: Decimal = Decimal("0")
    transferencia: Decimal = Decimal("0")
    tarjeta: Decimal = Decimal("0")
    seña: Decimal = Decimal("0")
    fiado: Decimal = Decimal("0")
    cliente_id: Optional[int] = None
    caja_id: Optional[int] = None
    notas: Optional[str] = None
    detalles: List[DetalleIn] = []


class GastoIn(BaseModel):
    descripcion: str
    monto: Decimal
    caja_id: Optional[int] = None


# ── Endpoints ────────────────────────────────────────────────────────────────

@router.get("/")
async def listar_ventas(
    fecha_desde: Optional[str] = None,
    fecha_hasta: Optional[str] = None,
    caja_id: Optional[int] = None,
    db: AsyncSession = Depends(get_db),
):
    q = select(Venta).options(selectinload(Venta.detalles), selectinload(Venta.cliente))
    if fecha_desde:
        q = q.where(Venta.fecha >= fecha_desde)
    if fecha_hasta:
        q = q.where(Venta.fecha <= fecha_hasta)
    if caja_id:
        q = q.where(Venta.caja_id == caja_id)
    q = q.order_by(Venta.fecha.desc())
    result = await db.execute(q)
    ventas = result.scalars().all()
    return ventas


@router.post("/")
async def crear_venta(data: VentaIn, db: AsyncSession = Depends(get_db)):
    total = data.efectivo + data.transferencia + data.tarjeta + data.seña + data.fiado

    # Calcular total desde detalles si existen
    if data.detalles:
        total_detalles = sum(d.cantidad * d.precio_unitario for d in data.detalles)
        if total == 0:
            total = total_detalles

    venta = Venta(
        total=total,
        efectivo=data.efectivo,
        transferencia=data.transferencia,
        tarjeta=data.tarjeta,
        seña=data.seña,
        fiado=data.fiado,
        cliente_id=data.cliente_id,
        caja_id=data.caja_id,
        detalle_libre=data.detalle_libre,
        notas=data.notas,
    )
    db.add(venta)
    await db.flush()

    for d in data.detalles:
        subtotal = d.cantidad * d.precio_unitario
        detalle = VentaDetalle(
            venta_id=venta.id,
            producto_id=d.producto_id,
            descripcion=d.descripcion,
            cantidad=d.cantidad,
            precio_unitario=d.precio_unitario,
            subtotal=subtotal,
        )
        db.add(detalle)

        # Descontar stock
        if d.producto_id:
            await db.execute(
                update(Producto)
                .where(Producto.id == d.producto_id)
                .values(stock_actual=Producto.stock_actual - d.cantidad)
            )

    # Actualizar deuda del cliente si hay fiado
    if data.fiado > 0 and data.cliente_id:
        await db.execute(
            update(Cliente)
            .where(Cliente.id == data.cliente_id)
            .values(deuda_total=Cliente.deuda_total + data.fiado)
        )

    await db.commit()
    await db.refresh(venta)
    return venta


@router.delete("/{venta_id}")
async def anular_venta(venta_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Venta).options(selectinload(Venta.detalles)).where(Venta.id == venta_id)
    )
    venta = result.scalar_one_or_none()
    if not venta:
        raise HTTPException(status_code=404, detail="Venta no encontrada")
    if venta.anulada:
        raise HTTPException(status_code=400, detail="Venta ya anulada")

    venta.anulada = True

    # Revertir stock
    for d in venta.detalles:
        if d.producto_id:
            await db.execute(
                update(Producto)
                .where(Producto.id == d.producto_id)
                .values(stock_actual=Producto.stock_actual + d.cantidad)
            )

    # Revertir deuda cliente
    if venta.fiado > 0 and venta.cliente_id:
        await db.execute(
            update(Cliente)
            .where(Cliente.id == venta.cliente_id)
            .values(deuda_total=Cliente.deuda_total - venta.fiado)
        )

    await db.commit()
    return {"ok": True}


# ── Gastos ────────────────────────────────────────────────────────────────────

@router.post("/gastos")
async def registrar_gasto(data: GastoIn, db: AsyncSession = Depends(get_db)):
    gasto = GastoCaja(descripcion=data.descripcion, monto=data.monto, caja_id=data.caja_id)
    db.add(gasto)
    await db.commit()
    await db.refresh(gasto)
    return gasto


@router.get("/gastos")
async def listar_gastos(caja_id: Optional[int] = None, db: AsyncSession = Depends(get_db)):
    q = select(GastoCaja)
    if caja_id:
        q = q.where(GastoCaja.caja_id == caja_id)
    result = await db.execute(q.order_by(GastoCaja.fecha.desc()))
    return result.scalars().all()


@router.delete("/gastos/{gasto_id}")
async def eliminar_gasto(gasto_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(GastoCaja).where(GastoCaja.id == gasto_id))
    gasto = result.scalar_one_or_none()
    if not gasto:
        raise HTTPException(status_code=404, detail="Gasto no encontrado")
    await db.delete(gasto)
    await db.commit()
    return {"ok": True}
