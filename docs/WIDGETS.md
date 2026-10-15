# Widgets de ActiveCard para Android

Diseño aprobado el 13/10/2026. Primer runtime con widgets: **1.7.0**, requiere APK
nuevo; no se puede agregar el soporte a la APK 1.6.0 por OTA.

## Comportamiento

- **Repaso diario** (`DailyReview`): pendientes, completadas, porcentaje y barra.
  Usa `getDailyReviewStats`, incluidos límites diarios, falladas y mazos pausados.
  Tocar el resumen o «Repasar ahora» abre `/repaso`; sin pendientes muestra «Al día».
- **Mazos** (`StudyDecks`): primero mazos con `0 < progreso.pct < 100` del día,
  en el mismo orden que Inicio. Tocar uno abre su estudio. Debajo agrega recientes
  por `last_studied_at || created_at` descendente (desempate por ID descendente),
  excluyendo los que ya están en progreso; el toque abre el detalle.
  Si caben al menos dos filas, reserva lugar para ambos grupos. En el mínimo,
  prioriza una fila de progreso. Sin progreso, muestra sólo recientes.
  Muestra hasta ocho filas según el espacio; Biblioteca y el conteo restante
  siempre quedan accesibles. El progreso se reinicia con el día local.
- El botón ↻ de cada widget vuelve a consultar SQLite sin cambiar datos de estudio.
- Sin mazos, ofrece abrir Biblioteca. Si falla una lectura, muestra reintento;
  nunca presenta un error como cero pendientes o una biblioteca vacía.

## Diseño y tamaños

Fondo oscuro, degradado cobalto, reflejo suave en el borde, progreso verde y fuentes
Plus Jakarta Sans embebidas en Android. Render estático: esta biblioteca dibuja
una imagen con zonas táctiles; no hay un bucle de animación ni actualizaciones
frecuentes para simular brillo. Los assets del selector usan el JSX real en una simulación HTML con datos de muestra, no capturas del teléfono.

En APK 1.8.0, ambos se pueden redimensionar horizontal y verticalmente hasta
160 × 132 dp. El tamaño inicial se solicita aparte: repaso 4 × 2 celdas
(250 × 132 dp de referencia); mazos 4 × 3 (250 × 220 dp). El tamaño y los pasos
reales dependen de la grilla del launcher. `plugins/with-widget-resize.js` añade
`minResizeWidth/Height` al XML final sin tocar node_modules; conserva receptores,
preview y demás atributos. La APK 1.7.0 conserva sus límites nativos previos.
Las vistas usan el ancho/alto que informa Android: tipografía, cifras y botones
crecen con el espacio disponible. Filas desde arriba, nombres de hasta dos líneas
en tamaños altos y sin grandes bloques vacíos centrados. `layout.js` presupuesta
cada región y decide cuántas filas caben. El modo compacto conserva los controles.

## Integración

- `index.js` registra el handler Android antes de cargar Expo Router.
- `src/widgets/register.android.js` y `runtime.android.js`: agregado, actualización,
  redimensionamiento y reintento, incluso cuando Android inicia el runtime headless.
  Eliminación y acciones desconocidas no consultan la base.
- `src/widgets/data.js`: repositorios existentes y una misma fecha para repaso/mazos.
- `src/widgets/model.js`: selección y destinos puros; `layout.js`: tamaños y reparto de filas.
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

Instalada el 14/10: APK **1.7.0 / código 2**, encima de 1.6.0, sin desinstalar.
Los cambios de contenido/diseño del 15/10 son compatibles por OTA con 1.7.0.
Los nuevos límites y previews del selector se entregan en APK/runtime **1.8.0**.
Conservar package/proyecto/firma, exportar respaldo antes e instalar encima.
El `versionCode` se incrementa remotamente para distinguir APKs.

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
### Evidencia física del 14/10/2026

- Respaldo v4 exportado antes de instalar: 9 mazos, 160 tarjetas, 4 carpetas,
  3 chats y 147 review logs; sin settings/claves. Identidades y referencias validadas.
- Instalación encima de 1.6.0 confirmada por ADB: 1.7.0 / código 2; apertura fría
  y Ajustes «Al día». No se hizo una comparación completa del respaldo posterior.
- One UI mostró ambos proveedores en el selector y se agregó Repaso diario.
  Mostró datos locales reales: 25 pendientes. El tamaño inicial fue mayor al
  esperado (aprox. 294 × 341 dp), con contenido pequeño y demasiado espacio vacío.
- La captura aportada por Martín el 15/10 muestra ambos widgets y motiva el ajuste.
  No prueba enlaces, refresco tras mutaciones, múltiples instancias ni cambio de día.

### Revisión del 15/10/2026

- Progreso más recientes complementarios, tipografía adaptable y nombres multilínea.
- `scripts/preview-widget-layouts.mjs` usa el JSX de producción, fuentes y datos
  de muestra para simular desde 160 × 132 hasta 400 × 500 dp en HTML.
  No es render Android ni evidencia física; los tests construyen además árboles
  nativos reales de la biblioteca y verifican el presupuesto de cada región.
