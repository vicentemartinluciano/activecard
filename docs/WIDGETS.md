# Widgets de ActiveCard para Android

Diseño aprobado el 13/10/2026. Primer runtime con widgets: **1.7.0**, requiere APK
nuevo; no se puede agregar el soporte a la APK 1.6.0 por OTA.

## Comportamiento

- **Repaso diario** (`DailyReview`): pendientes, completadas, porcentaje y barra.
  Usa `getDailyReviewStats`, incluidos límites diarios, falladas y mazos pausados.
  Tocar el resumen o «Repasar ahora» abre `/repaso`; al completar ofrece repasar de nuevo.
- **Mazos** (`StudyDecks`): primero mazos con `0 < progreso.pct < 100` del día,
  en el mismo orden que Inicio. Tocar uno abre su estudio. Debajo agrega recientes
  por `last_studied_at || created_at` descendente (desempate por ID descendente),
  excluyendo los que ya están en progreso; el toque abre el detalle.
  Todos forman una lista nativa desplazable; la altura limita el viewport, nunca
  elimina recientes. Sin progreso, muestra sólo recientes. Desde la preparación
  1.11.0 no tiene título «Mazos» ni pie fijo «Deslizá»; Biblioteca es el último ítem
  de la lista. El progreso se reinicia con el día local.
- **Todo junto** (`ReviewAndDecks`, proveedor desde 1.10.0): repaso fijo arriba y
  lista de progreso/recientes debajo. En 1.11.0 su etiqueta del selector pasa de
  «Repaso y mazos» a «Todo junto» y solicita 4 × 4 celdas, con preview propio.
- Repaso diario usa «Repaso de hoy», racha y botón blanco centrado como Inicio.
  Ninguno muestra botón ↻. El refresco automático sigue consultando SQLite.
- Sin mazos, ofrece abrir Biblioteca. Si falla una lectura, muestra reintento;
  nunca presenta un error como cero pendientes o una biblioteca vacía.

## Diseño y tamaños

Fondo oscuro, degradado de Inicio, progreso con reflejo y fuentes
Plus Jakarta Sans embebidas en Android. La biblioteca dibuja una imagen con zonas
táctiles. Desde APK 1.9.0 se superpone un ViewFlipper nativo para el fuego de racha;
no se usa un bucle JavaScript ni refrescos periódicos para animarlo. Los assets del selector usan el JSX real en una simulación HTML con datos de muestra, no capturas del teléfono.

Desde APK 1.8.0, ambos se pueden redimensionar horizontal y verticalmente hasta
160 × 132 dp. El tamaño inicial se solicita aparte: repaso 4 × 2 celdas
(250 × 132 dp de referencia); mazos 4 × 3 (250 × 220 dp). El tamaño y los pasos
reales dependen de la grilla del launcher. `plugins/with-widget-resize.js` añade
`minResizeWidth/Height` al XML final sin tocar node_modules; conserva receptores,
preview y demás atributos. La APK 1.7.0 conserva sus límites nativos previos.
Las vistas usan el ancho/alto que informa Android: tipografía, cifras y botones
crecen con el espacio disponible. Filas desde arriba, nombres de hasta dos líneas
en tamaños altos y sin grandes bloques vacíos centrados. `layout.js` presupuesta
cada región y la altura del viewport. El modo compacto conserva los controles.

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
  Al abrir la app se recalcula el día local actual; los errores ofrecen reintento.
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

### Revisión de repaso y racha, 15/10/2026 — runtime/APK 1.9.0

- Pedido a partir de otra captura: se retira la cabecera del repaso (título,
  ícono y actualizar), se reduce y sube el contador, con pendientes al lado
  (debajo en el mínimo). Barra de 20–28 dp en tamaños amplios y 12 dp compacta;
  botón y resumen grandes. La barra representa el porcentaje real, sin forzar
  un relleno mínimo igual a su grosor.
- Racha: `getStreak(now)`, misma fecha que el repaso, mismo criterio que Inicio.
  Fuego activo y animado sólo si hubo actividad hoy; inactivo queda quieto/atenuado.
