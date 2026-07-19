# Arquitectura de ActiveCard

## Visión
App personal de aprendizaje a largo plazo: repetición espaciada (FSRS) +
asociación de ideas auditada por IA ("Gimnasio Mental"). Datos 100% locales,
sin backend. Versión web pública (GitHub Pages) con respaldo manual como
puente entre dispositivos.

## Estructura de carpetas

```
src/
├── app/                        # rutas (expo-router)
│   ├── _layout.js              # Stack raíz (initKeys al montar) + (tabs)
│   ├── (tabs)/_layout.js       # Bottom tabs: Inicio / Crear / Biblioteca (íconos Feather)
│   ├── (tabs)/index.js         # Inicio neón: avatar+saludo tocable (→ Ajustes, sin
│   │                           #   engranaje) + racha SUELTA (fueguito + "1 día"/"N días",
│   │                           #   sin recuadro); hero "Repaso de hoy" con borde neón +
│   │                           #   glow.accent y barra cián (gradients.bar + glow.cyan);
│   │                           #   botón blanco "REPASAR AHORA" (sin flecha); sección
│   │                           #   "EN PROGRESO" (sin chevron, con % a la derecha,
│   │                           #   glow.accentSoft). SIN fila Gimnasio Mental (solo queda
│   │                           #   la carpeta virtual en Biblioteca). Skeleton inicial.
│   ├── (tabs)/crear.js         # HUB de creación minimalista: 3 cards idénticas (emoji en
│   │                           #   cuadradito 44×44 + título, sin descripciones ni pill,
│   │                           #   fondo gradients.card); card IA con glow neón permanente
│   │                           #   que se intensifica en hover/pressed (Pressable directo,
│   │                           #   excepción comentada al patrón Card). Mazo manual y
│   │                           #   carpeta vía ActionSheet+InlineAdd
│   ├── crear/ia.js             # flujo IA (ex contenido de (tabs)/crear.js): fuentes texto |
│   │                           #   archivo | Notion; extracción conceptos_clave | completo |
│   │                           #   personalizado; Stack.Screen title "Generar con IA"
│   ├── (tabs)/biblioteca.js    # SOLO consulta/filtro (la creación vive en el hub Crear):
│   │                           #   buscador glassmorphic full-width + grilla de carpetas
│   │                           #   fluida (con tile virtual "Gimnasio Mental" si hay
│   │                           #   conexiones) + mazos sueltos (DeckListItem) + filtro de
│   │                           #   etiquetas GLOBAL (sobre todos los mazos, no solo sueltos;
│   │                           #   oculta la grilla de carpetas y muestra pill de carpeta
│   │                           #   por mazo filtrado) + skeleton hasta el primer fetch
│   ├── repaso.js               # repaso diario (FSRS + Gimnasio Mental), swipe unificado,
│   │                           #   círculos ✕/✓ para calificar, estrella en la tarjeta,
│   │                           #   deshacer (icono junto al contador + botón en el resumen),
│   │                           #   resumen oscuro con glow cián + confeti propio, skeleton
│   ├── crear/preseleccion.js   # revisar/editar (RichField) antes de guardar
│   ├── mazos/[id]/index.js     # detalle: HeroButton "ESTUDIAR AHORA" (visual del hero, abre
│   │                           #   el sheet "¿Cómo estudiamos?": Todas/Solo ⭐ y Barajado/Mi
│   │                           #   orden, persiste en settings "studyPrefs"); lista de
│   │                           #   tarjetas arrastrable (react-native-sortables, long-press;
│   │                           #   en web lista estática) con estrella por fila; fila
│   │                           #   punteada "+" al final (reemplaza a "+ NUEVA TARJETA");
│   │                           #   menú "..." (Renombrar/Editar detalles/Borrar)
│   ├── mazos/[id]/estudiar.js  # modo Quizlet: excluye lo hecho hoy, params ?stars=&ordered=
│   │                           #   (filtra por estrella / respeta el orden manual; falladas
│   │                           #   siempre barajadas), ronda de falladas, deshacer, resumen
│   │                           #   oscuro con glow cián + confeti propio, skeleton
│   ├── mazos/[id]/tarjeta.js   # editor manual (RichField frente/dorso) con
│   │                           #   KeyboardAvoidingView + keyboardShouldPersistTaps
│   ├── carpetas/[id]/index.js  # carpeta real: sus mazos, agregar/quitar, renombrar, borrar
│   ├── carpetas/gimnasio.js    # carpeta VIRTUAL: mazos con conexiones (derivada, no es fila
│   │                           #   de `folders`; ruta estática, no colisiona con [id])
│   ├── ajustes.js              # prioridades %, Respaldo, Claves (solo web), conexiones
│   └── conexiones.js           # conexiones validadas del Gimnasio (?deckId= filtra por mazo)
├── db/                         # SQLite async: client (retry OPFS), schema (migraciones),
│   │                           #   decks, folders, cards (+ snapshotFsrs/undoReview para
│   │                           #   deshacer un repaso), settings, connections, reviewQueue,
│   │                           #   streak, progress
├── lib/                        # claude (MODELS.sonnet/haiku), prompts (+ instrucción
│   │                           #   personalizada), generator (Haiku 4.5), auditor (Sonnet 5),
│   │                           #   notion, files, scheduler (ts-fsrs), queue (stride),
│   │                           #   streak (puro), studySession, richtext, backup(IO),
│   │                           #   keys, search (buscador puro de la Biblioteca)
├── components/                 # ui.js (Screen/Button[píldora: Animated.View externo +
│   │                           #   Pressable interno — NUNCA AnimatedPressable con
│   │                           #   style-función]/Field/Chip/Card/Pill/InlineAdd/
│   │                           #   EmptyState[icon+full]), ActionSheet (bottom sheet con
│   │                           #   listeners de teclado: sube con marginBottom=kbHeight),
│   │                           #   FlipCard (UNA cara con scaleX "aplastar y voltear", sin
│   │                           #   bordes, fondo gradients.card, estrella opcional),
│   │                           #   SwipeCard, DeckListItem (fondo gradients.card),
│   │                           #   MicButton, ChatAuditor, ProgressBar(+gradient+glowStyle),
│   │                           #   StreakFlame(.web) (flag USE_LOTTIE: Lottie SOFTWARE o
│   │                           #   CodeFlame en código), ConfettiOverlay (confeti en código,
│   │                           #   un solo archivo nativo+web, sin Lottie), Skeleton,
│   │                           #   PercentSlider, IconPicker, RichText, RichField
└── theme/                      # colors (Obsidian Cobalt: bg #09090B, cards #151518,
                                #   cardBorder translúcido, azul #3E63DD + paleta,
                                #   neonBorder/cyanBorder rgba), gradients (progress verde →
                                #   barras de progreso SALVO la del hero; bar cobalto→cian →
                                #   barra del hero de Inicio; hero; card → degradé suave de
                                #   fondo de cards), glow (boxShadow neón: accent/accentSoft/
                                #   cyan/green/violet — cross-platform en RN 0.76+ new-arch),
                                #   textColors, spacing, radius (sm10/md16/lg20/pill),
                                #   type (+heading/label), layout (maxWidth 480:
                                #   columna centrada en web de escritorio; en el
                                #   teléfono no aplica)
```

