@echo off
chcp 65001 >nul
title ActiveCard - Construir APK para Android (EAS)
cd /d "%~dp0.."
echo.
echo  Esto construye ActiveCard como app instalable (APK) en la nube de Expo.
echo.
echo  REQUISITOS (una sola vez):
echo   1) Tener una cuenta gratis de Expo (https://expo.dev/signup)
echo   2) Cuando te lo pida, inicia sesion con esa cuenta.
echo.
echo  El build tarda ~10-20 min y corre en la nube (podes cerrar el telefono).
echo  Al terminar te da un enlace/QR para descargar e instalar el APK.
echo.
echo  La app quedara con ACTUALIZACIONES AUTOMATICAS activadas (EAS Update):
echo  los cambios futuros llegan solos sin reinstalar.
echo.

where node >nul 2>nul
if errorlevel 1 (
  echo  ERROR: no encuentro Node.js instalado ^(o no esta en el PATH^).
  echo  Instalalo desde https://nodejs.org/ y volve a intentar.
  echo.
  pause
  exit /b 1
)

pause
echo  [1/2] Vinculando actualizaciones automaticas (te puede pedir login)...
call npx eas-cli@latest update:configure
if errorlevel 1 (
  echo.
  echo  ERROR: fallo la vinculacion de actualizaciones automaticas. Revisa el
  echo  mensaje de arriba.
  echo.
  pause
  exit /b 1
)

echo.
echo  [2/2] Construyendo el APK en la nube...
call npx eas-cli@latest build --platform android --profile preview
if errorlevel 1 (
  echo.
  echo  ERROR: el build fallo. Revisa el mensaje de arriba.
  echo  Si dice "Logged out" o pide login, ejecuta:  npx eas-cli login
) else (
  echo.
  echo  Listo. Instala el APK con el enlace/QR de arriba.
)
echo.
pause
