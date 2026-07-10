@echo off
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
pause
echo  [1/2] Vinculando actualizaciones automaticas (te puede pedir login)...
npx eas-cli@latest update:configure
echo.
echo  [2/2] Construyendo el APK en la nube...
npx eas-cli@latest build --platform android --profile preview
echo.
echo  Si dice "Logged out" o pide login, ejecuta:  npx eas-cli login
echo.
pause