## Esquema SQLite (migraciones con PRAGMA user_version en src/db/schema.js)

- v1: `decks(id, name, created_at)` · `tags(id, name UNIQUE)` · `deck_tags` ·
  `cards(id, deck_id, front, back, source 'manual'|'ai'|'hybrid', origin_card_id,
  created_at, + estado FSRS: due, stability, difficulty, elapsed_days,
  scheduled_days, reps, lapses, learning_steps, state, last_review)` ·
  `review_logs(card_id, rating, mode 'daily'|'quizlet', reviewed_at)` ·
  `connections` · `priorities` (huérfana desde v2) · `settings(key, value)`
- v2: `decks.priority INTEGER DEFAULT 100` (0-100, pasos de 5) y `decks.icon TEXT`
  (nombre de ícono Feather). Reemplazan a `priorities` y a `focus_deck_ids`.
- v3: `folders(id, name, created_at)` + `decks.folder_id INTEGER` (0 o 1 carpeta
  por mazo) + índice `idx_decks_folder`. `folder_id` va SIN FK a propósito
  (foreign_keys está ON y complicaría el restore de respaldos v1): la
  integridad la garantiza `deleteFolder` (desasigna mazos + borra, en
  transacción — los mazos nunca se borran al borrar una carpeta).
- v4: `cards.starred INTEGER DEFAULT 0` (estrella Quizlet) + `cards.position
  INTEGER` (orden manual; se inicializa = id) + índice `idx_cards_deck_pos`.
  El backup NO cambió de versión: el restore inserta solo las columnas
  presentes en cada fila, así que los respaldos viejos toman los DEFAULT.

