from sqlalchemy import Column, Integer, String, Numeric, DateTime, ForeignKey, func, Text
from sqlalchemy.orm import relationship
from database import Base


class Proveedor(Base):
    __tablename__ = "proveedores"

    id = Column(Integer, primary_key=True, index=True)
    nombre = Column(String(200), nullable=False)
    contacto = Column(String(200), nullable=True)
    telefono = Column(String(30), nullable=True)
    email = Column(String(150), nullable=True)
    notas = Column(Text, nullable=True)
    deuda_total = Column(Numeric(12, 2), nullable=False, default=0)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    compras = relationship("Compra", back_populates="proveedor")


class Compra(Base):
    __tablename__ = "compras"

    id = Column(Integer, primary_key=True, index=True)
    proveedor_id = Column(Integer, ForeignKey("proveedores.id"), nullable=False)
    fecha = Column(DateTime(timezone=True), server_default=func.now(), index=True)
    total = Column(Numeric(12, 2), nullable=False, default=0)
    pagado = Column(Numeric(12, 2), nullable=False, default=0)
    saldo = Column(Numeric(12, 2), nullable=False, default=0)
    notas = Column(Text, nullable=True)

    proveedor = relationship("Proveedor", back_populates="compras")
    detalles = relationship("CompraDetalle", back_populates="compra", cascade="all, delete-orphan")


class CompraDetalle(Base):
    __tablename__ = "compra_detalles"

    id = Column(Integer, primary_key=True, index=True)
    compra_id = Column(Integer, ForeignKey("compras.id"), nullable=False)
    producto_id = Column(Integer, ForeignKey("productos.id"), nullable=True)
    descripcion = Column(String(300), nullable=True)
    cantidad = Column(Numeric(10, 2), nullable=False, default=1)
    precio_costo = Column(Numeric(10, 2), nullable=False, default=0)
    subtotal = Column(Numeric(12, 2), nullable=False, default=0)

    compra = relationship("Compra", back_populates="detalles")
    producto = relationship("Producto", back_populates="compra_detalles")
