# Widgets de ActiveCard para Android

Diseño aprobado el 13/10/2026. Primer runtime con widgets: **1.7.0**, requiere APK
nuevo; no se puede agregar el soporte a la APK 1.6.0 por OTA.

## Comportamiento

- **Repaso diario** (`DailyReview`): pendientes, completadas, porcentaje y barra.
  Usa `getDailyReviewStats`, incluidos límites diarios, falladas y mazos pausados.
  Tocar el resumen o «Repasar ahora» abre `/repaso`; sin pendientes muestra «Al día».
- **Mazos** (`StudyDecks`): hasta tres mazos con `0 < progreso.pct < 100` del día,
  en el mismo orden que Inicio. Tocar uno abre su estudio. Cuando no hay ninguno,
  muestra hasta tres recientes por `last_studied_at || created_at` descendente,
  con desempate por ID descendente; el toque abre el detalle, como en Inicio web.
  No mezcla recientes para rellenar una lista parcial. El progreso se reinicia
  con el día local. Un widget pequeño reduce filas; Biblioteca siempre queda accesible.
- El botón ↻ de cada widget vuelve a consultar SQLite sin cambiar datos de estudio.
- Sin mazos, ofrece abrir Biblioteca. Si falla una lectura, muestra reintento;
  nunca presenta un error como cero pendientes o una biblioteca vacía.

## Diseño y tamaños

Fondo oscuro, degradado cobalto, reflejo suave en el borde, progreso verde y fuentes
Plus Jakarta Sans embebidas en Android. Render estático: esta biblioteca dibuja
una imagen con zonas táctiles; no hay un bucle de animación ni actualizaciones
frecuentes para simular brillo. Los assets del selector son ilustrativos.

Ambos se pueden redimensionar horizontal y verticalmente, mínimo 180 × 154 dp.
Tamaños iniciales: repaso 4 × 2 celdas; mazos 4 × 3. El tamaño real depende del launcher.
Las vistas usan el ancho/alto que informa Android para evitar escalar una captura fija.

## Integración

- `index.js` registra el handler Android antes de cargar Expo Router.
- `src/widgets/register.android.js` y `runtime.android.js`: agregado, actualización,
  redimensionamiento y reintento, incluso cuando Android inicia el runtime headless.
  Eliminación y acciones desconocidas no consultan la base.
- `src/widgets/data.js`: repositorios existentes y una misma fecha para repaso/mazos.
- `src/widgets/model.js`: selección, límites de filas y destinos puros.
- `src/components/WidgetUpdates.android.js`: escucha escrituras ya confirmadas de
  `transactions.js`, agrupa ráfagas y refresca todas las instancias. También al
  entrar/salir de foreground y cada minuto mientras la app está activa.
- Android solicita actualizaciones periódicas cada 30 minutos. El sistema puede
  demorarlas por batería/reposo; no se promete un reinicio visual exacto a medianoche.
  Al abrir la app o tocar ↻ se recalcula el día local actual.
- Enlaces `activecard:///widget?target=study|deck&deckId=...`: esperan apertura y
  migración de SQLite; si el mazo fue borrado, abren Biblioteca. `/repaso` y
  `/biblioteca` usan enlaces directos. No modifican FSRS ni contenido.
- Web/iOS resuelven módulos vacíos y conservan navegación y funcionalidades.
- No se agregan tablas, datos remotos ni permisos de cuenta. Cada runtime consulta
  la SQLite local; no guarda una copia de la biblioteca ni contenido de tarjetas.

## Validación y entrega

Tests: selección/progreso/recientes, cambio de día, datos vacíos, errores, enlaces
inválidos/borrados, múltiples instancias y tamaños, render de árboles nativos,
agrupación de escrituras y cambios durante un refresco. Además, lint, Expo Doctor,
prebuild/config y exports Android/web. Estos controles no prueban el launcher físico.

Para entregar, conservar package/proyecto/firma, compilar preview 1.7.0, verificar
respaldo e instalar encima de 1.6.0. No desinstalar. El `versionCode` se incrementa
remotamente para distinguir APKs.

QA físico: selector y apariencia real, ambas rutas en arranque frío, redimensionar,
varias instancias, refresco tras estudio/undo/renombrado/sync, completar mazo,
recientes, entidad borrada y cambio de día. Registrar la evidencia antes de afirmar
que esas rutas funcionan en el Samsung A15.

### Evidencia local del 13/10/2026

- 17 pruebas nuevas; suite completa final: 52 suites / 481 tests aprobados.
  La primera ejecución integral tuvo un timeout de 5 s en `DeckLoading.test.js`
  mientras se exportaban bundles en paralelo. La repetición integral, después
  de los exports, aprobó los 481 sin cambiar ese test ni aumentar su timeout.
- Expo Doctor offline: 21/21. Export Android y web aprobados; prebuild genera
  ambos receptores, XML de tamaños y las cuatro fuentes nativas.
- Samsung A15 conectado: se comprobó APK 1.6.0 / código 1. Focus impide mantener
  ActiveCard abierta para exportar respaldo y probar widgets; no se modifican
  esas restricciones. Instalación y QA nuevos esperan acceso al teléfono.

Referencias: [integración Expo](https://saleksovski.github.io/react-native-android-widget/docs/tutorial/register-widget-expo/),
[actualizaciones](https://saleksovski.github.io/react-native-android-widget/docs/update-widget),
[limitaciones de render](https://saleksovski.github.io/react-native-android-widget/docs/limitations).
