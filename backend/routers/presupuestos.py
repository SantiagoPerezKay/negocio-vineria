from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update
from sqlalchemy.orm import selectinload
from database import get_db
from models.presupuesto import Presupuesto, PresupuestoDetalle
from models.venta import Venta, VentaDetalle
from models.producto import Producto
from models.cliente import Cliente
from pydantic import BaseModel
from typing import Optional, List
from decimal import Decimal
from datetime import datetime

router = APIRouter(prefix="/api/presupuestos", tags=["presupuestos"])


class PresupuestoDetalleIn(BaseModel):
    producto_id: Optional[int] = None
    descripcion: Optional[str] = None
    cantidad: Decimal = Decimal("1")
    precio_unitario: Decimal
    descuento_porcentaje: Decimal = Decimal("0")


class PresupuestoIn(BaseModel):
    cliente_id: Optional[int] = None
    cliente_nombre: Optional[str] = None
    notas: Optional[str] = None
    descuento_monto: Decimal = Decimal("0")
    fecha_validez: Optional[str] = None
    detalles: List[PresupuestoDetalleIn] = []


@router.get("/")
async def listar_presupuestos(
    estado: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
):
    q = select(Presupuesto).options(selectinload(Presupuesto.detalles), selectinload(Presupuesto.cliente))
    if estado:
        q = q.where(Presupuesto.estado == estado)
    q = q.order_by(Presupuesto.fecha.desc())
    result = await db.execute(q)
    return result.scalars().all()


@router.post("/")
async def crear_presupuesto(data: PresupuestoIn, db: AsyncSession = Depends(get_db)):
    subtotal = sum(d.cantidad * d.precio_unitario * (1 - d.descuento_porcentaje / 100) for d in data.detalles)
    total = subtotal - data.descuento_monto

    pres = Presupuesto(
        cliente_id=data.cliente_id,
        cliente_nombre=data.cliente_nombre,
        notas=data.notas,
        total=total,
        descuento_monto=data.descuento_monto,
        fecha_validez=datetime.fromisoformat(data.fecha_validez) if data.fecha_validez else None,
    )
    db.add(pres)
    await db.flush()

    for d in data.detalles:
        subtotal_item = d.cantidad * d.precio_unitario * (1 - d.descuento_porcentaje / 100)
        detalle = PresupuestoDetalle(
            presupuesto_id=pres.id,
            producto_id=d.producto_id,
            descripcion=d.descripcion,
            cantidad=d.cantidad,
            precio_unitario=d.precio_unitario,
            descuento_porcentaje=d.descuento_porcentaje,
            subtotal=subtotal_item,
        )
        db.add(detalle)

    await db.commit()
    await db.refresh(pres)
    return pres


@router.put("/{presupuesto_id}/estado")
async def actualizar_estado(presupuesto_id: int, estado: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Presupuesto).where(Presupuesto.id == presupuesto_id))
    pres = result.scalar_one_or_none()
    if not pres:
        raise HTTPException(status_code=404, detail="Presupuesto no encontrado")
    pres.estado = estado
    await db.commit()
    return {"ok": True}


@router.post("/{presupuesto_id}/convertir")
async def convertir_a_venta(presupuesto_id: int, caja_id: Optional[int] = None, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Presupuesto).options(selectinload(Presupuesto.detalles)).where(Presupuesto.id == presupuesto_id)
    )
    pres = result.scalar_one_or_none()
    if not pres:
        raise HTTPException(status_code=404, detail="Presupuesto no encontrado")
    if pres.estado == "convertido":
        raise HTTPException(status_code=400, detail="Ya fue convertido a venta")

    venta = Venta(
        total=pres.total,
        efectivo=Decimal("0"),
        transferencia=Decimal("0"),
        tarjeta=Decimal("0"),
        seña=Decimal("0"),
        fiado=Decimal("0"),
        cliente_id=pres.cliente_id,
        caja_id=caja_id,
        notas=f"Convertido desde presupuesto #{pres.id}",
        descuento_monto=pres.descuento_monto,
    )
    db.add(venta)
    await db.flush()

    for d in pres.detalles:
        detalle = VentaDetalle(
            venta_id=venta.id,
            producto_id=d.producto_id,
            descripcion=d.descripcion,
            cantidad=d.cantidad,
            precio_unitario=d.precio_unitario,
            descuento_porcentaje=d.descuento_porcentaje,
            subtotal=d.subtotal,
        )
        db.add(detalle)
        if d.producto_id:
            await db.execute(
                update(Producto).where(Producto.id == d.producto_id)
                .values(stock_actual=Producto.stock_actual - d.cantidad)
            )

    pres.estado = "convertido"
    pres.convertido_a_venta_id = venta.id
    await db.commit()
    await db.refresh(venta)
    return {"ok": True, "venta_id": venta.id}


@router.delete("/{presupuesto_id}")
async def eliminar_presupuesto(presupuesto_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Presupuesto).where(Presupuesto.id == presupuesto_id))
    pres = result.scalar_one_or_none()
    if not pres:
        raise HTTPException(status_code=404, detail="No encontrado")
    await db.delete(pres)
    await db.commit()
    return {"ok": True}
