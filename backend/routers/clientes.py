from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update
from sqlalchemy.orm import selectinload
from database import get_db
from models.cliente import Cliente, Pago
from pydantic import BaseModel
from typing import Optional
from decimal import Decimal

router = APIRouter(prefix="/api/clientes", tags=["clientes"])


class ClienteIn(BaseModel):
    nombre: str
    telefono: Optional[str] = None
    email: Optional[str] = None
    notas: Optional[str] = None


class PagoIn(BaseModel):
    monto: Decimal
    metodo: str = "efectivo"
    notas: Optional[str] = None


@router.get("/")
async def listar_clientes(con_deuda: Optional[bool] = None, db: AsyncSession = Depends(get_db)):
    q = select(Cliente).order_by(Cliente.nombre)
    if con_deuda:
        q = q.where(Cliente.deuda_total > 0)
    result = await db.execute(q)
    return result.scalars().all()


@router.post("/")
async def crear_cliente(data: ClienteIn, db: AsyncSession = Depends(get_db)):
    cliente = Cliente(**data.model_dump())
    db.add(cliente)
    await db.commit()
    await db.refresh(cliente)
    return cliente


@router.get("/{cliente_id}")
async def obtener_cliente(cliente_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Cliente)
        .options(selectinload(Cliente.pagos), selectinload(Cliente.ventas))
        .where(Cliente.id == cliente_id)
    )
    c = result.scalar_one_or_none()
    if not c:
        raise HTTPException(status_code=404, detail="Cliente no encontrado")
    return c


@router.put("/{cliente_id}")
async def actualizar_cliente(cliente_id: int, data: ClienteIn, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Cliente).where(Cliente.id == cliente_id))
    c = result.scalar_one_or_none()
    if not c:
        raise HTTPException(status_code=404, detail="Cliente no encontrado")
    for k, v in data.model_dump().items():
        setattr(c, k, v)
    await db.commit()
    await db.refresh(c)
    return c


@router.post("/{cliente_id}/pagos")
async def registrar_pago(cliente_id: int, data: PagoIn, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Cliente).where(Cliente.id == cliente_id))
    c = result.scalar_one_or_none()
    if not c:
        raise HTTPException(status_code=404, detail="Cliente no encontrado")

    pago = Pago(cliente_id=cliente_id, **data.model_dump())
    db.add(pago)

    # Reducir deuda
    nueva_deuda = max(Decimal("0"), c.deuda_total - data.monto)
    c.deuda_total = nueva_deuda

    await db.commit()
    await db.refresh(pago)
    return {"pago": pago, "deuda_restante": float(nueva_deuda)}


@router.delete("/{cliente_id}")
async def eliminar_cliente(cliente_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Cliente).where(Cliente.id == cliente_id))
    c = result.scalar_one_or_none()
    if not c:
        raise HTTPException(status_code=404, detail="Cliente no encontrado")
    if c.deuda_total > 0:
        raise HTTPException(status_code=400, detail="No se puede eliminar un cliente con deuda pendiente")
    await db.delete(c)
    await db.commit()
    return {"ok": True}


@router.get("/{cliente_id}/pagos")
async def historial_pagos(cliente_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Pago).where(Pago.cliente_id == cliente_id).order_by(Pago.fecha.desc())
    )
    return result.scalars().all()