- Se muestrea `assets/lottie/streak-fire.json`, el mismo Lottie de Inicio, en 48 PNG
  de 128 px. `plugins/with-widget-flame.js` integra un overlay ViewFlipper de 63 ms
  en la biblioteca 0.22.1, con hashes de los puntos de integración e idempotencia.
- Overlay debajo de las zonas táctiles; sólo cubre el rectángulo del fuego.
  Captura el fondo sin la llama para evitar duplicación de imágenes al moverse.
  Caché por instancia, imagen de base y fondo. Memoria de frames limitada a
  48 × 128 × 128 píxeles; archivos borrados al eliminar la instancia por el proveedor.
- Escala de animación del sistema en cero o fallo decorativo: conserva el fuego
  estático y los días. Sin temporizadores JS, alarmas, servicios ni permisos nuevos.
- Esta entrega requiere APK 1.9.0: 1.7/1.8 carecen del overlay nativo.
- No se controla ni se instala en el teléfono, que está ocupado en otra sesión.
  Las previews son simulaciones; movimiento y apariencia reales siguen sin QA físico.
- Prebuild Android completado e integración idempotente verificada; pruebas de
  rechazo de cambios nativos inesperados y de superposición bajo las áreas táctiles.
  La suite integral pasó 55 suites / 510 tests; el timeout local ya conocido de
  DeckLoading pasó en la repetición integral sin modificar el test.
- Lint sin advertencias, Doctor offline 21/21 y export Android aprobados.
  Los 48 PNG tienen 128 × 128 px y bordes transparentes sin recortar la llama;
  9 poses distintas muestreadas del ciclo repetido del Lottie original.

### Entrega APK 1.9.0

