@echo off
title ActiveCard - Enviar actualizacion al telefono (EAS Update)
cd /d "%~dp0.."
echo.
echo  Envia los ultimos cambios a la app YA INSTALADA en tu telefono.
echo  La app los descarga sola la proxima vez que la abris (no hace falta reinstalar).
echo.
echo  (Solo funciona para cambios de codigo/UI/sonidos. Si se agrega un modulo
echo   nativo nuevo, hay que volver a construir el APK.)
echo.
pause
npx eas-cli@latest update --branch preview --message "Actualizacion de ActiveCard"
echo.
pause