Regla: NUNCA editar migraciones aplicadas; solo agregar al final del array.

## Flujos núcleo

**Cola diaria** (`lib/queue.js`, pura): tarjetas debidas hasta fin de hoy, de
mazos con prioridad > 0, intercaladas por **stride scheduling** determinístico
(cada mazo avanza con paso 100000/prioridad; se emite siempre el de menor
recorrido, empate → menor deckId). 100% aparece el doble de seguido que 50%.
Dentro de cada mazo, la más vencida primero.

**Repaso diario** (F56): mismo sistema que el modo mazo — swipe (derecha =
Good, izquierda = Again) o círculos ✕/✓ → `reviewCard` mode 'daily' →
SIGUIENTE tarjeta directo; al final, ronda extra opcional de falladas (igual
que el modo mazo, mode 'daily'). El Gimnasio Mental es OPT-IN por tarjeta: el
rayo ⚡ junto a la estrella de la FlipCard (estado local one-shot, no persiste)
hace que, al calificar ESA tarjeta, se abra el ChatAuditor y recién después
avance. `getDailyReviewStats` (barra del hero de Inicio) cuenta tarjetas
distintas repasadas hoy en CUALQUIER modo (estudiar un mazo reprograma la
misma FSRS, así que también llena la barra del día). **Fallar no es avanzar**:
las tarjetas cuya última nota del día es "again" (`listRetryTodayIds`)
re-entran a la cola diaria aunque FSRS las haya mandado a mañana, y se restan
de las "hechas" — la barra llega al 100% recién cuando acertaste todo.

**Modo mazo (Quizlet)**: pool = tarjetas del mazo NO repasadas hoy en modo
'quizlet' (`progress.listDeckCardsNotReviewedToday`) → swipe/botones →
al final, si hubo falladas, ronda extra opcional (repetible) que también
llama a `reviewCard` (decisión de producto: la recuperación cuenta en FSRS).
Si el mazo ya está al 100% del día → "Estudiar de nuevo" con el mazo entero.

**Estrellas y orden manual (v4)**: `setCardStarred(id, 0|1)` (toggle desde la
lista del mazo y desde la tarjeta en estudio/repaso) y `setCardPositions(
deckId, orderedIds)` (transacción, position = índice+1; lo dispara el drag &
drop de `react-native-sortables` — agarre por long-press, solo nativo; en web
la lista es estática). `listCardsByDeck` ordena por `position ASC, id ASC`;
`createCard` asigna `MAX(position)+1` del mazo. El sheet "¿Cómo estudiamos?"
(ActionSheet en el detalle del mazo) elige Tarjetas (Todas / Solo ⭐, con
contador y deshabilitado si no hay) y Orden (Barajado / Mi orden), recuerda la
última elección en settings `studyPrefs` y navega a
`estudiar?stars=&ordered=`. El repaso diario NO cambia (siempre su cola FSRS).

**Racha** (`lib/streak.js` puro + `db/streak.js`): días consecutivos con ≥1
fila en review_logs (fecha local). Si hoy aún no repasaste pero ayer sí, la
racha sigue viva (no se corta hasta que termine el día). `StreakFlame` la
anima: flag `USE_LOTTIE` al tope del archivo — true = Lottie con
`renderMode="SOFTWARE"` (Plan A del fix del congelamiento new-arch); false =
`CodeFlame` (llama en código: pulso de escala + parpadeo + glow naranja,
Plan B activable por OTA). Web: ícono estático en `StreakFlame.web.js`.
En Inicio va suelta (fueguito + "1 día"/"N días"), sin recuadro.

