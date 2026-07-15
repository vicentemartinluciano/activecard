# CLAUDE.md — Router de contexto de ActiveCard

> Sesión nueva: leé esto entero (es corto a propósito). El detalle vive en `docs/`
> y se lee solo cuando hace falta. Hablá en español rioplatense ("vos"), tono de
> CTO/socio que explica el porqué y pide confirmación antes de cada etapa.

## Qué es
**ActiveCard** — app de aprendizaje a largo plazo ("Soberanía Mental"): repetición
espaciada (FSRS) + "Gimnasio Mental" de asociación de ideas auditado por Claude
(React Native / Expo SDK 57, expo-router, JavaScript). App **privada**: no se
publica en Play Store, se instala como APK propio y se actualiza por EAS Update
(OTA). Datos 100% locales en SQLite (`expo-sqlite`) — sin backend propio.

## Mapa de docs (leé según necesidad)
- `docs/ARQUITECTURA.md` → estructura de carpetas, esquema SQLite, flujos núcleo (repaso, generación IA, Gimnasio Mental).

## Comandos clave
- `npm test` — tests (Jest). Deben pasar siempre.
- `npm run lint` — ESLint.
- **Preview web** (verificar cambios): MCP de preview con el server `activecard-web` de
  `.claude/launch.json`. Navegar a `http://localhost:8081/`, verificar por DOM
  (preview_eval) + console errors.
- OTA al teléfono: `comandos/ACTUALIZAR-APP.bat` (= `eas update --branch preview`). Solo JS/UI.
- APK nuevo: `comandos/CONSTRUIR-APP-ANDROID.bat` (= `eas build -p android --profile preview`).
  Solo si se agrega un módulo NATIVO nuevo o cambia el identificador.
- CI: GitHub Actions corre lint+tests en cada push.

