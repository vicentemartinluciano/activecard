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
  (`claude-haiku-4-5`) para generar tarjetas** (decisión de costo: ~¼ del precio de
  Sonnet). Reconfirmado con A/B real (F73, apunte de facultad denso): Haiku NO iguala
  a Sonnet — sigue peor las instrucciones condicionales del prompt. Decisión de Martín:
  se queda Haiku igual (la diferencia de precio pesa más en una app de uso personal) +
  **revisión manual de cada generación**. Se evaluó **Gemini Flash** como alternativa
  más barata y se DESCARTÓ: bajo volumen, y romper el proveedor único cuesta más
  (2da API key, 2do SDK, manejo de PDF distinto) que lo que ahorra. Un solo proveedor
  (Anthropic).
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
- **Fallar NO es avanzar (F64 + F70)**: las tarjetas cuya ÚLTIMA nota del día es
  "again" siguen pendientes — re-entran a la cola diaria (`retryIds` en
  `buildDailyQueue`, vía `listRetryTodayIds`) y NO cuentan como hechas en la barra del
  hero, aunque FSRS ya las haya reprogramado para mañana. Ídem en el MODO MAZO (F70):
  el "Progreso de hoy" y el pool de estudio se calculan por última nota quizlet del
  día (`DONE_TODAY_SQL` en `db/progress.js`) — la fallada re-entra al pool y el mazo
  llega a N/N recién cuando acertaste todo.
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
  `USE_LOTTIE` en `StreakFlame.js`, volvió a **true** a pedido de Martín (F71): Lottie
  animado por `progress` (F61) con el loop JS gateado por `useIsFocused`. Si el repaso
  vuelve a sentirse lento, el primer sospechoso es ese loop → flip a false (llama en
  código, native driver, ya implementada como Plan B en el mismo archivo).
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
- **`GENERATOR_SYSTEM` (`lib/prompts.js`) está calibrado contra las tarjetas que Martín
  arma a mano en Quizlet** (F73). Reglas derivadas de ESE criterio real, no inventadas —
  no aflojarlas sin él: (a) **frente = pregunta por defecto**, nombre pelado solo si
  forzar la pregunta suena artificial ("Matriz FODA"); (b) frente autocontenido (incluir
  el tema padre si el concepto es genérico); (c) **conceptos compuestos**: si CADA
  sub-ítem tiene mnemónico propio → 1 tarjeta general + 1 por sub-ítem (ej. las 6
  competencias gerenciales = 7 tarjetas); si son ítems paralelos simples (5 Fuerzas de
  Porter) → 1 sola tarjeta; (d) **mnemónico del usuario al INICIO del dorso**, como ancla,
  antes del desglose; (e) tarjetas extensas están BIEN; (f) formato visual generoso
  (viñetas, flecha "→" entre término y significado, negrita por ítem), NO minimalista;
  (g) `conceptos_clave` = mínimo 5 sin techo y SIN fechas/autores/tablas cronológicas;
  `completo` = cobertura total e incluye esas tablas. **Color y tarjetas duplicadas
  quedan a revisión manual de Martín** — se intentó resolverlos por prompt y Haiku los
  ignora; no volver a intentarlo sin él.
- **NO combinar negrita+cursiva SOLAS en el mismo tramo** (`***texto***`): limitación real
  de la gramática de `richtext.js` — se pierde la cursiva al guardar. El prompt ya se lo
  prohíbe a la IA, y `richhtml.js` la descarta de forma determinística (bold gana). CON
  otra marca en el medio sí se puede (`**__*a*__**`) y el editor lo resuelve solo.
- **Rich text en tarjetas**: marcas livianas en el TEXT (`**negrita**`, `*cursiva*`,
  `__subrayado__`, `==resaltado==`, `[[color:texto]]`, viñetas "- ", **listas numeradas
  "N. "** y **divisor "---"**); render con RichText, `toPlainText()` para previews/IA.
