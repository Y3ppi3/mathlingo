@echo off
echo =========================================================
echo    Запуск всей инфраструктуры ML   
echo =========================================================

REM Запуск Mathlingo backend
start run-mathlingo-backend.bat

REM Небольшая пауза для запуска Mathlingo backend
timeout /t 3 /nobreak

REM Запуск Mathlingo frontend
start run-mathlingo-frontend.bat

echo Все компоненты запущены:
echo - Mathlingo backend: http://localhost:8000
echo - Mathlingo frontend: http://localhost:5173

echo Для остановки процессов закройте открытые окна командной строки