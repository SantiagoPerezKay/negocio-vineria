from sqlalchemy import Column, Integer, String, Boolean, DateTime, func
from database import Base

class Usuario(Base):
    __tablename__ = "usuarios"
    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(50), unique=True, nullable=False, index=True)
    nombre = Column(String(150), nullable=False)
    password_hash = Column(String(200), nullable=False)
    rol = Column(String(20), nullable=False, default="cajero")  # "admin" | "cajero"
    activo = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