**Progreso diario por mazo** (`db/progress.js`): tarjetas cuya ÚLTIMA nota
quizlet de hoy es 'good' (`DONE_TODAY_SQL`) / total del mazo. Fallar no es
avanzar (F70): la fallada no cuenta y re-entra al pool de
`listDeckCardsNotReviewedToday` hasta que se acierte. Sin estado propio.

**Rich text** (`lib/richtext.js`): marcas dentro del mismo TEXT —
`**b**  *i*  __u__  ==hl==  [[color:texto]]` (claves de theme.textColors),
líneas "- " como viñetas, "N. " como lista numerada y "---" como divisor.
Dos tipos de bloque más, marcados con un **sentinel invisible al inicio de la
línea** (Unicode de uso privado, nunca tipeable ni visible): **alineación**
explícita (`ALIGN_SENTINELS` left/center/right; sin sentinel = "sin tocar" → el
render aplica el default de la cara, **frente centro / dorso izquierda**) e
**imagen** inline (`IMG_SENTINEL + "<ancho%> " + dataURI` base64 comprimido, va
al respaldo). `parseRich` → bloques/spans anidables; marca sin cierre = literal.
`toPlainText` (para previews e IA) omite las imágenes y el sentinel de alineación.
`describeBlock` (`lib/richhtml.js`) es la ÚNICA definición de qué es divisor /
numerada / viñeta / imagen / alineación: la usan el render (RichText) y el editor.
Las imágenes las inserta/comprime el editor (canvas, sin lib nativa;
`lib/imageCompress.js` + nodo `lib/tiptapImage.js`); RichText las muestra con
`<Image>` (proporción por `onLoad`, no `Image.getSize` — falla con base64 en
Android), centradas, con tamaño ajustable (S/M/G) y tap = pantalla completa.

**Editor Notion** (`components/NotionField.js` + `.web.js`, F77): WYSIWYG con
TipTap v3. `value`/`onChangeText` SIEMPRE hablan marcas; `lib/richhtml.js`
convierte en el borde (`marksToHtml` / `htmlToMarks`, 85 tests, sin DOM: un
solo code path para jest/nativo/web). Nativo: WebView + bundle propio
(`editor-web/index.js` → esbuild → `assets/editor/editorHtml.js`, generado y
COMMITEADO ~410 KB → offline-first y viaja por OTA; `npm run editor:build`).
Web: TipTap sobre react-dom, sin WebView (split por extensión de plataforma).
Extensiones, atajos e íconos salen de `lib/editorSetup.js` (compartido) para
que ambas plataformas se comporten igual. Bridge nativo: `postMessage`
ready/change/height y `window.__editor.setContent/setPlaceholder/setMinHeight`;
el alto lo reporta un ResizeObserver. Al empujar `value` se compara contra el
último eco emitido (`lastEmitted`) para no re-inyectar y perder el cursor.
Atajos: `---` divisor, `->` →, `- ` viñeta, `1. ` numerada. Barrita flotante:
solo negrita, cursiva, subrayado, resaltado y color (+6 swatches).

**Generación IA** (`app/crear/ia.js`, alcanzable desde el hub `(tabs)/crear.js`):
texto | TXT/MD local | PDF→base64 como bloque `document` | página de Notion →
prompt generador → JSON {cards} → preselección → FSRS. Extracción:
`conceptos_clave` | `completo` | `personalizado` (instrucción libre del
usuario, concatenada en el mensaje user vía `buildGeneratorMessage({..,
custom})`/`buildGeneratorPdfPrompt(mode, custom)` — el system prompt queda fijo
y cacheable). Modelo: **Haiku 4.5** (`MODELS.haiku` en `lib/claude.js`, ~¼ del
costo de Sonnet); el auditor del Gimnasio Mental sigue en Sonnet 5
(`MODELS.sonnet`, default de `callClaude`/`callClaudeJson` cuando no se pasa
`model`). Import de Quizlet eliminado (F23): las fuentes son texto, archivo y
Notion.

