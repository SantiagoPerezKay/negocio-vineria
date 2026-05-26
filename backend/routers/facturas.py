from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from sqlalchemy.orm import selectinload
from database import get_db
from models.factura import Factura, FacturaDetalle
from models.venta import Venta, VentaDetalle
from models.cliente import Cliente
from pydantic import BaseModel
from typing import Optional, List
from decimal import Decimal
from datetime import datetime

router = APIRouter(prefix="/api/facturas", tags=["facturas"])


class FacturaDetalleIn(BaseModel):
    descripcion: str
    cantidad: Decimal = Decimal("1")
    precio_unitario: Decimal


class FacturaIn(BaseModel):
    tipo: str = "B"
    venta_id: Optional[int] = None
    cliente_id: Optional[int] = None
    cliente_nombre: Optional[str] = None
    cliente_cuit: Optional[str] = None
    cliente_direccion: Optional[str] = None
    cliente_condicion_iva: Optional[str] = None
    iva_porcentaje: Decimal = Decimal("21")
    metodo_pago: Optional[str] = None
    notas: Optional[str] = None
    detalles: List[FacturaDetalleIn] = []


async def generar_numero(tipo: str, db: AsyncSession) -> str:
    year = datetime.now().year
    prefix = f"F{tipo}-{year}-"
    result = await db.execute(
        select(func.count(Factura.id)).where(Factura.numero.like(f"{prefix}%"))
    )
    count = result.scalar() or 0
    return f"{prefix}{str(count + 1).zfill(6)}"


@router.get("/")
async def listar_facturas(
    fecha_desde: Optional[str] = None,
    fecha_hasta: Optional[str] = None,
    tipo: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
):
    q = select(Factura).options(selectinload(Factura.detalles), selectinload(Factura.cliente))
    if fecha_desde:
        q = q.where(Factura.fecha >= fecha_desde)
    if fecha_hasta:
        q = q.where(Factura.fecha <= fecha_hasta)
    if tipo:
        q = q.where(Factura.tipo == tipo)
    q = q.order_by(Factura.fecha.desc())
    result = await db.execute(q)
    return result.scalars().all()


@router.post("/")
async def crear_factura(data: FacturaIn, db: AsyncSession = Depends(get_db)):
    numero = await generar_numero(data.tipo, db)

    detalles_list = data.detalles

    if data.venta_id and not detalles_list:
        result = await db.execute(
            select(Venta).options(selectinload(Venta.detalles), selectinload(Venta.cliente))
            .where(Venta.id == data.venta_id)
        )
        venta = result.scalar_one_or_none()
        if not venta:
            raise HTTPException(status_code=404, detail="Venta no encontrada")

        detalles_list = [
            FacturaDetalleIn(
                descripcion=d.descripcion or f"Producto #{d.producto_id}",
                cantidad=d.cantidad,
                precio_unitario=d.precio_unitario,
            )
            for d in venta.detalles
        ]

        if not data.cliente_id and venta.cliente_id:
            data.cliente_id = venta.cliente_id
        if not data.cliente_nombre and venta.cliente:
            data.cliente_nombre = venta.cliente.nombre

    if data.cliente_id and not data.cliente_nombre:
        result = await db.execute(select(Cliente).where(Cliente.id == data.cliente_id))
        cliente = result.scalar_one_or_none()
        if cliente:
            data.cliente_nombre = cliente.nombre

    subtotal = sum(d.cantidad * d.precio_unitario for d in detalles_list)
    iva_monto = subtotal * data.iva_porcentaje / 100
    total = subtotal + iva_monto

    factura = Factura(
        numero=numero,
        tipo=data.tipo,
        venta_id=data.venta_id,
        cliente_id=data.cliente_id,
        cliente_nombre=data.cliente_nombre,
        cliente_cuit=data.cliente_cuit,
        cliente_direccion=data.cliente_direccion,
        cliente_condicion_iva=data.cliente_condicion_iva,
        subtotal=subtotal,
        iva_porcentaje=data.iva_porcentaje,
        iva_monto=iva_monto,
        total=total,
        metodo_pago=data.metodo_pago,
        notas=data.notas,
    )
    db.add(factura)
    await db.flush()

    for d in detalles_list:
        detalle = FacturaDetalle(
            factura_id=factura.id,
            descripcion=d.descripcion,
            cantidad=d.cantidad,
            precio_unitario=d.precio_unitario,
            subtotal=d.cantidad * d.precio_unitario,
        )
        db.add(detalle)

    await db.commit()
    await db.refresh(factura)

    result = await db.execute(
        select(Factura).options(selectinload(Factura.detalles), selectinload(Factura.cliente))
        .where(Factura.id == factura.id)
    )
    return result.scalar_one()


@router.get("/{factura_id}")
async def obtener_factura(factura_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Factura).options(selectinload(Factura.detalles), selectinload(Factura.cliente))
        .where(Factura.id == factura_id)
    )
    factura = result.scalar_one_or_none()
    if not factura:
        raise HTTPException(status_code=404, detail="Factura no encontrada")
    return factura


@router.delete("/{factura_id}")
async def anular_factura(factura_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Factura).where(Factura.id == factura_id))
    factura = result.scalar_one_or_none()
    if not factura:
        raise HTTPException(status_code=404, detail="Factura no encontrada")
    if factura.anulada:
        raise HTTPException(status_code=400, detail="Factura ya anulada")
    factura.anulada = True
    await db.commit()
    return {"ok": True}


@router.get("/siguiente-numero/{tipo}")
async def siguiente_numero(tipo: str, db: AsyncSession = Depends(get_db)):
    numero = await generar_numero(tipo, db)
    return {"numero": numero}
