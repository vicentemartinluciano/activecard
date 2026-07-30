@echo off
setlocal
chcp 65001 >nul
title ActiveCard - Validar y construir APK 1.4.0
cd /d "%~dp0.."

echo.
echo  ACTIVECard - BUILD SEGURO DEL APK 1.4.0
echo  =========================================
echo.
echo  Este proceso valida el proyecto completo antes de gastar un build de EAS.
echo  Si cualquier control falla, se cancela inmediatamente.
echo.
echo  IMPORTANTE: instalar el APK sobre la version anterior deberia conservar
echo  SQLite, pero primero exporta un respaldo reciente desde Ajustes en el celu.
echo.
set /p "BACKUP_OK=  Escribi RESPALDO para confirmar que ya lo exportaste: "
if /i not "%BACKUP_OK%"=="RESPALDO" (
  echo.
  echo  CANCELADO: no se confirmo un respaldo reciente.
  echo.
  pause
  exit /b 1
)

echo.
echo  [1/10] Comprobando Node.js, npm y Git...
where node >nul 2>nul
if errorlevel 1 (
  echo  ERROR: no encuentro Node.js en el PATH.
  goto :failure
)
where npm >nul 2>nul
if errorlevel 1 (
  echo  ERROR: no encuentro npm en el PATH.
  goto :failure
)
where git >nul 2>nul
if errorlevel 1 (
  echo  ERROR: no encuentro Git en el PATH.
  goto :failure
)

echo.
echo  [2/10] Comprobando la sesion de Expo/EAS...
call npx eas-cli@latest whoami
if errorlevel 1 (
  echo  ERROR: no hay una sesion EAS valida. Ejecuta: npx eas-cli login
  goto :failure
)

echo.
echo  [3/10] Comprobando rama, cambios tracked y sincronizacion...
for /f "delims=" %%B in ('git branch --show-current') do set "CURRENT_BRANCH=%%B"
if /i not "%CURRENT_BRANCH%"=="main" (
  echo  ERROR: la rama actual es "%CURRENT_BRANCH%"; el build solo sale desde main.
  goto :failure
)
git diff --quiet
if errorlevel 1 (
  echo  ERROR: hay cambios tracked sin commit.
  goto :failure
)
git diff --cached --quiet
if errorlevel 1 (
  echo  ERROR: hay cambios staged sin commit.
  goto :failure
)
git remote get-url origin >nul 2>nul
if errorlevel 1 (
  echo  ERROR: no existe el remoto origin.
  goto :failure
)
git fetch origin main
if errorlevel 1 (
  echo  ERROR: no se pudo actualizar origin/main.
  goto :failure
)
for /f "delims=" %%H in ('git rev-parse HEAD') do set "LOCAL_HEAD=%%H"
for /f "delims=" %%H in ('git rev-parse origin/main') do set "REMOTE_HEAD=%%H"
if /i not "%LOCAL_HEAD%"=="%REMOTE_HEAD%" (
  echo  ERROR: main local no coincide con origin/main.
  echo  Local : %LOCAL_HEAD%
  echo  Remoto: %REMOTE_HEAD%
  goto :failure
)

echo.
echo  [4/10] Verificando que package-lock.json este sincronizado...
rem  El APK 1.4.0 fallo en los servidores de EAS con "lock file's
rem  @react-native/js-polyfills@0.86.0 does not satisfy ...@0.86.2": el lockfile
rem  tenia un arbol hibrido que el npm de esta PC toleraba y el de EAS no. O sea
rem  que el "npm ci" de aca NO alcanza como garantia. Esto lo detecta antes de
rem  gastar el build: si regenerar el lock lo modifica, es que estaba
rem  desincronizado con package.json.
call npm install --package-lock-only --ignore-scripts
if errorlevel 1 (
  echo  ERROR: no se pudo regenerar package-lock.json.
  goto :failure
)
git diff --quiet -- package-lock.json
if errorlevel 1 (
  echo.
  echo  ERROR: package-lock.json estaba DESINCRONIZADO con package.json.
  echo.
  echo  Acaba de regenerarse solo. Este es exactamente el problema que hace
  echo  fallar el build en los servidores de EAS aunque aca todo pase.
  echo.
  echo  Que hacer: revisa el cambio ^(git diff package-lock.json^), commitealo
  echo  y volve a ejecutar este archivo.
  goto :failure
)

echo.
echo  [5/10] Instalando dependencias exactas del lockfile...
call npm ci
if errorlevel 1 (
  echo  ERROR: npm ci fallo.
  goto :failure
)

echo.
echo  [6/10] Validando compatibilidad con Expo Doctor...
call npx expo-doctor
if errorlevel 1 (
  echo  ERROR: Expo Doctor detecto un problema.
  goto :failure
)

echo.
echo  [7/10] Ejecutando ESLint sin warnings...
call npx eslint . --max-warnings 0
if errorlevel 1 (
  echo  ERROR: ESLint fallo.
  goto :failure
)

echo.
echo  [8/10] Ejecutando todos los tests...
call npx jest --ci --runInBand
if errorlevel 1 (
  echo  ERROR: Jest fallo.
  goto :failure
)

echo.
echo  [9/10] Generando el export Android de control...
call npx expo export --platform android --clear
if errorlevel 1 (
  echo  ERROR: el export Android fallo.
  goto :failure
)
git diff --quiet
if errorlevel 1 (
  echo  ERROR: las validaciones modificaron archivos tracked.
  goto :failure
)
git diff --cached --quiet
if errorlevel 1 (
  echo  ERROR: aparecieron cambios staged durante las validaciones.
  goto :failure
)

echo.
echo  [10/10] Todo verde. Construyendo el APK en EAS...
call npx eas-cli@latest build --platform android --profile preview
if errorlevel 1 (
  echo  ERROR: EAS Build fallo. Revisa el mensaje de arriba.
  goto :failure
)

echo.
echo  LISTO: instala el APK desde el enlace o QR de EAS.
echo  Despues verifica datos, repaso, fluidez y recordatorio.
echo.
pause
exit /b 0

:failure
echo.
echo  BUILD CANCELADO O FALLIDO. No se completo un APK nuevo.
echo.
pause
exit /b 1