## Convenciones de trabajo
- **Un feature por commit.** Mensajes terminan con `Co-Authored-By: Claude <modelo> <noreply@anthropic.com>`.
- **Verificar en preview ANTES de commitear.** Tras cambios de lógica, correr tests.
- **Nunca** commitear `.env` ni `.claude/settings.local.json` (ya ignorados).
- Tests en `**/__tests__/*.test.js`; congelar fecha con `jest.setSystemTime(...)` si hay lógica de fechas.
- Trabajar en pasos chicos: commit + push + esperar CI verde.
- **Cuando el usuario indica que la sesión terminó** ("se terminó la sesión", "ya
  terminamos", "cerramos por hoy", etc.): antes de cerrar, actualizar los docs de
  contexto del proyecto — este `CLAUDE.md` y `docs/ARQUITECTURA.md` (commitear si
  hubo cambios) — y también los documentos de contexto equivalentes en Google
  Drive del usuario, si hay un conector de Drive disponible en la sesión.

## Decisiones de producto (NO re-litigar sin el usuario)
- **Identificador Android** `com.marti.activecard` — irreversible una vez que hay OTA activo.
- **IA**: Sonnet 5 (`claude-sonnet-5`) para auditar el Gimnasio Mental; **Haiku 4.5
  (`claude-haiku-4-5`) para generar tarjetas** (decisión de costo: ⅓ del precio,
  misma calidad de extracción). Un solo proveedor (Anthropic).
- **API keys en `.env`** (gitignoreado) vía `EXPO_PUBLIC_ANTHROPIC_API_KEY` y `EXPO_PUBLIC_NOTION_TOKEN`; en EAS van como env vars del proyecto.
- **Datos 100% locales** (SQLite). Sin sync a Notion — la base "Conexiones Creadas" en Notion se descartó explícitamente.
- **Fuentes de tarjetas**: texto pegado / archivo por document picker (PDF va en base64 directo a Claude como bloque `document`; TXT/MD se leen local) / página de Notion con internal integration token (sin OAuth).
- **FSRS** (`ts-fsrs`), calificación binaria: "Lo recordaba"=Good, "No lo recordaba"=Again.
- **Mazos** (cada tarjeta pertenece a 1) con **ícono Feather** y **prioridad 0-100%**
  (slider, pasos de 5; 0% = pausado; la cola diaria intercala por stride scheduling
  proporcional al %). Reemplazó al viejo Modo Enfoque y a las prioridades mensuales.
  **Etiquetas** sobre mazos = solo filtro/búsqueda en Biblioteca.
- **Carpetas** (tabla `folders`, migración v3): un mazo pertenece a 0 o 1 carpeta.
  Biblioteca = grilla de carpetas arriba + mazos sueltos abajo; pantalla
  `carpetas/[id]` gestiona sus mazos; chips de carpeta en el detalle del mazo.
  Borrar carpeta NUNCA borra mazos (quedan sueltos). Las carpetas no llevan tags.
- **Buscador de Biblioteca** (`lib/search.js`, en memoria con `toPlainText` — NO SQL
  LIKE): filtra carpetas por nombre, mazos por nombre/etiqueta y tarjetas por texto
  plano, insensible a tildes/mayúsculas.
- **2 modos de estudio con el MISMO sistema** (F56): repaso diario (cola FSRS por stride)
  y mazo específico estilo Quizlet. En ambos: calificás → siguiente tarjeta, swipe
  unificado (derecha=Good, izquierda=Again, sin gate de flip), círculos ✕/✓ sin texto,
  ronda extra de falladas al final (también califica en FSRS), resumen con confeti.
  **El Gimnasio Mental ya NO interrumpe cada tarjeta del repaso diario**: es opt-in por
  tarjeta con el rayo ⚡ junto a la estrella (decisión del momento, NO persiste, cada
  tarjeta arranca apagada) — al calificar esa tarjeta se abre el auditor. Decisión de
  Martín post-OTA Etapa 1; no volver al gimnasio-tras-cada-tarjeta.
- **Estrellas + orden manual (migración v4)**: `cards.starred` y `cards.position`.
  Estrella en cada fila del detalle del mazo Y en la tarjeta durante estudio/repaso;
  drag & drop con `react-native-sortables` (long-press, solo nativo; web = lista
  estática). El "ESTUDIAR AHORA" del mazo (visual hero, `HeroButton`) abre el sheet
  "¿Cómo estudiamos?" (Todas/Solo ⭐ + Barajado/Mi orden; recuerda en settings
  `studyPrefs`; falladas siempre barajadas). Fila punteada "+" al final de la lista
  reemplaza al botón "+ NUEVA TARJETA". El repaso diario NO cambia.
- **UI Neón (F43-F52)**: glow por `boxShadow` (tokens `theme.glow`) — MARCADO en el
  hero de Inicio (borde `neonBorder` + `glow.accent`) y en la card IA de Crear (se
  intensifica en hover/pressed); SUTIL en filas EN PROGRESO (`accentSoft`) y tile
  Gimnasio de Biblioteca (violeta); cián en la card de cierre de sesión. Barras de
  progreso siguen VERDES + `glow.green`, SALVO la del hero: `gradients.bar`
  (cobalto→cián) + `glow.cyan`. Botones = píldora (primario sólido, secundarios
  translúcidos, spring). Cards con degradé suave `gradients.card`. Tarjeta de estudio
  SIN bordes, flip "aplastar y voltear" (scaleX) — NADA de rotateY 3D. Home: racha
  suelta (sin recuadro, "1 día"/"N días" correcto), SIN fila Gimnasio (queda solo la
  carpeta virtual en Biblioteca), EN PROGRESO con % y sin chevron. Crear minimalista
  (emoji 🤖✏️📁 en cuadradito + título, sin descripciones). Cierre de sesión: card
  oscura + glow cián + confeti EN CÓDIGO (sin Lottie) + haptic.
- **Racha** (≥1 tarjeta/día en cualquier modo; derivada de review_logs) y **progreso
  diario por mazo** (derivado de review_logs, se reinicia solo). Animación: flag
  `USE_LOTTIE` en `StreakFlame.js` — true = Lottie `renderMode="SOFTWARE"` (Plan A);
  si en el device sigue congelada → false (Plan B: llama en código) + OTA.
- **Deshacer un repaso**: revierte SOLO la nota (restaura estado FSRS + borra el
  review_log vía `snapshotFsrs`/`undoReview` en `db/cards.js`). Las conexiones del
  Gimnasio y sus tarjetas híbridas NUNCA se borran al deshacer.
- **Gimnasio Mental**: chat de texto iterativo con auditor exigente; micrófono opcional (speech nativo Android, sin API extra); al validar → guarda conexión + crea tarjeta híbrida que entra a FSRS. Siempre salteable.
  **Carpeta virtual "Gimnasio Mental"** en Biblioteca (tile fijo, solo si hay conexiones):
  lista los mazos con conexiones validadas (`listDecksWithConnections`), ruta
  `carpetas/gimnasio.js`. NO es una fila de `folders`: no se guarda, no se borra/renombra,
  no entra al backup ni al buscador.
- **Generación con IA es opcional** (creación manual). Fuentes: texto / archivo / Notion.
  Extracción: conceptos_clave / completo / **personalizado** (instrucción libre del
  usuario, concatenada al mensaje enviado a Claude). Import de Quizlet ELIMINADO (F23):
  se descartó por inestable — no re-litigar sin el usuario. Preservar mnemotecnias del
  usuario textualmente.
- **Rich text en tarjetas**: marcas livianas en el TEXT (`**negrita**`, `*cursiva*`,
  `__subrayado__`, `==resaltado==`, `[[color:texto]]`, listas "- "); editor con barrita
  al seleccionar (RichField), render con RichText, `toPlainText()` para previews/IA.
- **Respaldo manual** (Ajustes): exporta/importa un JSON con todos los datos (sin
  settings/claves). Es el puente celu ↔ web (sin sync automático). Versión 2
  (incluye folders); los respaldos v1 siguen siendo restaurables.
- **Versión web pública** en GitHub Pages (repo público, workflow deploy-web.yml,
  baseUrl /activecard). El build corre sin .env → las claves NO van embebidas en la
  web: se pegan en Ajustes (solo visible en web) y viven en settings del navegador.
  En el APK las claves sí van embebidas por env vars de EAS.
- **Sin notificaciones** (app pasiva). **UI "Obsidian Cobalt" sobre fondo #09090B**
  (cards #151518 con borde translúcido `cardBorder`), acento azul #3E63DD + degradado
  verde (`theme.gradients.progress`, TODAS las barras de progreso) y azul profundo
  (`gradients.hero`, hero de Inicio) vía `expo-linear-gradient` + paleta de apoyo (racha
  naranja, textColors), bottom tabs (Inicio/Crear/Biblioteca). En Inicio, el avatar+saludo
  (arriba a la izquierda) navega a Ajustes — sin engranaje. Todo en español.
- **Creación centralizada**: toda creación de contenido (mazo con IA, mazo manual,
  carpeta) vive en el HUB de la pestaña Crear (`(tabs)/crear.js`); Biblioteca es solo
  consulta/filtro, sin botón de creación propio.
- **Convención de superficies**: toda card visual usa `Card` (surfaceCard nivel base /
  surfaceHigh nivel "high", radios 16-20 de `theme.radius`, borde `cardBorder`) y `Pill`
  (píldoras translúcidas para tags/contadores/badges) de `components/ui.js` — NO definir
  cards ad-hoc por pantalla. Barras de progreso: `gradients.progress` (verde) +
  `glow.green`, salvo la del hero de Inicio (`gradients.bar` + `glow.cyan`); naranja =
  racha. Única excepción documentada al patrón Card: las 3 cards del hub Crear
  (Pressable directo, porque necesitan el estado hovered para el glow).
- **Menús/overlays**: único patrón es `ActionSheet` (`components/ActionSheet.js`, bottom
  sheet con `Modal transparent`) — usado en el hub de Crear (mazo manual/carpeta) y en
  el "..." del detalle de mazo (Renombrar/Editar detalles/Borrar). No crear Modal/menú ad-hoc.
- **Runtime OTA vs APK**: `app.json.runtimeVersion.policy: "appVersion"`. Al agregar un
  módulo NATIVO nuevo, bumpear `version` en el MISMO commit — así los OTA posteriores
  quedan aislados al próximo APK y nunca crashean el APK instalado (se hizo al agregar
  `expo-linear-gradient`, versión pasó a 1.1.0).

## Dónde estamos
- Fases 0-6 y rediseño F8-F15 completos (tema azul, tabs, prioridad %, racha,
  progreso diario, falladas, rich text, import Quizlet, respaldo, web pública).
- F16: subir env vars a EAS y construir el primer APK + smoke test.
- F17-F20 completas (rediseño Quizlet 2.0): contenedores Card/Pill en toda la app,
  swipe unificado en el repaso diario, sistema de Carpetas (migración v3 + backup v2)
  y buscador integrado en Biblioteca.
- F21-F28 completas (rediseño "Obsidian Cobalt"): theme nuevo (fondos, cards, bordes
  translúcidos, degradados), barras de mazos con `expo-linear-gradient` (runtime bumpeado
  a 1.1.0), Inicio sin título con hero degradado, fix del Lottie de racha (`useRef`+`play()`
  + Lottie nuevo del usuario), eliminación de Quizlet del flujo Crear, modo "Personalizado"
  de extracción, `ActionSheet` reutilizable (botón "+" en Biblioteca, menú "..." en detalle
  de mazo), carpeta virtual "Gimnasio Mental", ícono nuevo (monograma "AC").
- F30-F40 completas (rediseño "Premium", ver plan abajo): degradado verde unificado en TODAS las
  barras de progreso (`gradients.progress`; `gradients.bar` pasa a ser la card shiny de
  cierre), hub de Crear (IA/mazo manual/carpeta) con Biblioteca solo consulta, FlipCard sin
  parpadeos (opacidad + pointerEvents por cara) y tarjeta más grande, botón Deshacer en
  repaso diario y modo mazo, fix profundo del Lottie de racha, Home premium (avatar+saludo,
  pill de racha, hero con subtítulo, sección "EN PROGRESO", fila Gimnasio Mental, sin FAB),
  confeti + card shiny al cerrar sesión, microinteracciones (botones/FlipCard elásticos,
  Skeleton, EmptyState con ícono), generación de tarjetas con Haiku 4.5 (auditor sigue en
  Sonnet 5).
- F41-F42 completas: expo-haptics + bump a 1.2.0 → APK 1.2.0 construido e instalado;
  ancho máximo centrado en web de escritorio.
- **El APK 1.2.0 salió MAL en el device** (Android new-arch/Fabric): botones sin fondo,
  FlipCard rota, Lottie congelado (racha y confeti), ActionSheet tapado por el teclado.
  → Rediseño correctivo "Neón" en 2 etapas (plan:
  `C:\Users\marti\.claude\plans\c-users-marti-appdata-local-packages-53-prancy-stroustrup.md`).
- **F43-F52 completas (Etapa 1 del rediseño Neón, 100% JS)**: tokens glow/gradients.card,
  Button píldora (fix del fondo perdido), FlipCard scaleX + círculos ✕/✓, Home neón (glow
  hero, barra cián, racha suelta, % en EN PROGRESO, sin fila Gimnasio), hub Crear
  minimalista con glow en IA, cierre de sesión oscuro + confeti en código, racha con flag
  USE_LOTTIE (SOFTWARE / llama en código), fix de teclado (ActionSheet + editor),
  estrellas + orden manual (migración v4, react-native-sortables) + sheet de estudio,
  Biblioteca con glow violeta y degradé en cards.
- **F56-F57 completas (feedback del primer OTA de Etapa 1)**: repaso diario con el mismo
  sistema que los mazos (directo tarjeta a tarjeta + ronda de falladas; Gimnasio opt-in
  con el rayo ⚡ de la tarjeta, one-shot), fix de la barra del hero de Inicio (colapsaba
  a ancho 0 por el `alignItems: flex-start` del hero — bug preexistente del Premium) y
  `getDailyReviewStats` ahora cuenta repasos de CUALQUIER modo (estudiar un mazo también
  llena la barra del día).
- **Pendiente inmediato**: Martín dispara `comandos/ACTUALIZAR-APP.bat` (OTA al APK
  1.2.0) y re-testea en el teléfono (checklist en el plan + flujo nuevo del repaso). Si
  la racha sigue congelada → flip `USE_LOTTIE=false` + commit + OTA de nuevo.
- **Etapa 2 (F54-F55) NO arrancada**: editor estilo Notion (WebView + TipTap v3 propio,
  conversión marcas↔HTML en `lib/richhtml.js` con tests) → `react-native-webview`
  (nativo) + bump 1.2.0→1.3.0 + APK nuevo. Recién cuando Martín confirme la Etapa 1.

## Cuentas
- Anthropic: key creada y validada (en `.env` local como EXPO_PUBLIC_ANTHROPIC_API_KEY).
- Notion: integración interna "ActiveCard" creada y validada (token en `.env`).
- GitHub: vicentemartinluciano / repo público `activecard` (CI + deploy de Pages).
- Expo/EAS: vicentemartinluciano, proyecto `activecard` (id c0ae7728-…-c8a010375d8c).
- Web pública: https://vicentemartinluciano.github.io/activecard/

## Trampas conocidas (no re-descubrir)
- **Metro + OneDrive**: el file-watching es poco confiable — si el preview no refleja
  un cambio, reiniciar el server de preview (no debuggear bundle viejo).
- **SQLite web**: SOLO la API async de expo-sqlite (la sync se cuelga). Al recargar,
  la apertura puede fallar transitoriamente por locks de OPFS ("Access Handle…" /
  "Invalid VFS state") → db/client.js reintenta; no cachear promesas rechazadas.
- **El navegador embebido del preview de Claude Code retiene locks de OPFS** entre
  recargas → verificar flujos con DB en un Chrome real apuntando a localhost:8081.
- **lottie-react-native no funciona en web** → StreakFlame.web.js (resolución por
  extensión de plataforma; un require condicional NO alcanza, Metro resuelve estático).
- **`Animated.createAnimatedComponent(Pressable)` con `style` como FUNCIÓN pierde los
  fondos en Android new-arch** — patrón PROHIBIDO. Usar `Animated.View` externo (lleva
  el scale y el style del caller) + `Pressable` interno con los estilos visuales
  (así está `Button` en ui.js).
- **lottie-react-native se congela en el APK new-arch** (pasó con la racha Y el confeti,
  dos JSON distintos) — el confeti ya es código propio (ConfettiOverlay); la racha tiene
  el flag `USE_LOTTIE` en StreakFlame.js (Plan B en código, activable por OTA).
- **Dos caras `absoluteFill` con rotateY/opacity interpolada se rompen en Android
  new-arch** (tarjeta de ~90px, texto invisible) — FlipCard usa UNA cara con scaleX
  ("aplastar y voltear"); no volver al enfoque 3D.
