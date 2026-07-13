@echo off
chcp 65001 >nul
title ActiveCard - App (Expo)
cd /d "%~dp0.."
echo.
echo  Encendiendo la app ActiveCard (con limpieza de cache)...
echo.
echo  IMPORTANTE:
echo   - Espera a que aparezca el codigo QR COMPLETO antes de escanear.
echo   - La primera vez tarda 15-20 segundos en armar el bundle.
echo   - Deja ESTA ventana abierta mientras usas la app.
echo.
call npm start -- -c
echo.
echo  La app se detuvo.
pause
