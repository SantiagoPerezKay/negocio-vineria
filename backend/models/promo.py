from sqlalchemy import Column, Integer, String, Numeric, Boolean, DateTime, ForeignKey, func
from sqlalchemy.orm import relationship
from database import Base


class Promo(Base):
    __tablename__ = "promos"

    id = Column(Integer, primary_key=True, index=True)
    nombre = Column(String(200), nullable=False)
    descripcion = Column(String(500), nullable=True)
    precio_promo = Column(Numeric(12, 2), nullable=False)  # precio especial del combo
    imagen_url = Column(String(500), nullable=True)
    activo = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    productos = relationship("PromoProducto", back_populates="promo", cascade="all, delete-orphan")


class PromoProducto(Base):
    __tablename__ = "promo_productos"

    id = Column(Integer, primary_key=True, index=True)
    promo_id = Column(Integer, ForeignKey("promos.id"), nullable=False)
    producto_id = Column(Integer, ForeignKey("productos.id"), nullable=False)
    cantidad = Column(Numeric(10, 2), nullable=False, default=1)

    promo = relationship("Promo", back_populates="productos")
    producto = relationship("Producto")
