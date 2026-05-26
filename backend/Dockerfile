FROM python:3.12-slim

WORKDIR /app

# Dependencias primero (cache de Docker)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Código
COPY . .

EXPOSE 80

# Usamos el puerto 80 por defecto, ya que EasyPanel enruta tráfico web al puerto 80
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "80"]