- Validación local: 53 suites / 497 tests, lint sin advertencias y Doctor offline
  21/21. El test existente DeckLoading agotó su timeout al correr junto al lint;
  la repetición integral aislada pasó sin modificarlo ni ampliar el timeout.
- Martín no dispone del teléfono. No se intenta conexión, instalación ni QA físico.

Referencias: [integración Expo](https://saleksovski.github.io/react-native-android-widget/docs/tutorial/register-widget-expo/),
[actualizaciones](https://saleksovski.github.io/react-native-android-widget/docs/update-widget),
[limitaciones de render](https://saleksovski.github.io/react-native-android-widget/docs/limitations).

### Publicación OTA compatible con 1.7.0

- Fecha: 15/10/2026; Android, rama/canal preview; base `547e7a4` con CI verde.
- Grupo: `c2648198-8c1a-4fc4-8bb9-7adc2567bdd2`.
- Update: `01a13f7b-edd7-7eba-85cb-451295439b84`, runtime 1.7.0.
- Export separado con dotenv desactivado y credenciales deshabilitadas; revisión
  del bundle sin credenciales locales ni patrones privados. Publicado con skip-bundler.
- Publicación confirmada; descarga/ejecución en el teléfono no verificadas.
- APK 1.8.0: conserva firma/package/proyecto, agrega límites nativos independientes
  y previews del selector. Instalación física pendiente de disponibilidad del teléfono.

### Configuración nativa 1.8.0 verificada localmente

- Prebuild Android completado. Los dos XML generados incluyen minResizeWidth=160dp,
  minResizeHeight=132dp, resize horizontal/vertical y sus previews/receptores intactos.
- Tamaños iniciales separados: DailyReview 250 × 132 dp / 4 × 2 celdas;
  StudyDecks 250 × 220 dp / 4 × 3. Cuatro fuentes embebidas; versionName 1.8.0.
- Plugin XML idempotente, con error explícito ante un proveedor inesperado.
- Presupuesto de contenido comprobado en 846 combinaciones de ancho/alto entre
  160–500 y 132–592 dp, además de árboles nativos y previews. Esto no acredita
  el tamaño mínimo ni los pasos reales que ofrecerá One UI.
- Validación final local: 54 suites / 507 tests aprobados, lint sin advertencias,
  Doctor offline 21/21. DeckLoading volvió a agotar 5 s al compartir ejecución
  con Doctor; pasó aislado y luego en la repetición integral sin otros controles
  simultáneos, sin modificar su test ni ampliar el timeout.

### Build APK 1.8.0 del 15/10/2026

- [Build EAS bf9ddabf-383d-421b-9436-fb6047add319](https://expo.dev/accounts/vicentemartinluciano/projects/activecard/builds/bf9ddabf-383d-421b-9436-fb6047add319): **FINISHED**, sin instalación física.
- Base `a0b808976c478c683ea39b1aec25439354a2bb32`, runtime 1.8.0,
  versionName 1.8.0, versionCode 3, package `com.marti.activecard`.
- [CI de la base](https://github.com/vicentemartinluciano/activecard/actions/runs/38734216860)
  verde, incluidos tests y exports Android/web. EAS reutiliza la firma existente.
- EAS confirma que las variables del perfil preview (credenciales deshabilitadas)
  tienen prioridad sobre las variables remotas homónimas.
- [Descargar APK 1.8.0](https://expo.dev/artifacts/eas/PBzAvb5-YF2eM6550YICf4j1KSUw2O1-cUV8vNC1iTA.apk).
- Archivo descargado e inspeccionado: 135.412.520 bytes;
  SHA-256 `67513d85e8fcc2b5955eaff84f0e632d3303e70b262cf078698e0568ce42a5dd`.
- AndroidManifest binario confirma package `com.marti.activecard`, versión 1.8.0
  y código 3. Los dos proveedores compilados incluyen mínimos 160 × 132 dp,
  resize horizontal/vertical y sus respectivos tamaños iniciales 4 × 2 / 4 × 3.
- Certificado v2 idéntico al de la APK 1.7.0 previamente instalada
  (SHA-256 `8f5bd7c2b7d4d1bcd56b5707dbaf50b11cd2a9ae073c613f1a73dee6b7281845`).
  Se comparó la identidad del certificado; no reemplaza la validación criptográfica
  integral ni una instalación real. Assets revisados sin credenciales locales ni
  patrones privados.
- Para instalar: exportar respaldo reciente y actualizar encima, sin desinstalar.
  No se conectó el teléfono; no se verificaron UI, resize ni rutas en esta APK,
  ni se pudo dejar Focus abierta.

Referencia de tamaños: [Android App Widgets](https://developer.android.com/develop/ui/views/appwidgets/layouts).
