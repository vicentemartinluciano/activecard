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
│   ├── (tabs)/index.js         # Inicio premium: avatar+saludo tocable (→ Ajustes, sin
│   │                           #   engranaje) + pill de racha; hero "Repaso de hoy" con
│   │                           #   subtítulo (LinearGradient); sección "EN PROGRESO" (Ver
│   │                           #   todos → Biblioteca); fila "Gimnasio Mental" si hay
│   │                           #   conexiones. Sin FAB. Skeleton hasta el primer fetch.
│   ├── (tabs)/crear.js         # HUB de creación (única puerta): 3 cards — Generar Mazo con
│   │                           #   IA (→ crear/ia), Nuevo Mazo Manual y Crear Nueva Carpeta
│   │                           #   (ambas vía ActionSheet+InlineAdd, mismo patrón que antes
│   │                           #   vivía en Biblioteca)
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
│   │                           #   deshacer (icono junto al contador + botón en el resumen),
│   │                           #   resumen "shiny" (LinearGradient) + confeti, skeleton
│   ├── crear/preseleccion.js   # revisar/editar (RichField) antes de guardar
│   ├── mazos/[id]/index.js     # detalle: botones grandes Estudiar/Nueva tarjeta, menú "..."
│   │                           #   (ActionSheet: Renombrar/Editar detalles/Borrar) que revela
│   │                           #   tags, carpeta, PercentSlider, IconPicker
│   ├── mazos/[id]/estudiar.js  # modo Quizlet: excluye lo hecho hoy, ronda de falladas,
│   │                           #   deshacer (revierte failedIds si corresponde), resumen
│   │                           #   "shiny" + confeti, skeleton
│   ├── mazos/[id]/tarjeta.js   # editor manual (RichField frente/dorso)
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
├── components/                 # ui.js (Screen/Button[spring+kind+size+labelStyle]/Field/
│   │                           #   Chip/Card/Pill/InlineAdd/EmptyState[icon+full]),
│   │                           #   ActionSheet (bottom sheet: menús y hub Crear), FlipCard
│   │                           #   (spring + opacidad/pointerEvents/zIndex por cara, sin
│   │                           #   parpadeos), SwipeCard, DeckListItem(+folderName),
│   │                           #   MicButton, ChatAuditor, ProgressBar(+gradient),
│   │                           #   StreakFlame(.web) (fix profundo del Lottie),
│   │                           #   ConfettiOverlay(.web) (confeti one-shot de cierre),
│   │                           #   Skeleton (shimmer reutilizable), PercentSlider,
│   │                           #   IconPicker, RichText, RichField
└── theme/                      # colors (Obsidian Cobalt: bg #09090B, cards #151518,
                                #   cardBorder translúcido, azul #3E63DD + paleta), gradients
                                #   (progress verde → TODAS las barras de progreso; bar
                                #   cobalto→cian → card shiny de fin de sesión; hero),
                                #   textColors, spacing, radius (sm10/md16/lg20/pill),
                                #   type (+heading/label)
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

Regla: NUNCA editar migraciones aplicadas; solo agregar al final del array.

## Flujos núcleo

**Cola diaria** (`lib/queue.js`, pura): tarjetas debidas hasta fin de hoy, de
mazos con prioridad > 0, intercaladas por **stride scheduling** determinístico
(cada mazo avanza con paso 100000/prioridad; se emite siempre el de menor
recorrido, empate → menor deckId). 100% aparece el doble de seguido que 50%.
Dentro de cada mazo, la más vencida primero.

**Repaso diario**: mismo swipe que el modo mazo (SwipeCard: derecha = Good,
izquierda = Again, en cualquier momento, sin exigir voltear; botones
equivalentes siempre visibles) → `reviewCard` mode 'daily' → Gimnasio Mental
(ChatAuditor, salteable, tras CADA tarjeta) → siguiente.

**Modo mazo (Quizlet)**: pool = tarjetas del mazo NO repasadas hoy en modo
'quizlet' (`progress.listDeckCardsNotReviewedToday`) → swipe/botones →
al final, si hubo falladas, ronda extra opcional (repetible) que también
llama a `reviewCard` (decisión de producto: la recuperación cuenta en FSRS).
Si el mazo ya está al 100% del día → "Estudiar de nuevo" con el mazo entero.

**Racha** (`lib/streak.js` puro + `db/streak.js`): días consecutivos con ≥1
fila en review_logs (fecha local). Si hoy aún no repasaste pero ayer sí, la
racha sigue viva (no se corta hasta que termine el día). StreakFlame la anima
(Lottie en nativo / ícono estático en web).

**Progreso diario por mazo** (`db/progress.js`): COUNT(DISTINCT card_id) de
review_logs de hoy (modo quizlet) / total del mazo. Sin estado propio.

**Rich text** (`lib/richtext.js`): marcas dentro del mismo TEXT —
`**b**  *i*  __u__  ==hl==  [[color:texto]]` (claves de theme.textColors) y
líneas "- " como viñetas. `parseRich` → bloques/spans anidables; marca sin
cierre = literal. `toPlainText` para previews e IA. El editor (RichField)
muestra la barrita al seleccionar y aplica `wrapSelection`/`wrapColor`/
`toggleListLines` sobre el rango.

**Generación IA** (`app/crear/ia.js`, alcanzable desde el hub `(tabs)/crear.js`):
texto | TXT/MD local | PDF→base64 como bloque `document` | página de Notion →
prompt generador → JSON {cards} → preselección → FSRS. Extracción:
`conceptos_clave` | `completo` | `personalizado` (instrucción libre del
usuario, concatenada en el mensaje user vía `buildGeneratorMessage({..,
custom})`/`buildGeneratorPdfPrompt(mode, custom)` — el system prompt queda fijo
y cacheable). Modelo: **Haiku 4.5** (`MODELS.haiku` en `lib/claude.js`, ⅓ del
costo de Sonnet, misma calidad de extracción); el auditor del Gimnasio Mental
sigue en Sonnet 5 (`MODELS.sonnet`, default de `callClaude`/`callClaudeJson`
cuando no se pasa `model`). Import de Quizlet eliminado (F23): las fuentes son
texto, archivo y Notion.

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

**Cierre de sesión** (repaso y modo mazo): el resumen pasa de `Card` a un
`LinearGradient` con `gradients.bar` ("shiny", título blanco, pills con fondo
semitransparente) + `ConfettiOverlay` (Lottie one-shot, solo si se calificó
≥1 tarjeta; en web no renderiza nada, mismo patrón de resolución por
extensión que `StreakFlame.web.js`).

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
- **Haptics + bump de versión**: pendiente hasta que se dispare el build del
  APK (ver "Dónde estamos" en CLAUDE.md) — `expo-haptics` es módulo nativo, va
  en el commit que bumpea `app.json.version` a `1.2.0`.

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