`GENERATOR_SYSTEM` está calibrado contra las tarjetas que Martín arma a mano en
Quizlet (F73) — ver las reglas y su porqué en `CLAUDE.md` (Decisiones de
producto). Un A/B con un apunte de facultad denso mostró que Haiku NO iguala a
Sonnet: sigue peor las instrucciones condicionales (con "partí SOLO si…" metía
6 sub-conceptos en una tarjeta; con "SIEMPRE/NUNCA" + un ejemplo obligatorio
calcado al caso real, genera las 7 correctas). De ahí que el prompt use lenguaje
directivo y ejemplos concretos en vez de criterios a sopesar — no "suavizarlo"
sin re-testear. Lo que el prompt NO logra que Haiku respete (usar color, no
duplicar tarjetas) queda a revisión manual: es una decisión de Martín, no un
pendiente.

**Deshacer un repaso** (`db/cards.js`): `reviewCard` devuelve el `logId` del
`review_logs` insertado. `snapshotFsrs(card)` captura el estado FSRS ANTES de
calificar; `undoReview(cardId, prevFields, logId)` restaura esos campos y
borra el log. Repaso diario y modo mazo guardan un historial en memoria
(`{index, cardId, prev, logId, rating}`) y exponen un ícono junto al contador
(solo fase "card") + un botón "Deshacer última" en el resumen. Solo revierte
la nota: conexiones del Gimnasio y sus tarjetas híbridas NUNCA se borran (si
la tarjeta deshecha había generado una, la conexión sigue existiendo). El modo
mazo además revierte la última ocurrencia en `failedIds` si la calificación
deshecha era "again".

**Cierre de sesión** (repaso y modo mazo): card OSCURA (`surfaceCard`) con
borde `cyanBorder` + `glow.cyan`, pills estándar legibles y botones píldora +
`ConfettiOverlay` (solo si se calificó ≥1 tarjeta): ~22 piezas `Animated.View`
en código (translateY + rotate escalonados por índice, one-shot,
`useNativeDriver`), un solo archivo que funciona en nativo Y web — reemplazó
al Lottie, que se congelaba en el APK new-arch.

**Gimnasio Mental**: chat multi-turno con el Auditor (JSON
{veredicto, feedback, hybrid_card}). Al validar: inserta en `connections` +
tarjeta híbrida (source 'hybrid', mismo mazo) que entra a FSRS.

**Carpetas** (`db/folders.js`): nivel de organización sobre los mazos.
Biblioteca = grilla de carpetas fluida (`flexGrow`/`flexBasis`, tiles con
nombre + cantidad) arriba y mazos sueltos abajo; pantalla `carpetas/[id]`
gestiona sus mazos; el detalle del mazo tiene chips de carpeta con toggle.
Las etiquetas siguen siendo solo filtro/búsqueda (las carpetas no llevan
tags). Se crean desde el hub `(tabs)/crear.js` ("Crear Nueva Carpeta" →
`ActionSheet`+`InlineAdd`, navega a Biblioteca al terminar); se renombran
desde `carpetas/[id]`. Biblioteca ya NO tiene botón de creación propio.

**Gimnasio Mental (carpeta virtual)**: tile fijo en la grilla de carpetas,
visible solo si `listDecksWithConnections()` (`db/connections.js`) devuelve
algo — mazos con ≥1 conexión validada, agrupados/ordenados por última
conexión. NO es una fila de `folders`: no tiene id propio, no se puede
borrar/renombrar, no entra en `searchLibrary` ni en el backup. Ruta
`carpetas/gimnasio.js` (estática; expo-router la prioriza sobre `[id]`) lista
esos mazos → cada uno navega a `conexiones?deckId=N` (`listConnections`
acepta `deckId` opcional para filtrar).