- [Build EAS d3dbcef4-cefb-4050-a111-3b13a5cd1b7a](https://expo.dev/accounts/vicentemartinluciano/projects/activecard/builds/d3dbcef4-cefb-4050-a111-3b13a5cd1b7a): **FINISHED**, sin instalación física.
- Base `edb60abbe24010f208d298d0a92ff601a6a6ff7c`, runtime 1.9.0,
  versionName 1.9.0, versionCode 4; firma y package existentes conservados.
- [CI de la base](https://github.com/vicentemartinluciano/activecard/actions/runs/38777638081)
  aprobada: tests, validación SQL y exports Android/web.
- [Descargar APK 1.9.0](https://expo.dev/artifacts/eas/MLKZJ_cVUAPGoT1qMFjTvSD9wNv7hbkb3sdX8DSuqqc.apk).
- Archivo descargado e inspeccionado: 135.625.978 bytes;
  SHA-256 `4e3dc79b46aed3f5f2b5133838fb0affa458112c84532afee07aad8968783eb4`.
- AndroidManifest binario confirma versión 1.9.0, código 4 y package existente.
  Certificado v2 idéntico a 1.8.0 y 1.7.0: SHA-256
  `8f5bd7c2b7d4d1bcd56b5707dbaf50b11cd2a9ae073c613f1a73dee6b7281845`.
  Comparación de identidad; no verificación criptográfica integral ni instalación.
- Los dos proveedores compilados conservan mínimos 160 × 132 dp y resize en
  ambos ejes. XML binario incluye ViewFlipper con autoStart y flipInterval=63 ms;
  los 48 PNG empaquetados coinciden exactamente con las fuentes. Esto acredita
  recursos compilados, no movimiento efectivo en One UI.
- Assets revisados sin valores de credenciales locales ni patrones privados.
- Para instalar: exportar respaldo reciente y actualizar encima, sin desinstalar.
- Sin instalación ni control del teléfono, reservado a otra sesión.

### Revisión física integral posterior, 15/10/2026 — fuente 1.10.0

- Galaxy A15 conectado con autorización; package instalado 1.9.0 / código 4.
  Seis capturas del fuego produjeron una sola imagen; los PNG nativos diferían,
  pero el árbol real de One UI carecía del contenedor de animación. La integración
  anterior sólo modificaba `res/layout/rn_widget.xml`; el host oscuro usaba
  `res/layout-night/rn_widget.xml`, que no tenía ese contenedor. Corregidos ambos
  recursos con hashes e idempotencia, y cobertura explícita del recurso nocturno.
- Repaso toma colores, gradiente, radio y fuentes de `theme`: título de Inicio,
  indicadores en píldoras y botón blanco con texto centrado. Grupo centrado con
  medidas dependientes de ancho y alto; se elimina el bloque flexible vacío.
  Se retira la flecha porque el botón de Inicio tampoco la tiene. TextView sin
  padding de fuente y con gravedad vertical centrada, incluidos textos a derecha.
- Animación nativa tanto del fuego activo como de un reflejo limitado al tramo
  completado del progreso; 48 cuadros, 63 ms, pausa al final del reflejo. Respeta
  escala de animación global cero; conserva gráficos estáticos si falla el efecto.
- Mazos usa colección desplazable real: progreso de hoy primero, todos los
  recientes sin duplicados después. Cambiar tamaño ajusta filas y viewport;
  no elimina los mazos que no entran. Mismo patrón en el nuevo `ReviewAndDecks`:
  repaso fijo arriba y mazos desplazables debajo. Mínimos combinados 160 × 280 dp
  para reservar espacio utilizable a ambos paneles; widgets individuales 160 × 132.
- Respaldo v4 nuevo exportado por la app y copiado a PC antes de actualizar:
  10 mazos, 164 tarjetas, 153 repasos, 4 carpetas, 4 chats y 23 mensajes.
  SHA-256 `6c490fcb4a47c737a62392dd1e31cc54f2d5a5db3b1385c09b84f19efea82663`.
  Archivo privado fuera de Git, además de la copia personal del teléfono.
- Prebuild Android aprobado, Doctor offline 21/21 y lint sin advertencias.
  Suite local: 54/55 suites aprobadas y timeout de DeckLoading a 5 s; repetición
  aislada 3/3 aprobada sin cambiar su test ni timeout. Widgets/plugins 25/25.
  [CI de la base final](https://github.com/vicentemartinluciano/activecard/actions/runs/38824083498)
  aprobada: 55 suites / 489 tests, lint, Doctor, SQL real y exports Android/web.

### APK 1.10.0 instalada; QA visible pendiente de desbloqueo

- [Build EAS f812c05b-867b-455a-b238-1b64119cb6a1](https://expo.dev/accounts/vicentemartinluciano/projects/activecard/builds/f812c05b-867b-455a-b238-1b64119cb6a1): **FINISHED**.
  Base `b5e192a4244ff7b808053366d792dd8e307dbe0b`, runtime 1.10.0, código 5.
- [Descargar APK](https://expo.dev/artifacts/eas/_T_XEFrEVlkjTwxxAioGewSdTp6ORP8mrZW_1xL9FfM.apk).
  Descargada e inspeccionada: 135.445.546 bytes, SHA-256
  `c6ac72b019b1f37949521476b0ffb78cc606638bb105fce146645dff3f1d6cc7`.
- Certificado v2 idéntico al de 1.7–1.9, package `com.marti.activecard`.
  Los tres proveedores compilados conservan resize en ambos ejes y sus mínimos;
  ambos layouts raíz (diurno/nocturno) incluyen el mismo contenedor adicional.
  XML compilado con autoStart/63 ms, 48 PNG iguales a las fuentes. Assets sin
  credenciales locales ni patrones privados.
- `adb install -r`: **Success**, sin desinstalación; `dumpsys package` confirma
  1.10.0 / código 5. El selector registra `ReviewAndDecks` junto a los anteriores.
- Se descargaron bitmaps nativos posteriores a la instalación: repaso con título,
  indicadores y botón centrado, 23 pendientes / 2 completadas / 8% / racha de 1 día.
  La colección produjo cabeceras y filas recientes adicionales (índices 3–10),
  sin el recorte anterior. Se comprobaron cachés nativas separadas para fuego y
  barra; su existencia no prueba que el launcher las esté reproduciendo.
- El teléfono se bloqueó durante la compilación (keyguard seguro, pantalla en
  Dozing). Se pidió desbloqueo humano; no se introduce ni modifica el PIN.
  Pendiente: movimiento visible de ambos efectos, desplazamiento a recientes,
  tamaños reales pequeños/amplios, agregado y prueba del combinado y sus enlaces.
  Los bitmaps anteriores son render nativo, no capturas del widget visible.

### Revisión del 16/10/2026 — preparación 1.11.0, sin generar APK

- Las dos capturas de Martín muestran Mazos con poco espacio desplazable y el
  repaso demasiado agrupado. También reporta saltos y demora al cambiar tamaño.
  Se elimina el título «Mazos» y el pie «Deslizá»; Biblioteca queda como último
  elemento desplazable, conservando los enlaces de progreso y recientes.
  En 294 × 218 dp el viewport pasa de 118 a 192 dp.
- Repaso distribuye la altura entre cabecera, indicadores, barra y botón. El botón
  termina en el margen inferior; no queda centrado junto al resto en un bloque
  pequeño. Las medidas varían de forma continua, sin los saltos a 180/220 dp.
- El combinado ya existía en código y en los tres proveedores del APK 1.10.0;
  no se había colocado en One UI. La preparación conserva `ReviewAndDecks` y lo
  identifica «ActiveCard · Todo junto», con preview propio e inicio de 4 × 4 celdas.
  Mínimo combinado intacto: 160 × 280 dp. Agregarlo desde el selector del launcher.
- Ráfagas de resize se agrupan 150 ms dentro del handler headless. WorkManager
  mantiene un trabajo de resize por instancia con reemplazo, conservando prioridad
  expedited. Se consultan medidas vigentes después de SQLite y se descartan lecturas
  superadas. El código nativo verifica tamaño antes de rasterizar y antes de publicar.
  La estrategia de trabajo único sigue el contrato de
  [WorkManager](https://developer.android.com/develop/background-work/background-tasks/persistent/how-to/manage-work).
- Fuego: 48 PNG transparentes compartidos entre tamaños/instancias y fondo separado;
  no se vuelven a componer 48 fondos al ampliar. Reflejo: 33 PNG transparentes hasta
  512 × 40 px, reutilizando el cuadro vacío durante la pausa. Se mantienen 48 pasos
  a 63 ms; los URI inmutables evitan reutilizar una imagen de otra medida. Cachés
  de medidas antiguas expiran después de un día; al borrar el widget se limpian
  sus imágenes. Escala de animación cero y fallback estático conservados.
- Previews del JSX real, incluidas 160 × 132, 294 × 218 y 401 × 340 dp: simulación
  HTML revisada, no render físico. Prebuild genera los tres receptores; combinado
  con etiqueta «Todo junto», 4 × 4 y mínimos correctos. No compila código Java.
- Versión/BAT preparados para **1.11.0**. Por pedido explícito de Martín no se lanza
  EAS Build, OTA ni instalación; él ejecuta `comandos AC/CONSTRUIR-APP-ANDROID.bat`.
  Falta comprobar esta revisión en One UI: agregado del combinado, scroll hasta
  recientes/Biblioteca, enlaces, resize rápido y reproducción de fuego/reflejo.
- Validación local: **55 suites / 493 pruebas**, lint sin advertencias, Doctor
  offline **21/21**, prebuild y export Android aprobados. La primera corrida
  integral tuvo el timeout conocido de DeckLoading a 5 s; pasó aislado (3/3) y en
  la repetición integral sin modificar ese test ni ampliar el timeout. Nuevas
  pruebas cubren espacio de scroll, botón al margen, cambios continuos de tamaño,
  resize agrupado y lecturas viejas que terminan después de una tarea más nueva.

### Corrección del preflight APK 1.11.0

El BAT cancelaba en el paso 6 por recomendaciones de parches remotos de Expo,
aunque la compatibilidad con el SDK instalado aprobaba en CI. Se alinea el comando
con CI: Doctor con `EXPO_OFFLINE=1` es obligatorio; una segunda consulta remota es
informativa. No se omiten fallos del control obligatorio, lint, tests, export ni
las verificaciones de Git/lockfile. No se actualizan dependencias ni se lanza APK.
Se ejecutó el bloque real del BAT aislado, con `cmd.exe`: obligatorio 21/21,
consulta remota con las 17 recomendaciones del registro, aviso y continuación
confirmados (`DOCTOR_GATE_OK`, código 0). No se ejecutó el paso de EAS Build.
