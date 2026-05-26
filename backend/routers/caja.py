from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from database import get_db
from models.caja import CajaApertura, GastoCaja
from models.venta import Venta
from pydantic import BaseModel
from typing import Optional
from decimal import Decimal
from datetime import datetime

router = APIRouter(prefix="/api/caja", tags=["caja"])


class AperturaIn(BaseModel):
    monto_inicial: Decimal = Decimal("0")
    notas: Optional[str] = None


class CierreIn(BaseModel):
    monto_cierre_real: Decimal
    notas: Optional[str] = None


@router.get("/actual")
async def caja_actual(db: AsyncSession = Depends(get_db)):
    """Devuelve la caja abierta del día, o None."""
    result = await db.execute(
        select(CajaApertura)
        .where(CajaApertura.cerrada == False)
        .order_by(CajaApertura.fecha_apertura.desc())
        .limit(1)
    )
    caja = result.scalar_one_or_none()
    return caja


@router.post("/abrir")
async def abrir_caja(data: AperturaIn, db: AsyncSession = Depends(get_db)):
    # Verificar que no haya caja abierta
    result = await db.execute(
        select(CajaApertura).where(CajaApertura.cerrada == False).limit(1)
    )
    if result.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Ya hay una caja abierta")

    caja = CajaApertura(monto_inicial=data.monto_inicial, notas=data.notas)
    db.add(caja)
    await db.commit()
    await db.refresh(caja)
    return caja


@router.post("/{caja_id}/cerrar")
async def cerrar_caja(caja_id: int, data: CierreIn, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(CajaApertura).where(CajaApertura.id == caja_id))
    caja = result.scalar_one_or_none()
    if not caja:
        raise HTTPException(status_code=404, detail="Caja no encontrada")
    if caja.cerrada:
        raise HTTPException(status_code=400, detail="La caja ya está cerrada")

    # Calcular totales desde ventas
    totales = await db.execute(
        select(
            func.coalesce(func.sum(Venta.efectivo), 0).label("efectivo"),
            func.coalesce(func.sum(Venta.transferencia), 0).label("transferencia"),
            func.coalesce(func.sum(Venta.tarjeta), 0).label("tarjeta"),
            func.coalesce(func.sum(Venta.seña), 0).label("seña"),
            func.coalesce(func.sum(Venta.fiado), 0).label("fiado"),
        ).where(Venta.caja_id == caja_id, Venta.anulada == False)
    )
    row = totales.one()

    # Gastos de la caja
    gastos_result = await db.execute(
        select(func.coalesce(func.sum(GastoCaja.monto), 0)).where(GastoCaja.caja_id == caja_id)
    )
    total_gastos = gastos_result.scalar()

    sistema = caja.monto_inicial + row.efectivo - total_gastos

    caja.fecha_cierre = datetime.now()
    caja.monto_cierre_real = data.monto_cierre_real
    caja.monto_cierre_sistema = sistema
    caja.total_efectivo = row.efectivo
    caja.total_transferencia = row.transferencia
    caja.total_tarjeta = row.tarjeta
    caja.total_fiado = row.fiado
    caja.total_gastos = total_gastos
    caja.cerrada = True
    if data.notas:
        caja.notas = data.notas

    await db.commit()
    await db.refresh(caja)
    return caja


@router.get("/historial")
async def historial_cajas(limit: int = 30, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(CajaApertura).order_by(CajaApertura.fecha_apertura.desc()).limit(limit)
    )
    return result.scalars().all()


@router.get("/{caja_id}/resumen")
async def resumen_caja(caja_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(CajaApertura).where(CajaApertura.id == caja_id))
    caja = result.scalar_one_or_none()
    if not caja:
        raise HTTPException(status_code=404, detail="Caja no encontrada")

    ventas_result = await db.execute(
        select(
            func.count(Venta.id).label("cantidad"),
            func.coalesce(func.sum(Venta.total), 0).label("total"),
            func.coalesce(func.sum(Venta.efectivo), 0).label("efectivo"),
            func.coalesce(func.sum(Venta.transferencia), 0).label("transferencia"),
            func.coalesce(func.sum(Venta.tarjeta), 0).label("tarjeta"),
            func.coalesce(func.sum(Venta.seña), 0).label("seña"),
            func.coalesce(func.sum(Venta.fiado), 0).label("fiado"),
        ).where(Venta.caja_id == caja_id, Venta.anulada == False)
    )
    v = ventas_result.one()

    gastos_result = await db.execute(
        select(func.coalesce(func.sum(GastoCaja.monto), 0)).where(GastoCaja.caja_id == caja_id)
    )
    total_gastos = gastos_result.scalar()

    return {
        "caja": caja,
        "ventas": {
            "cantidad": v.cantidad,
            "total": float(v.total),
            "efectivo": float(v.efectivo),
            "transferencia": float(v.transferencia),
            "tarjeta": float(v.tarjeta),
            "fiado": float(v.fiado),
        },
        "gastos": float(total_gastos),
        "balance_efectivo": float(caja.monto_inicial + v.efectivo - total_gastos),
    }
