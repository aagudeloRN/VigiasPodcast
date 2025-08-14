# Etapa 1: Usar una imagen oficial de Python
FROM python:3.11-slim

# Establecer el directorio de trabajo en /app
WORKDIR /app

# Instalar git para poder clonar repositorios si fuera necesario en el futuro
# y procps para herramientas de monitoreo de procesos
RUN apt-get update && apt-get install -y git procps && rm -rf /var/lib/apt/lists/*

# Copiar solo el archivo de requerimientos del backend primero para aprovechar el cache de Docker
COPY backend/requirements.txt ./

# Instalar las dependencias de Python
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# Copiar todo el contenido del proyecto (backend y frontend)
COPY . .

# Exponer el puerto que la aplicación usará
EXPOSE 8000

# Comando para ejecutar la aplicación
# Uvicorn se ejecuta desde el directorio /app, que es ahora la raíz.
# Por eso, necesitamos decirle que la app está en el subdirectorio 'backend'.
CMD ["uvicorn", "backend.main:app", "--host", "0.0.0.0", "--port", "8000"]
