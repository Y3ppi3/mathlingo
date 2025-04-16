@echo off
rem Скрипт для запуска только API Gateway

rem Создаем директорию для логов
if not exist "logs" mkdir logs

echo =========================================================
echo    Запуск Mathlingo backend    
echo =========================================================

cd mathlingo-backend
echo Запуск Mathlingo backend на порту 8000...
docker compose up

rem Команда выше не вернется, пока пользователь не нажмет Ctrl+C
echo Mathlingo backend остановлен.