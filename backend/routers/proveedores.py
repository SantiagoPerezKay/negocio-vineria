from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update
from sqlalchemy.orm import selectinload
from database import get_db
from models.proveedor import Proveedor, Compra, CompraDetalle
from models.producto import Producto
from pydantic import BaseModel
from typing import Optional, List
from decimal import Decimal

router = APIRouter(prefix="/api/proveedores", tags=["proveedores"])


class ProveedorIn(BaseModel):
    nombre: str
    contacto: Optional[str] = None
    telefono: Optional[str] = None
    email: Optional[str] = None
    notas: Optional[str] = None


class CompraDetalleIn(BaseModel):
    producto_id: Optional[int] = None
    descripcion: Optional[str] = None
    cantidad: Decimal
    precio_costo: Decimal


class CompraIn(BaseModel):
    proveedor_id: int
    pagado: Decimal = Decimal("0")
    notas: Optional[str] = None
    detalles: List[CompraDetalleIn] = []


@router.get("/")
async def listar_proveedores(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Proveedor).order_by(Proveedor.nombre))
    return result.scalars().all()


@router.post("/")
async def crear_proveedor(data: ProveedorIn, db: AsyncSession = Depends(get_db)):
    prov = Proveedor(**data.model_dump())
    db.add(prov)
    await db.commit()
    await db.refresh(prov)
    return prov


@router.put("/{proveedor_id}")
async def actualizar_proveedor(proveedor_id: int, data: ProveedorIn, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Proveedor).where(Proveedor.id == proveedor_id))
    p = result.scalar_one_or_none()
    if not p:
        raise HTTPException(status_code=404, detail="Proveedor no encontrado")
    for k, v in data.model_dump().items():
        setattr(p, k, v)
    await db.commit()
    await db.refresh(p)
    return p


@router.delete("/{proveedor_id}")
async def eliminar_proveedor(proveedor_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Proveedor).where(Proveedor.id == proveedor_id))
    p = result.scalar_one_or_none()
    if not p:
        raise HTTPException(status_code=404, detail="Proveedor no encontrado")
    await db.delete(p)
    await db.commit()
    return {"ok": True}


class PagoProveedorIn(BaseModel):
    monto: Decimal
    notas: Optional[str] = None


@router.post("/{proveedor_id}/pago")
async def pagar_proveedor(proveedor_id: int, data: PagoProveedorIn, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Proveedor).where(Proveedor.id == proveedor_id))
    prov = result.scalar_one_or_none()
    if not prov:
        raise HTTPException(status_code=404, detail="Proveedor no encontrado")

    # Subtract from proveedor debt
    nueva_deuda = max(Decimal("0"), prov.deuda_total - data.monto)
    prov.deuda_total = nueva_deuda

    # Apply payment to oldest compras with saldo > 0
    compras_result = await db.execute(
        select(Compra)
        .where(Compra.proveedor_id == proveedor_id, Compra.saldo > 0)
        .order_by(Compra.fecha.asc())
    )
    compras_pendientes = compras_result.scalars().all()

    restante = data.monto
    for compra in compras_pendientes:
        if restante <= 0:
            break
        aplicar = min(restante, compra.saldo)
        compra.pagado = compra.pagado + aplicar
        compra.saldo = compra.saldo - aplicar
        restante -= aplicar

    await db.commit()
    await db.refresh(prov)
    return {"ok": True, "deuda_restante": float(prov.deuda_total)}


@router.post("/compras")
async def registrar_compra(data: CompraIn, db: AsyncSession = Depends(get_db)):
    total = sum(d.cantidad * d.precio_costo for d in data.detalles)
    saldo = total - data.pagado

    compra = Compra(
        proveedor_id=data.proveedor_id,
        total=total,
        pagado=data.pagado,
        saldo=saldo,
        notas=data.notas,
    )
    db.add(compra)
    await db.flush()

    for d in data.detalles:
        subtotal = d.cantidad * d.precio_costo
        detalle = CompraDetalle(
            compra_id=compra.id,
            producto_id=d.producto_id,
            descripcion=d.descripcion,
            cantidad=d.cantidad,
            precio_costo=d.precio_costo,
            subtotal=subtotal,
        )
        db.add(detalle)

        # Actualizar stock automáticamente
        if d.producto_id:
            await db.execute(
                update(Producto)
                .where(Producto.id == d.producto_id)
                .values(
                    stock_actual=Producto.stock_actual + d.cantidad,
                    precio_costo=d.precio_costo,
                )
            )

    # Actualizar deuda del proveedor si quedó saldo
    if saldo > 0:
        await db.execute(
            update(Proveedor)
            .where(Proveedor.id == data.proveedor_id)
            .values(deuda_total=Proveedor.deuda_total + saldo)
        )

    await db.commit()
    await db.refresh(compra)
    return compra


@router.get("/compras")
async def listar_compras(proveedor_id: Optional[int] = None, db: AsyncSession = Depends(get_db)):
    q = select(Compra).options(selectinload(Compra.detalles), selectinload(Compra.proveedor))
    if proveedor_id:
        q = q.where(Compra.proveedor_id == proveedor_id)
    result = await db.execute(q.order_by(Compra.fecha.desc()))
    return result.scalars().all()
