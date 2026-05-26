from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, extract
from database import get_db
from models.venta import Venta, VentaDetalle
from models.producto import Producto
from models.cliente import Cliente
from models.proveedor import Compra, Proveedor
from typing import Optional

router = APIRouter(prefix="/api/estadisticas", tags=["estadisticas"])


@router.get("/resumen")
async def resumen_general(
    fecha_desde: Optional[str] = None,
    fecha_hasta: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
):
    q = select(
        func.count(Venta.id).label("total_ventas"),
        func.coalesce(func.sum(Venta.total), 0).label("facturado"),
        func.coalesce(func.sum(Venta.efectivo), 0).label("efectivo"),
        func.coalesce(func.sum(Venta.transferencia), 0).label("transferencia"),
        func.coalesce(func.sum(Venta.tarjeta), 0).label("tarjeta"),
        func.coalesce(func.sum(Venta.seña), 0).label("seña"),
        func.coalesce(func.sum(Venta.fiado), 0).label("fiado"),
    ).where(Venta.anulada == False)

    if fecha_desde:
        q = q.where(Venta.fecha >= fecha_desde)
    if fecha_hasta:
        q = q.where(Venta.fecha <= fecha_hasta)

    result = await db.execute(q)
    row = result.one()

    # Deuda total clientes
    deuda_result = await db.execute(
        select(func.coalesce(func.sum(Cliente.deuda_total), 0))
    )
    deuda_clientes = deuda_result.scalar()

    # Total compras (with same date filters)
    q_compras = select(func.coalesce(func.sum(Compra.total), 0))
    if fecha_desde:
        q_compras = q_compras.where(Compra.fecha >= fecha_desde)
    if fecha_hasta:
        q_compras = q_compras.where(Compra.fecha <= fecha_hasta)
    compras_result = await db.execute(q_compras)
    total_compras = compras_result.scalar()

    # Deuda proveedores total
    deuda_prov_result = await db.execute(
        select(func.coalesce(func.sum(Proveedor.deuda_total), 0))
    )
    deuda_proveedores = deuda_prov_result.scalar()

    facturado_val = float(row.facturado)
    total_compras_val = float(total_compras)

    return {
        "total_ventas": row.total_ventas,
        "facturado": facturado_val,
        "por_metodo": {
            "efectivo": float(row.efectivo),
            "transferencia": float(row.transferencia),
            "tarjeta": float(row.tarjeta),
            "seña": float(row.seña),
            "fiado": float(row.fiado),
        },
        "deuda_clientes_total": float(deuda_clientes),
        "total_compras": total_compras_val,
        "ganancia_estimada": facturado_val - total_compras_val,
        "deuda_proveedores_total": float(deuda_proveedores),
    }


@router.get("/ventas-por-dia")
async def ventas_por_dia(
    anio: Optional[int] = None,
    mes: Optional[int] = None,
    db: AsyncSession = Depends(get_db),
):
    q = (
        select(
            func.date(Venta.fecha).label("dia"),
            func.count(Venta.id).label("cantidad"),
            func.coalesce(func.sum(Venta.total), 0).label("total"),
        )
        .where(Venta.anulada == False)
        .group_by(func.date(Venta.fecha))
        .order_by(func.date(Venta.fecha))
    )
    if anio:
        q = q.where(extract("year", Venta.fecha) == anio)
    if mes:
        q = q.where(extract("month", Venta.fecha) == mes)

    result = await db.execute(q)
    return [{"dia": str(r.dia), "cantidad": r.cantidad, "total": float(r.total)} for r in result]


@router.get("/productos-mas-vendidos")
async def productos_mas_vendidos(limit: int = 10, db: AsyncSession = Depends(get_db)):
    q = (
        select(
            Producto.id,
            Producto.nombre,
            func.coalesce(func.sum(VentaDetalle.cantidad), 0).label("cantidad_vendida"),
            func.coalesce(func.sum(VentaDetalle.subtotal), 0).label("total_vendido"),
        )
        .join(VentaDetalle, VentaDetalle.producto_id == Producto.id)
        .join(Venta, Venta.id == VentaDetalle.venta_id)
        .where(Venta.anulada == False)
        .group_by(Producto.id, Producto.nombre)
        .order_by(func.sum(VentaDetalle.cantidad).desc())
        .limit(limit)
    )
    result = await db.execute(q)
    return [
        {
            "id": r.id,
            "nombre": r.nombre,
            "cantidad_vendida": float(r.cantidad_vendida),
            "total_vendido": float(r.total_vendido),
        }
        for r in result
    ]
