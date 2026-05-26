from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, cast, Date
from sqlalchemy.orm import selectinload
from database import get_db
from models.venta import Venta, VentaDetalle
from models.caja import GastoCaja, CajaApertura
from models.proveedor import Compra, Proveedor
from models.cliente import Pago as PagoCliente, Cliente
from typing import Optional
from datetime import datetime

router = APIRouter(prefix="/api/movimientos", tags=["movimientos"])


@router.get("/")
async def listar_movimientos(
    fecha: Optional[str] = None,
    fecha_desde: Optional[str] = None,
    fecha_hasta: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
):
    movimientos = []
    
    d_fecha = None
    if fecha:
        try:
            d_fecha = datetime.strptime(fecha, "%Y-%m-%d").date()
        except Exception:
            pass

    # --- Ventas ---
    q_ventas = select(Venta).options(selectinload(Venta.detalles))
    if d_fecha:
        q_ventas = q_ventas.where(cast(Venta.fecha, Date) == d_fecha)
    else:
        if fecha_desde:
            q_ventas = q_ventas.where(Venta.fecha >= fecha_desde)
        if fecha_hasta:
            q_ventas = q_ventas.where(Venta.fecha <= fecha_hasta)

    result = await db.execute(q_ventas)
    for v in result.scalars().all():
        desc = v.detalle_libre or ", ".join(
            d.descripcion or f"Producto #{d.producto_id}" for d in v.detalles
        ) or "Venta"
        tipo_label = "venta (anulada)" if v.anulada else "venta"
        metodo = None
        if v.efectivo and v.efectivo > 0:
            metodo = "efectivo"
        elif v.transferencia and v.transferencia > 0:
            metodo = "transferencia"
        elif v.tarjeta and v.tarjeta > 0:
            metodo = "tarjeta"
        movimientos.append({
            "id": v.id,
            "tipo": tipo_label,
            "fecha": v.fecha.isoformat() if v.fecha else None,
            "descripcion": desc[:300],
            "monto": float(v.total),
            "metodo": metodo,
        })

    # --- Gastos ---
    q_gastos = select(GastoCaja)
    if d_fecha:
        q_gastos = q_gastos.where(cast(GastoCaja.fecha, Date) == d_fecha)
    else:
        if fecha_desde:
            q_gastos = q_gastos.where(GastoCaja.fecha >= fecha_desde)
        if fecha_hasta:
            q_gastos = q_gastos.where(GastoCaja.fecha <= fecha_hasta)

    result = await db.execute(q_gastos)
    for g in result.scalars().all():
        movimientos.append({
            "id": g.id,
            "tipo": "gasto",
            "fecha": g.fecha.isoformat() if g.fecha else None,
            "descripcion": g.descripcion or "Gasto",
            "monto": float(g.monto),
            "metodo": None,
        })

    # --- Compras ---
    q_compras = select(Compra).options(selectinload(Compra.proveedor))
    if d_fecha:
        q_compras = q_compras.where(cast(Compra.fecha, Date) == d_fecha)
    else:
        if fecha_desde:
            q_compras = q_compras.where(Compra.fecha >= fecha_desde)
        if fecha_hasta:
            q_compras = q_compras.where(Compra.fecha <= fecha_hasta)

    result = await db.execute(q_compras)
    for c in result.scalars().all():
        nombre_prov = c.proveedor.nombre if c.proveedor else "Desconocido"
        movimientos.append({
            "id": c.id,
            "tipo": "compra",
            "fecha": c.fecha.isoformat() if c.fecha else None,
            "descripcion": f"Compra a {nombre_prov}",
            "monto": float(c.total),
            "metodo": None,
        })

    # --- Pagos de clientes ---
    q_pagos = select(PagoCliente).options(selectinload(PagoCliente.cliente))
    if d_fecha:
        q_pagos = q_pagos.where(cast(PagoCliente.fecha, Date) == d_fecha)
    else:
        if fecha_desde:
            q_pagos = q_pagos.where(PagoCliente.fecha >= fecha_desde)
        if fecha_hasta:
            q_pagos = q_pagos.where(PagoCliente.fecha <= fecha_hasta)

    result = await db.execute(q_pagos)
    for p in result.scalars().all():
        nombre_cli = p.cliente.nombre if p.cliente else "Desconocido"
        movimientos.append({
            "id": p.id,
            "tipo": "pago_cliente",
            "fecha": p.fecha.isoformat() if p.fecha else None,
            "descripcion": f"Pago de {nombre_cli}",
            "monto": float(p.monto),
            "metodo": p.metodo,
        })

    # --- Caja (Aperturas y Cierres) ---
    q_caja = select(CajaApertura)
    if d_fecha:
        q_caja = q_caja.where(cast(CajaApertura.fecha_apertura, Date) == d_fecha)
    else:
        if fecha_desde:
            q_caja = q_caja.where(CajaApertura.fecha_apertura >= fecha_desde)
        if fecha_hasta:
            q_caja = q_caja.where(CajaApertura.fecha_apertura <= fecha_hasta)

    result_caja = await db.execute(q_caja)
    for c in result_caja.scalars().all():
        movimientos.append({
            "id": f"ap_{c.id}",
            "tipo": "apertura_caja",
            "fecha": c.fecha_apertura.isoformat() if c.fecha_apertura else None,
            "descripcion": "Apertura de caja",
            "monto": float(c.monto_inicial),
            "metodo": "efectivo",
        })
        if c.fecha_cierre:
            movimientos.append({
                "id": f"ci_{c.id}",
                "tipo": "cierre_caja",
                "fecha": c.fecha_cierre.isoformat(),
                "descripcion": "Cierre de caja",
                "monto": float(c.monto_cierre_real or 0),
                "metodo": "efectivo",
            })

    # Sort all by date descending
    movimientos.sort(key=lambda m: m["fecha"] or "", reverse=True)

    return movimientos