**ActionSheet** (`components/ActionSheet.js`): bottom sheet reutilizable
(`Modal transparent`, funciona en web y nativo) para menús contextuales.
Usos: hub `(tabs)/crear.js` (Nuevo Mazo Manual / Crear Nueva Carpeta, cada uno
con `InlineAdd`) y menú "..." del header en el detalle de mazo (Renombrar/
Editar detalles/Borrar — "Editar detalles" togglea la visibilidad de la card
de tags/carpeta/prioridad/ícono, oculta por defecto). Es el único patrón de
overlay de la app; no crear otros Modal/ActionSheet ad-hoc.

**Buscador** (`lib/search.js` puro): filtrado EN MEMORIA, insensible a tildes
y mayúsculas — carpetas por nombre, mazos por nombre o etiqueta, tarjetas por
`toPlainText(front/back)` (así el markup `[[color:...]]` no da falsos
positivos), máx. 20 tarjetas. La UI vive arriba de la Biblioteca; tocar una
tarjeta abre su editor.

**Respaldo** (`lib/backup.js` puro + `backupIO.js`): JSON versionado (v2) con
folders/decks/tags/deck_tags/cards/review_logs/connections (NUNCA settings —
ahí viven las claves). Los respaldos v1 (sin folders) siguen siendo
restaurables: se normalizan a folders vacío. Restore = reemplazo total
transaccional conservando ids.
Web: descarga Blob / picker. Nativo: expo-file-system legacy + expo-sharing.

## Claves de API (`lib/keys.js`)
Caché en memoria inicializada en el root layout desde `settings`
(anthropic_key / notion_token); fallback a `process.env.EXPO_PUBLIC_*`.
- APK: las env vars van embebidas en el build (EAS env vars del proyecto).
- Web pública: el workflow buildea sin .env → sin claves embebidas; el
  usuario las pega en Ajustes (sección visible solo en web).

## Web pública
`.github/workflows/deploy-web.yml`: expo export -p web → 404.html (fallback
SPA) + .nojekyll → actions/deploy-pages. `experiments.baseUrl = "/activecard"`.
URL: https://vicentemartinluciano.github.io/activecard/
SQLite web (OPFS) funciona sin headers COOP/COEP con la API async; la
apertura reintenta ante errores transitorios de locks (ver db/client.js).

## Rediseño Obsidian Cobalt (F21-F28)
Overhaul estético + funcional: fondo `#09090B`, cards `#151518` con borde
translúcido (`colors.cardBorder`, hex-alpha por el regex del test de theme),
degradados en las barras de progreso vía `expo-linear-gradient` (prop
`gradient` de `ProgressBar`, además del `color` sólido de siempre) y degradado
azul profundo (`gradients.hero`) en el hero de Inicio. `expo-linear-gradient`
es módulo nativo → se bumpeó `app.json.version` a `1.1.0` en el mismo commit
que lo instaló: con `runtimeVersion.policy: "appVersion"`, los OTA posteriores
solo llegan al APK que se compile con ese runtime — el APK 1.0.0 no se rompe
por un módulo nativo que no tiene.

## Rediseño "Premium" (F30-F39)
Acerca la app al prototipo mostrado por Martín (video + captura), en 10
módulos JS puros (un commit cada uno):
- **Barras de progreso**: nuevo token `gradients.progress` (verde esmeralda →
  verde claro) reemplaza `gradients.bar` en TODAS las barras (Home, repaso,
  modo mazo, DeckListItem, detalle de mazo). `gradients.bar` (cobalto→cian) no
  se elimina: pasa a ser el fondo de la card "shiny" del resumen de sesión.
- **Hub de creación**: `(tabs)/crear.js` deja de ser el formulario de IA (que
  se muda a `crear/ia.js`) y pasa a ser la única puerta de entrada para crear
  contenido (IA / mazo manual / carpeta); Biblioteca pierde su botón de
  creación.
- **FlipCard robusto**: giro por opacidad interpolada + `pointerEvents` por
  cara (en vez de `zIndex` condicional dinámico) elimina el parpadeo del
  dorso; `minHeight` sube a 340 y el contenido queda centrado.
