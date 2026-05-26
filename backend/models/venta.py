from sqlalchemy import Column, Integer, String, Numeric, DateTime, ForeignKey, func, Text, Boolean
from sqlalchemy.orm import relationship
from database import Base


class Venta(Base):
    __tablename__ = "ventas"

    id = Column(Integer, primary_key=True, index=True)
    fecha = Column(DateTime(timezone=True), server_default=func.now(), index=True)
    total = Column(Numeric(12, 2), nullable=False, default=0)
    # Métodos de pago (una venta puede tener pago mixto)
    efectivo = Column(Numeric(12, 2), nullable=False, default=0)
    transferencia = Column(Numeric(12, 2), nullable=False, default=0)
    tarjeta = Column(Numeric(12, 2), nullable=False, default=0)
    seña = Column(Numeric(12, 2), nullable=False, default=0)
    fiado = Column(Numeric(12, 2), nullable=False, default=0)
    # Cliente (opcional, para fiado)
    cliente_id = Column(Integer, ForeignKey("clientes.id"), nullable=True)
    detalle_libre = Column(String(300), nullable=True)  # descripción libre como en la planilla
    notas = Column(Text, nullable=True)
    anulada = Column(Boolean, default=False)
    caja_id = Column(Integer, ForeignKey("caja_aperturas.id"), nullable=True)
    descuento_monto = Column(Numeric(12, 2), nullable=False, default=0)

    cliente = relationship("Cliente", back_populates="ventas")
    detalles = relationship("VentaDetalle", back_populates="venta", cascade="all, delete-orphan")
    caja = relationship("CajaApertura", back_populates="ventas")


class VentaDetalle(Base):
    __tablename__ = "venta_detalles"

    id = Column(Integer, primary_key=True, index=True)
    venta_id = Column(Integer, ForeignKey("ventas.id"), nullable=False)
    producto_id = Column(Integer, ForeignKey("productos.id"), nullable=True)
    descripcion = Column(String(300), nullable=True)  # para ítems sin producto registrado
    cantidad = Column(Numeric(10, 2), nullable=False, default=1)
    precio_unitario = Column(Numeric(10, 2), nullable=False, default=0)
    descuento_porcentaje = Column(Numeric(5, 2), nullable=False, default=0)
    subtotal = Column(Numeric(12, 2), nullable=False, default=0)

    venta = relationship("Venta", back_populates="detalles")
    producto = relationship("Producto", back_populates="venta_detalles")
