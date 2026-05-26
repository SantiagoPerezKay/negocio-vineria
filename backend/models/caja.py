from sqlalchemy import Column, Integer, String, Numeric, DateTime, Boolean, Text, ForeignKey, func
from sqlalchemy.orm import relationship
from database import Base


class CajaApertura(Base):
    __tablename__ = "caja_aperturas"

    id = Column(Integer, primary_key=True, index=True)
    fecha_apertura = Column(DateTime(timezone=True), server_default=func.now(), index=True)
    monto_inicial = Column(Numeric(12, 2), nullable=False, default=0)
    fecha_cierre = Column(DateTime(timezone=True), nullable=True)
    monto_cierre_real = Column(Numeric(12, 2), nullable=True)
    monto_cierre_sistema = Column(Numeric(12, 2), nullable=True)
    total_efectivo = Column(Numeric(12, 2), nullable=True, default=0)
    total_transferencia = Column(Numeric(12, 2), nullable=True, default=0)
    total_tarjeta = Column(Numeric(12, 2), nullable=True, default=0)
    total_seña = Column(Numeric(12, 2), nullable=True, default=0)
    total_fiado = Column(Numeric(12, 2), nullable=True, default=0)
    total_gastos = Column(Numeric(12, 2), nullable=True, default=0)
    cerrada = Column(Boolean, default=False)
    notas = Column(Text, nullable=True)

    ventas = relationship("Venta", back_populates="caja")
    gastos = relationship("GastoCaja", back_populates="caja")


class GastoCaja(Base):
    __tablename__ = "gastos_caja"

    id = Column(Integer, primary_key=True, index=True)
    caja_id = Column(Integer, ForeignKey("caja_aperturas.id"), nullable=True)
    descripcion = Column(Text, nullable=False)
    monto = Column(Numeric(12, 2), nullable=False)
    categoria = Column(String(100), nullable=True)  # servicios, insumos, sueldos, varios
    fecha = Column(DateTime(timezone=True), server_default=func.now())

    caja = relationship("CajaApertura", back_populates="gastos")
