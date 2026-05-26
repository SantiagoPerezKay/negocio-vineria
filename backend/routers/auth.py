from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from database import get_db
from models.usuario import Usuario
from pydantic import BaseModel
from typing import Optional
from datetime import datetime, timedelta
from jose import JWTError, jwt
from passlib.context import CryptContext
import os

SECRET_KEY = os.getenv("SECRET_KEY", "negocio-secret-key-change-in-production-2024")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 12  # 12 horas

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login", auto_error=False)

router = APIRouter(prefix="/api/auth", tags=["auth"])


def verify_password(plain, hashed):
    return pwd_context.verify(plain, hashed)

def get_password_hash(password):
    return pwd_context.hash(password)

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    expire = datetime.utcnow() + (expires_delta or timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES))
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)


async def get_current_user(token: str = Depends(oauth2_scheme), db: AsyncSession = Depends(get_db)):
    if not token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="No autenticado")
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username = payload.get("sub")
        if not username:
            raise HTTPException(status_code=401, detail="Token inválido")
    except JWTError:
        raise HTTPException(status_code=401, detail="Token inválido o expirado")
    result = await db.execute(select(Usuario).where(Usuario.username == username, Usuario.activo == True))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=401, detail="Usuario no encontrado")
    return user


async def require_admin(current_user: Usuario = Depends(get_current_user)):
    if current_user.rol != "admin":
        raise HTTPException(status_code=403, detail="Se requiere rol administrador")
    return current_user


class UsuarioCreate(BaseModel):
    username: str
    nombre: str
    password: str
    rol: str = "cajero"

class PasswordChange(BaseModel):
    password_actual: str
    password_nueva: str


@router.post("/login")
async def login(form: OAuth2PasswordRequestForm = Depends(), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Usuario).where(Usuario.username == form.username, Usuario.activo == True))
    user = result.scalar_one_or_none()
    if not user or not verify_password(form.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Usuario o contraseña incorrectos")
    token = create_access_token({"sub": user.username, "rol": user.rol})
    return {
        "access_token": token,
        "token_type": "bearer",
        "user": {"id": user.id, "username": user.username, "nombre": user.nombre, "rol": user.rol}
    }


@router.get("/me")
async def get_me(current_user: Usuario = Depends(get_current_user)):
    return {"id": current_user.id, "username": current_user.username, "nombre": current_user.nombre, "rol": current_user.rol}


@router.post("/usuarios")
async def crear_usuario(data: UsuarioCreate, db: AsyncSession = Depends(get_db), current_user: Usuario = Depends(require_admin)):
    existing = await db.execute(select(Usuario).where(Usuario.username == data.username))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="El usuario ya existe")
    user = Usuario(
        username=data.username,
        nombre=data.nombre,
        password_hash=get_password_hash(data.password),
        rol=data.rol,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return {"id": user.id, "username": user.username, "nombre": user.nombre, "rol": user.rol}


@router.get("/usuarios")
async def listar_usuarios(db: AsyncSession = Depends(get_db), current_user: Usuario = Depends(require_admin)):
    result = await db.execute(select(Usuario).order_by(Usuario.nombre))
    users = result.scalars().all()
    return [{"id": u.id, "username": u.username, "nombre": u.nombre, "rol": u.rol, "activo": u.activo} for u in users]


@router.delete("/usuarios/{user_id}")
async def desactivar_usuario(user_id: int, db: AsyncSession = Depends(get_db), current_user: Usuario = Depends(require_admin)):
    result = await db.execute(select(Usuario).where(Usuario.id == user_id))
    u = result.scalar_one_or_none()
    if not u:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    if u.username == current_user.username:
        raise HTTPException(status_code=400, detail="No podés desactivar tu propio usuario")
    u.activo = False
    await db.commit()
    return {"ok": True}


@router.post("/cambiar-password")
async def cambiar_password(data: PasswordChange, db: AsyncSession = Depends(get_db), current_user: Usuario = Depends(get_current_user)):
    if not verify_password(data.password_actual, current_user.password_hash):
        raise HTTPException(status_code=400, detail="Contraseña actual incorrecta")
    current_user.password_hash = get_password_hash(data.password_nueva)
    await db.commit()
    return {"ok": True}
