from sqlalchemy import Column, Integer, String, Numeric, DateTime, ForeignKey, func, Text
from sqlalchemy.orm import relationship
from database import Base

class Devolucion(Base):
    __tablename__ = "devoluciones"
    id = Column(Integer, primary_key=True, index=True)
    venta_id = Column(Integer, ForeignKey("ventas.id"), nullable=False)
    motivo = Column(Text, nullable=True)
    monto_devuelto = Column(Numeric(12, 2), nullable=False, default=0)
    metodo_devolucion = Column(String(30), nullable=False, default="efectivo")
    fecha = Column(DateTime(timezone=True), server_default=func.now(), index=True)

    venta = relationship("Venta")
    detalles = relationship("DevolucionDetalle", back_populates="devolucion", cascade="all, delete-orphan")

class DevolucionDetalle(Base):
    __tablename__ = "devolucion_detalles"
    id = Column(Integer, primary_key=True, index=True)
    devolucion_id = Column(Integer, ForeignKey("devoluciones.id"), nullable=False)
    venta_detalle_id = Column(Integer, ForeignKey("venta_detalles.id"), nullable=True)
    producto_id = Column(Integer, ForeignKey("productos.id"), nullable=True)
    descripcion = Column(String(300), nullable=True)
    cantidad = Column(Numeric(10, 2), nullable=False, default=1)
    precio_unitario = Column(Numeric(10, 2), nullable=False, default=0)
    subtotal = Column(Numeric(12, 2), nullable=False, default=0)

    devolucion = relationship("Devolucion", back_populates="detalles")
