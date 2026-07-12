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

where node >nul 2>nul
if errorlevel 1 (
  echo  ERROR: no encuentro Node.js instalado ^(o no esta en el PATH^).
  echo  Instalalo desde https://nodejs.org/ y volve a intentar.
  echo.
  pause
  exit /b 1
)

echo  Verificando sesion de EAS...
call npx eas-cli@latest whoami
if errorlevel 1 (
  echo.
  echo  ERROR: no hay sesion iniciada en EAS ^(o fallo la verificacion^).
  echo  Corre "npx eas-cli@latest login" una vez en esta PC, ingresa tu
  echo  usuario y contrasena de Expo/EAS, y volve a ejecutar este archivo.
  echo.
  pause
  exit /b 1
)

echo.
pause
call npx eas-cli@latest update --branch preview --environment preview --message "Actualizacion de ActiveCard"
if errorlevel 1 (
  echo.
  echo  ERROR: el envio de la actualizacion fallo. Revisa el mensaje de arriba
  echo  ^(problemas comunes: sin conexion a internet, o cambios que rompen el
  echo  build de JS^).
) else (
  echo.
  echo  Listo. La proxima vez que abras la app en el telefono, va a descargar
  echo  la actualizacion sola.
)
echo.
pause
