#!/bin/bash

echo "--- Iniciando Servidor Backend (FastAPI) en segundo plano... ---"
cd backend
source .venv/bin/activate
uvicorn main:app --host 0.0.0.0 --port 8000 &
BACKEND_PID=$!
cd ..

echo "--- Iniciando Servidor Frontend (http-server) en segundo plano... ---"
cd frontend
npm run dev &
FRONTEND_PID=$!
cd ..

echo ""
echo "¡Aplicación iniciada!"
echo "-------------------------------------------------"
echo "URL del Frontend (para abrir en el navegador): http://localhost:3000"
echo "URL del Backend (API): http://localhost:8000"
echo "-------------------------------------------------"
echo ""
echo "Para detener la aplicación, ejecuta el siguiente comando:"
echo "kill $BACKEND_PID $FRONTEND_PID"
echo ""