- **Editor estilo Notion (F75-F77, Etapa 2)**: `NotionField` reemplazó a RichField —
  WYSIWYG real, sin marcas a la vista. Nativo = TipTap v3 dentro de un WebView con el
  bundle embebido (`assets/editor/editorHtml.js`, GENERADO y commiteado; regenerar con
  `npm run editor:build` tras tocar `editor-web/`, `editorSetup.js`, `tiptapTColor.js`
  o `editorCss.js`); web = TipTap sobre react-dom (`NotionField.web.js`). El formato de
  almacenamiento NO cambió: `value`/`onChangeText` hablan MARCAS y `lib/richhtml.js`
  convierte en el borde (41 tests). **Atajos de tipeo** (no hay botones para esto):
  `---` = divisor, `->` = →, `- ` = viñeta, `1. ` = numerada. **Barrita flotante = solo
  lo esencial** (negrita, cursiva, subrayado, resaltado con ícono de resaltador, color
  de texto + 6 swatches) — decisión de Martín, no agregar botones.
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
- **F73 completa (calibración del prompt generador)**: `GENERATOR_SYSTEM` reescrito contra
  las tarjetas reales de Quizlet de Martín (ver Decisiones de producto). Se descartó migrar
  a Gemini Flash y se confirmó Haiku 4.5 + revisión manual. Solo cambió el string del
  prompt: sin cambios de lógica, tests de `prompts.js` en verde (solo verifican la
  estructura del mensaje, no el texto del system).
- **Pendiente inmediato**: Martín prueba el prompt nuevo generando tarjetas desde la app
  (queda sin verificar contra Haiku: los dos últimos ajustes — pregunta por defecto en el
  frente, y `completo` incluyendo tablas cronológicas — no se re-testearon por API).
- **Etapa 2 COMPLETA (F75-F77)**: `lib/richhtml.js` (conversión marcas↔HTML, 41 tests) +
  RichText renderiza divisor y numeradas + editor Notion (TipTap v3: WebView en nativo,
  react-dom en web) con los atajos y la barrita esencial. `react-native-webview` es
  NATIVO → `app.json` version quedó en **1.3.0** en el mismo commit.
- **Pendiente inmediato**: **Martín dispara `comandos/CONSTRUIR-APP-ANDROID.bat`**
  (APK 1.3.0, consume créditos EAS — siempre él) y hace el QA del editor en el teléfono.
  Verificado en preview web: los 4 atajos, la barrita con sus 5 botones, negrita desde
  el bubble, y `expo export --platform web` sin romperse. NO verificado todavía: el
  guardado end-to-end (el navegador embebido del preview no abría la DB por los locks
  de OPFS — trampa conocida) y todo el comportamiento nativo del WebView.

## Cuentas
- Anthropic: key creada y validada (en `.env` local como EXPO_PUBLIC_ANTHROPIC_API_KEY).
- Notion: integración interna "ActiveCard" creada y validada (token en `.env`).
- GitHub: vicentemartinluciano / repo público `activecard` (CI + deploy de Pages).
- Expo/EAS: vicentemartinluciano, proyecto `activecard` (id c0ae7728-…-c8a010375d8c).
- Web pública: https://vicentemartinluciano.github.io/activecard/

## Trampas conocidas (no re-descubrir)
- **`npm run lint` NO es lo que corre el CI**: el CI usa `npx eslint . --max-warnings 0`,
  que es MÁS estricto (incluye `scripts/`, `assets/`, y trata los warnings como error).
  Antes de pushear, correr el comando del CI, no `expo lint`.
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
- **Una View con `opacity: 0` SIGUE capturando toques** — los badges del SwipeCard
  ("La sabía"/"No la sabía", absolutos con zIndex 10) tapaban la estrella/rayo de la
  tarjeta hasta que se les puso `pointerEvents="none"`. Todo overlay decorativo
  absoluto lleva pointerEvents none.
- **PanResponder en useRef captura los closures del PRIMER render** — el swipe del
  SwipeCard llamaba a un grade() viejo (con gymArmed=false: el rayo ⚡ armado se
  ignoraba al deslizar). Los handlers deben leer los callbacks desde un ref que se
  actualiza en cada render (`latest.current`), nunca capturarlos directo.
- **El glow de las barras de progreso va en el FILL, no en el track** (si no, el neón
  se ve donde el progreso todavía no llegó) — y el track NO lleva overflow hidden
  (recortaría el boxShadow del fill; el fill se redondea con su propio borderRadius).
- **El autoPlay de Lottie se clava en el primer frame en Android/Fabric** (también con
  la escala de animaciones del sistema baja). Fix probado (portado de FlowState):
  manejar la prop `progress` desde afuera con un `Animated.loop` (useNativeDriver
  false). Y como ese loop corre por JS: frenarlo con `useIsFocused` cuando la pantalla
  queda tapada (las tabs no se desmontan) — si no, congestiona el hilo JS y el resto
  de la app se pone lenta.