- **Deshacer**: ver sección "Deshacer un repaso" arriba.
- **Lottie de racha**: fix profundo en `StreakFlame.js` (key por estado +
  `onLayout` + `renderMode="AUTOMATIC"` + reintento diferido) porque el fix
  F26 no alcanzaba en el APK real.
- **Home premium**: ver descripción de `(tabs)/index.js` arriba.
- **Cierre de sesión con confeti**: ver sección "Cierre de sesión" arriba.
- **Microinteracciones**: `Button` (global) y `FlipCard` ganan spring scale al
  presionar; `Skeleton` (shimmer reutilizable) en los estados de carga de
  Home/Biblioteca/repaso/modo mazo; `EmptyState` gana `icon`/`full` para
  estados vacíos con ícono grande en pantallas de estudio.
- **Haiku 4.5**: ver sección "Generación IA" arriba.
- **Haptics + bump de versión**: `expo-haptics` (módulo nativo) entró en el
  commit que bumpeó `app.json.version` a `1.2.0` (F41).

## Rediseño correctivo "Neón" — Etapa 1 (F43-F52)
El APK 1.2.0 salió mal en el device (Android new-arch / Fabric): botones sin
fondo, FlipCard rota, Lottie congelado (racha Y confeti), ActionSheet tapado
por el teclado. La Etapa 1 es 100% JS (va por OTA al runtime 1.2.0):
- **Tokens neón** (`theme`): `glow.*` (boxShadow strings — soportado en RN
  0.76+ new-arch y web), `gradients.card`, `colors.neonBorder/cyanBorder`.
  `gradients.bar` pasa de "card shiny" a barra del hero de Inicio.
- **Causa raíz de los botones**: `Animated.createAnimatedComponent(Pressable)`
  con `style` como FUNCIÓN pierde los fondos en Android new-arch. `Button` se
  reescribió como `Animated.View` externo (scale + style del caller) +
  `Pressable` interno con los estilos visuales, forma píldora.
- **FlipCard**: las dos caras `absoluteFill` con rotateY/opacity se rompían en
  el device → UNA cara con layout natural que se "aplasta" (scaleX 1→0→1) y
  cambia de contenido. Sin bordes, fondo `gradients.card`, estrella opcional.
- **Calificación**: círculos ✕ (rojo) / ✓ (verde) estilo Quizlet reemplazan a
  los dos botones anchos en repaso y modo mazo (el swipe sigue igual).
- **Confeti sin Lottie / racha con flag**: ver "Cierre de sesión" y "Racha".
- **Teclado**: ActionSheet con listeners de Keyboard (Modal Android no se
  ajusta solo) + `statusBarTranslucent`; tarjeta.js con KeyboardAvoidingView.
- **Estrellas + orden manual + sheet de estudio**: migración v4, ver arriba.
- **Etapa 2 completa (F75-F77)**: ver "Editor Notion" arriba. `react-native-webview`
  es nativo → `app.json.version` pasó a **1.3.0** en el mismo commit (misma
  regla que con expo-linear-gradient en 1.1.0): los OTA posteriores quedan
  aislados al APK 1.3.0 y no rompen el 1.2.0 instalado.

## Limitaciones conocidas
- `@jamsch/expo-speech-recognition` no funciona en Expo Go ni web → micrófono
  solo verificable en el APK. En web se oculta el MicButton.
- `lottie-react-native` no funciona en web → StreakFlame.web.js por extensión
  de plataforma (un require condicional no alcanza: Metro resuelve estático).
- PDF: límite de la API de Claude ~100 páginas / 32MB por request.
- Metro + OneDrive: watch poco confiable → reiniciar el preview tras editar.
- El navegador embebido del preview retiene locks OPFS → verificar DB en
  Chrome real.
- **Notion en la web pública no funciona**: la API de Notion no habilita CORS
  para llamadas directas desde el navegador (a diferencia de la de Claude, que
  sí lo permite vía el header `anthropic-dangerous-direct-browser-access`).
  Falla con error de red al primer fetch. Es una limitación de la API de
  Notion, no arreglable sin un backend propio (descartado por diseño). En web,
  usar la fuente "Archivo" con un Markdown exportado desde Notion; la
  conexión directa solo funciona en el APK.
