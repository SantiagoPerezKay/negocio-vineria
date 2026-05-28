from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from database import create_tables, AsyncSessionLocal
from sqlalchemy import select
from routers import ventas, caja, stock, clientes, proveedores, estadisticas, movimientos
from routers import auth, presupuestos, devoluciones, facturas, promos

app = FastAPI(
    title="Sistema Vinería",
    description="Backend para gestión de caja, stock, clientes, proveedores y facturación",
    version="2.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(ventas.router)
app.include_router(caja.router)
app.include_router(stock.router)
app.include_router(clientes.router)
app.include_router(proveedores.router)
app.include_router(estadisticas.router)
app.include_router(movimientos.router)
app.include_router(presupuestos.router)
app.include_router(devoluciones.router)
app.include_router(facturas.router)
app.include_router(promos.router)


@app.on_event("startup")
async def startup():
    # Import all models so SQLAlchemy registers them before create_all
    import models.usuario, models.venta, models.caja, models.cliente, models.producto, models.proveedor, models.presupuesto, models.devolucion, models.factura, models.promo
    await create_tables()
    # Create default admin if no users exist
    async with AsyncSessionLocal() as db:
        from models.usuario import Usuario
        from routers.auth import get_password_hash
        result = await db.execute(select(Usuario).limit(1))
        if not result.scalar_one_or_none():
            admin = Usuario(
                username="admin",
                nombre="Administrador",
                password_hash=get_password_hash("admin123"),
                rol="admin",
                activo=True,
            )
            db.add(admin)
            await db.commit()


@app.get("/api/health")
async def health():
    return {"status": "ok", "service": "vineria-backend", "version": "2.0.0"}
