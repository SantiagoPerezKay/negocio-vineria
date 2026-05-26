from sqlalchemy import Column, Integer, String, Numeric, DateTime, ForeignKey, func, Text
from sqlalchemy.orm import relationship
from database import Base


class Cliente(Base):
    __tablename__ = "clientes"

    id = Column(Integer, primary_key=True, index=True)
    nombre = Column(String(200), nullable=False)
    telefono = Column(String(30), nullable=True)
    email = Column(String(150), nullable=True)
    notas = Column(Text, nullable=True)
    deuda_total = Column(Numeric(12, 2), nullable=False, default=0)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    ventas = relationship("Venta", back_populates="cliente")
    pagos = relationship("Pago", back_populates="cliente")


class Pago(Base):
    __tablename__ = "pagos"

    id = Column(Integer, primary_key=True, index=True)
    cliente_id = Column(Integer, ForeignKey("clientes.id"), nullable=False)
    monto = Column(Numeric(12, 2), nullable=False)
    metodo = Column(String(30), nullable=False, default="efectivo")  # efectivo, transferencia, tarjeta
    notas = Column(Text, nullable=True)
    fecha = Column(DateTime(timezone=True), server_default=func.now())

    cliente = relationship("Cliente", back_populates="pagos")
