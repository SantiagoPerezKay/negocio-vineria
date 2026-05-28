from sqlalchemy import Column, Integer, String, Numeric, Boolean, ForeignKey, DateTime, Date, func
from sqlalchemy.orm import relationship
from database import Base


class Categoria(Base):
    __tablename__ = "categorias"

    id = Column(Integer, primary_key=True, index=True)
    nombre = Column(String(100), nullable=False, unique=True)
    descripcion = Column(String(255), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    productos = relationship("Producto", back_populates="categoria")


class Producto(Base):
    __tablename__ = "productos"

    id = Column(Integer, primary_key=True, index=True)
    nombre = Column(String(200), nullable=False)
    codigo = Column(String(50), nullable=True, unique=True)
    categoria_id = Column(Integer, ForeignKey("categorias.id"), nullable=True)
    tipo_vino = Column(String(50), nullable=True)  # tinto, blanco, rosado, espumante, dulce
    imagen_url = Column(String(500), nullable=True)
    nota_sabor = Column(String(500), nullable=True)      # descripción del sabor
    maridaje = Column(String(500), nullable=True)         # comidas recomendadas
    ocasion = Column(String(500), nullable=True)          # ocasiones ideales
    precio_venta = Column(Numeric(10, 2), nullable=False, default=0)
    precio_costo = Column(Numeric(10, 2), nullable=True, default=0)
    stock_actual = Column(Numeric(10, 2), nullable=False, default=0)
    stock_minimo = Column(Numeric(10, 2), nullable=False, default=0)
    unidad = Column(String(30), nullable=False, default="botella")  # botella, caja, unidad, litro
    activo = Column(Boolean, default=True)
    fecha_vencimiento = Column(Date, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    categoria = relationship("Categoria", back_populates="productos")
    venta_detalles = relationship("VentaDetalle", back_populates="producto")
    compra_detalles = relationship("CompraDetalle", back_populates="producto")
