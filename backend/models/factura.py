from sqlalchemy import Column, Integer, String, Numeric, DateTime, ForeignKey, func, Text, Boolean, Date
from sqlalchemy.orm import relationship
from database import Base


class Factura(Base):
    __tablename__ = "facturas"

    id = Column(Integer, primary_key=True, index=True)
    numero = Column(String(50), nullable=False, unique=True, index=True)
    tipo = Column(String(1), nullable=False, default="B")  # A, B, C
    fecha = Column(DateTime(timezone=True), server_default=func.now(), index=True)
    venta_id = Column(Integer, ForeignKey("ventas.id"), nullable=True)
    cliente_id = Column(Integer, ForeignKey("clientes.id"), nullable=True)

    cliente_nombre = Column(String(200), nullable=True)
    cliente_cuit = Column(String(20), nullable=True)
    cliente_direccion = Column(String(300), nullable=True)
    cliente_condicion_iva = Column(String(50), nullable=True)

    subtotal = Column(Numeric(12, 2), nullable=False, default=0)
    iva_porcentaje = Column(Numeric(5, 2), nullable=False, default=21)
    iva_monto = Column(Numeric(12, 2), nullable=False, default=0)
    total = Column(Numeric(12, 2), nullable=False, default=0)

    metodo_pago = Column(String(50), nullable=True)
    notas = Column(Text, nullable=True)
    anulada = Column(Boolean, default=False)

    created_at = Column(DateTime(timezone=True), server_default=func.now())

    venta = relationship("Venta", backref="factura")
    cliente = relationship("Cliente", backref="facturas")
    detalles = relationship("FacturaDetalle", back_populates="factura", cascade="all, delete-orphan")


class FacturaDetalle(Base):
    __tablename__ = "factura_detalles"

    id = Column(Integer, primary_key=True, index=True)
    factura_id = Column(Integer, ForeignKey("facturas.id"), nullable=False)
    descripcion = Column(String(300), nullable=False)
    cantidad = Column(Numeric(10, 2), nullable=False, default=1)
    precio_unitario = Column(Numeric(10, 2), nullable=False, default=0)
    subtotal = Column(Numeric(12, 2), nullable=False, default=0)

    factura = relationship("Factura", back_populates="detalles")
