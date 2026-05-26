from sqlalchemy import Column, Integer, String, Numeric, DateTime, ForeignKey, func, Text, Boolean
from sqlalchemy.orm import relationship
from database import Base

class Presupuesto(Base):
    __tablename__ = "presupuestos"
    id = Column(Integer, primary_key=True, index=True)
    cliente_id = Column(Integer, ForeignKey("clientes.id"), nullable=True)
    cliente_nombre = Column(String(200), nullable=True)  # para no registrados
    notas = Column(Text, nullable=True)
    total = Column(Numeric(12, 2), nullable=False, default=0)
    descuento_monto = Column(Numeric(12, 2), nullable=False, default=0)
    estado = Column(String(20), nullable=False, default="pendiente")  # pendiente | aprobado | rechazado | convertido
    fecha = Column(DateTime(timezone=True), server_default=func.now(), index=True)
    fecha_validez = Column(DateTime(timezone=True), nullable=True)
    convertido_a_venta_id = Column(Integer, ForeignKey("ventas.id"), nullable=True)

    cliente = relationship("Cliente", foreign_keys=[cliente_id])
    detalles = relationship("PresupuestoDetalle", back_populates="presupuesto", cascade="all, delete-orphan")

class PresupuestoDetalle(Base):
    __tablename__ = "presupuesto_detalles"
    id = Column(Integer, primary_key=True, index=True)
    presupuesto_id = Column(Integer, ForeignKey("presupuestos.id"), nullable=False)
    producto_id = Column(Integer, ForeignKey("productos.id"), nullable=True)
    descripcion = Column(String(300), nullable=True)
    cantidad = Column(Numeric(10, 2), nullable=False, default=1)
    precio_unitario = Column(Numeric(10, 2), nullable=False, default=0)
    descuento_porcentaje = Column(Numeric(5, 2), nullable=False, default=0)
    subtotal = Column(Numeric(12, 2), nullable=False, default=0)

    presupuesto = relationship("Presupuesto", back_populates="detalles")
