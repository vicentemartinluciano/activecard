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
│   ├── _layout.js              # Stack raíz: fuentes con fallback, initKeys, autoBackup
│   │                           #   diferido, sync/taps del recordatorio y ErrorBoundary
│   ├── (tabs)/_layout.js       # Bottom tabs: Inicio / Crear / Biblioteca / Progreso (Feather)
│   ├── (tabs)/index.js         # Inicio: avatar+saludo POR HORA tocable (→ Ajustes) con el
│   │                           #   nombre de settings.userName + racha suelta (solo número);
│   │                           #   hero "Repaso de hoy" SIN borde, con 3 pills sin borde
│   │                           #   (pendientes/completadas/%), barra a lo ancho y botón al
│   │                           #   74%; halo cobalto solo al tocar (hero y botón). Sección
│   │                           #   "EN PROGRESO" sin halo permanente pero con los colores
│   │                           #   de siempre. Stagger al entrar. Toast si falla la carga.
│   ├── (tabs)/progreso.js      # Progreso: card con carrusel retención ⇄ constancia (dots),
│   │                           #   "Lo que viene" (7 días con la rayita del tope) y
│   │                           #   "Puntos débiles" (lapses) con botón para estudiarlos
│   ├── (tabs)/crear.js         # HUB de creación minimalista: 3 cards IDÉNTICAS (emoji en
│   │                           #   cuadradito + título, sin descripciones ni pill, fondo
│   │                           #   gradients.card). Las tres encienden el halo cobalto al
│   │                           #   tocarlas (GlowPressable) — ninguna es "la destacada" y
│   │                           #   los emojis se quedan. Mazo manual y carpeta vía
│   │                           #   ActionSheet+InlineAdd
│   ├── crear/ia.js             # flujo IA (ex contenido de (tabs)/crear.js): fuentes texto |
│   │                           #   archivo | Notion; extracción conceptos_clave | completo |
│   │                           #   personalizado; Stack.Screen title "Generar con IA"
│   ├── (tabs)/biblioteca.js    # SOLO consulta/filtro (la creación vive en el hub Crear):
│   │                           #   buscador full-width (chips de etiquetas SOLO al enfocarlo)
│   │                           #   + carrusel horizontal de carpetas (una fila; tile Gimnasio
│   │                           #   si hay ideas) + TODOS los mazos (sueltos primero, luego con
│   │                           #   carpeta) con DeckListItem minimalista. Envuelta en SectionSwipe
│   ├── repaso.js               # repaso diario (FSRS + Gimnasio Mental), swipe unificado,
│   │                           #   círculos ✕/~/✓ (3 niveles) para calificar, estrella en la tarjeta,
│   │                           #   deshacer (icono junto al contador + botón en el resumen),
│   │                           #   resumen oscuro con glow cián + confeti propio, skeleton
│   ├── crear/preseleccion.js   # revisar/editar (RichField) antes de guardar
│   ├── mazos/[id]/index.js     # detalle: HeroButton "ESTUDIAR AHORA" (visual del hero, abre
│   │                           #   el sheet "¿Cómo estudiamos?": Todas/Solo ⭐ y Barajado/Mi
│   │                           #   orden, persiste en settings "studyPrefs"); lista de
│   │                           #   tarjetas buscable/filtrable y arrastrable (sortables;
│   │                           #   en web lista estática) con estrella por fila; fila
│   │                           #   punteada "+" al final (reemplaza a "+ NUEVA TARJETA");
│   │                           #   menú "..." (Renombrar/Editar detalles/Borrar)
│   ├── mazos/[id]/estudiar.js  # modo Quizlet: excluye lo hecho hoy, params ?stars=&ordered=
│   │                           #   (filtra por estrella / respeta el orden manual; falladas
│   │                           #   siempre barajadas), ronda de falladas, deshacer, resumen
│   │                           #   oscuro con glow cián + confeti propio, skeleton
│   ├── mazos/[id]/tarjeta.js   # editor manual + estado/historial FSRS, suspender,
│   │                           #   mover de mazo y marcar IA como revisada
│   ├── carpetas/[id]/index.js  # carpeta real: sus mazos, agregar/quitar, renombrar, borrar
│   ├── gimnasio/index.js       # Gimnasio Mental: vista derivada de cards source='hybrid'
│   │                           #   (listDecksWithIdeas). Espejo de Biblioteca: carpetas con
│   │                           #   ideas + TODOS los mazos con ideas (sueltos primero).
│   │                           #   ?folderId=N filtra a esa carpeta
│   ├── gimnasio/[deckId].js    # ideas de un mazo (listIdeaCards): editar tarjeta, abrir
│   │                           #   charla guardada o iniciar otra con el Socio
│   ├── gimnasio/nueva.js       # entrada directa al ChatAuditor: elige cualquier tarjeta
│   ├── gimnasio/chat.js        # charla libre o reapertura persistente por ?id=N
│   ├── gimnasio/historial.js   # historial local: reabrir, crear y borrar charlas
│   ├── gimnasio/charla.js      # transcript persistido + tarjeta que originó la idea
│   ├── ajustes.js              # Carga diaria, Prioridad y Recordatorio (nativo; todos
│   │                           #   plegables), Tu nombre, Respaldo, Claves web, ideas
├── db/                         # SQLite async: client (retry OPFS), schema (migraciones),
│   │                           #   decks, folders, cards (+ snapshotFsrs/undoReview para
│   │                           #   deshacer un repaso; listAllCardsForSearch = versión
│   │                           #   liviana para el buscador, sin las imágenes base64),
│   │                           #   settings, connections, gymChats, reviewQueue (+ dailyLimits),
│   │                           #   streak, progress, stats (retención/actividad/forecast/
│   │                           #   puntos débiles — todo derivado, sin tablas nuevas)
├── lib/                        # openai (GPT-5.6 Luna + Responses API), prompts
│   │                           #   (+ instrucción personalizada), generator/auditor,
│   │                           #   notion, files, scheduler (ts-fsrs), queue (stride),
│   │                           #   streak (puro), studySession, richtext, backup(IO),
│   │                           #   keys, search, gymAssistant, notifications (recordatorio local)
├── components/                 # ui.js (Screen/Button[píldora: Animated.View externo +
│   │                           #   Pressable interno — NUNCA AnimatedPressable con
│   │                           #   style-función]/Field/Chip/Card/Pill/InlineAdd/
│   │                           #   EmptyState[icon+full]), ActionSheet (bottom sheet con
│   │                           #   listeners de teclado: sube con marginBottom=kbHeight),
│   │                           #   FlipCard (UNA cara con scaleX "aplastar y voltear", sin
│   │                           #   bordes, fondo gradients.card, estrella opcional),
│   │                           #   SwipeCard, DeckListItem (minimalista: nombre + N° tarjetas
│   │                           #   y prioridad arriba a la derecha, mismo color), SectionSwipe
│   │                           #   (swipe horizontal entre tabs por gesture-handler),
│   │                           #   MicButton, VoiceInput(.native/.web), ChatAuditor,
│   │                           #   StarField, ProgressBar(+gradient+glowStyle),
│   │                           #   StreakFlame(.web) (flag USE_LOTTIE: Lottie SOFTWARE o
│   │                           #   CodeFlame en código), ConfettiOverlay (confeti en código,
│   │                           #   un solo archivo nativo+web, sin Lottie), Skeleton,
│   │                           #   PercentSlider (min/max/step/formatLabel), IconPicker,
│   │                           #   RichText, RichField, GlowPressable (halo SOLO al tocar),
│   │                           #   Stagger (entrada escalonada con Animated, NO reanimated),
│   │                           #   Collapsible, Toast, ErrorBoundary, EditableCardRow,
│   │                           #   Sheen (reflejo diagonal), RetentionChart (SVG), ActivityHeatmap,
│   │                           #   ForecastList
└── theme/                      # colors (Obsidian Cobalt: bg #09090B, cards #151518,
                                #   cardBorder translúcido, azul #3E63DD + paleta,
                                #   cyanBorder rgba), font(N)/fontFamilies (Plus Jakarta
                                #   Sans, UNA FAMILIA POR PESO), tabular, gradients (progress
                                #   verde → barras de progreso SALVO la del hero; bar
                                #   cobalto→cian → barra del hero de Inicio; hero; card →
                                #   degradé suave de fondo de cards), glow (halo cobalto /
                                #   haloViolet / green / cyan) + HALO_PADDING,
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
- v5: `cards.suspended INTEGER NOT NULL DEFAULT 0`. Las suspendidas siguen visibles
  y editables en su mazo, pero quedan fuera de cola diaria, modo mazo, forecast y
  puntos débiles. Un respaldo viejo restaura con el DEFAULT sin cambiar de versión.
- v6: índices `review_logs(reviewed_at)`,
  `review_logs(card_id, reviewed_at DESC, id DESC)` y
  `connections(hybrid_card_id)`. No cambia columnas ni el formato de respaldo.
- v7: `gym_chats(id, title, origin_card_id, draft_text, created_at, updated_at)` +
  `gym_messages(id, chat_id, role, text, metadata, created_at)`. Los mensajes y
  borradores sobreviven cierres; borrar una charla elimina sus mensajes por
  `ON DELETE CASCADE`, nunca las tarjetas que ya se hayan creado o modificado.

Regla: NUNCA editar migraciones aplicadas; solo agregar al final del array.

## Flujos núcleo

**Cola diaria** (`lib/queue.js`, pura): tarjetas debidas hasta fin de hoy, de
mazos con prioridad > 0, intercaladas por **stride scheduling** determinístico
(cada mazo avanza con paso 100000/prioridad; se emite siempre el de menor
recorrido, empate → menor deckId). 100% aparece el doble de seguido que 50%.
Dentro de cada mazo, la más vencida primero.
`getDailyReviewStats` y la selección de `getDailyQueue` usan `listCardsForQueue`
(`id, deck_id, due, state, suspended`) para no cargar frente/dorso ni imágenes
base64. Repaso hidrata recién los IDs finales con `listCardsByIds(ids)`, en el
mismo orden de la cola y por lotes de 500. Los topes se aplican con el cupo
restante después de descontar tarjetas ya repasadas y nuevas introducidas hoy.

**Repaso diario** (F56): mismo sistema que el modo mazo — swipe (derecha =
Good, izquierda = Again, arriba = Hard "Más o menos") o círculos ✕/~/✓ →
`reviewCard` mode 'daily' →
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
Las suspendidas se excluyen de ambos pools.

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
y cacheable). Modelo único: **GPT-5.6 Luna** mediante Responses API
(`lib/openai.js`): generación y análisis documental usan razonamiento `xhigh`;
la conversación normal del Gimnasio usa `high`. Import de Quizlet eliminado
(F23): las fuentes son texto, archivo y Notion.
La preselección se persiste en `settings.generationDraft`: sobrevive a un cierre
de Android, recuerda selección/ediciones/mazo y marca cada tarjeta ya guardada.
Si una inserción falla, muestra el avance parcial y permite retomar sin duplicar.

`GENERATOR_SYSTEM` está calibrado contra las tarjetas que Martín arma a mano en
Quizlet (F73) — ver las reglas y su porqué en `CLAUDE.md`. Conserva lenguaje
directivo, ejemplos concretos y el contrato JSON. La migración a Luna fue una
decisión directa de producto, sin A/B; la revisión manual de la propuesta sigue
siendo obligatoria antes de escribir tarjetas en SQLite.

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

**Gimnasio Mental**: chat general multi-turno con Sonnet 5; puede empezar libre o
con una tarjeta de contexto. La IA conversa sobre cualquier tema y, si el usuario
lo pide, devuelve una propuesta estructurada para buscar, editar, crear o borrar
tarjetas. `lib/gymAssistant.js` resuelve la búsqueda sobre la base local: si hay
varias coincidencias muestra opciones y recién entonces vuelve a consultar a la
IA con la tarjeta real. Ninguna mutación se ejecuta desde el modelo: siempre se
muestra un panel de revisión, todas requieren confirmación y borrar exige una
segunda confirmación explícita. Crear una conexión/tarjeta híbrida sigue siendo
posible, pero ya no es el final obligatorio de la charla.

`gym_chats` y `gym_messages` guardan cada turno, el título automático y el
borrador; el `chatId` también queda en la ruta para recuperarlo tras cerrar o
recargar la app. `gimnasio/historial.js` permite reabrir, crear y borrar charlas.
La pantalla usa fondo estrellado suave con estrellas fugaces espaciadas, burbujas
anchas y `KeyboardAvoidingView` para mantener el compositor sobre el teclado.
Además del rayo del repaso, `gimnasio/nueva.js` permite elegir cualquier tarjeta.
`listConnectionsByHybridCard` mantiene la lectura de transcripts históricos en
`gimnasio/charla.js`.

**Carpetas** (`db/folders.js`): nivel de organización sobre los mazos.
Biblioteca = grilla de carpetas fluida (`flexGrow`/`flexBasis`, tiles con
nombre + cantidad) arriba y TODOS los mazos abajo (sueltos primero, luego los
que están en carpeta; los con carpeta muestran su pill de carpeta) — las
carpetas quedan como atajo por practicidad; pantalla `carpetas/[id]`
gestiona sus mazos; el detalle del mazo tiene chips de carpeta con toggle.
Las etiquetas siguen siendo solo filtro/búsqueda (las carpetas no llevan
tags). Se crean desde el hub `(tabs)/crear.js` ("Crear Nueva Carpeta" →
`ActionSheet`+`InlineAdd`, navega a Biblioteca al terminar); se renombran
desde `carpetas/[id]`. Biblioteca ya NO tiene botón de creación propio.

**Gimnasio Mental (vista derivada, no carpeta virtual)**: ya NO lee de
`connections` — es una vista en vivo de las tarjetas-idea reales (cards con
`source='hybrid'`). Tile fijo en la grilla de carpetas de Biblioteca, visible
solo si `listDecksWithIdeas()` (`db/cards.js`) devuelve algo. La idea vive UNA
sola vez, en su mazo; el Gimnasio solo la muestra desde otro ángulo. Ruta
`gimnasio/index.js` = espejo de Biblioteca (carpetas con ideas arriba, TODOS
los mazos con ideas abajo — sueltos primero; `?folderId=N` filtra a una
carpeta) → `gimnasio/[deckId].js` lista las ideas del mazo (`listIdeaCards`) →
tocar una abre el editor REAL (`/mazos/[id]/tarjeta?cardId=N`): editar ahí
edita la tarjeta del mazo. En el detalle del mazo la híbrida lleva un pill
violeta "⚡ Idea". La tabla `connections` queda como registro interno de las
charlas (transcript); sigue viajando en el backup. No entra en `searchLibrary`.

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

**Respaldo** (`lib/backup.js` puro + `backupIO.js`): JSON versionado (v3) con
folders/decks/tags/deck_tags/cards/review_logs/connections/gym_chats/gym_messages
(NUNCA settings — ahí viven las claves). Los respaldos v1 (sin folders) y v2
(sin chats persistentes) siguen siendo restaurables: se normalizan las tablas
ausentes a arrays vacíos. Restore = reemplazo total transaccional conservando ids.
Web: descarga Blob / picker. Nativo: expo-file-system legacy + expo-sharing.
El automático semanal corre después de las interacciones iniciales y rota tres
archivos (`activecard-auto-1/2/3.json`) en vez de sobrescribir una única copia.

## Claves de API (`lib/keys.js`)
Caché en memoria inicializada en el root layout desde `settings`
(`openai_key` / `notion_token`); fallback a `process.env.EXPO_PUBLIC_*`.
- APK: usa `EXPO_PUBLIC_ACTIVECARD_AI_URL` para llamar a un gateway que conserva
  la clave real de OpenAI fuera del binario. La clave directa queda solo como
  fallback de desarrollo local.
- Web pública: el workflow buildea sin `.env`; el usuario pega su propia clave
  de OpenAI en Ajustes y queda guardada únicamente en ese navegador.

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
- **Calificación (3 niveles, F82)**: círculos ✕ (rojo, Again) / ~ (azul, Hard
  "Más o menos") / ✓ (verde, Good) estilo Quizlet; swipe izq/arriba/der al mismo
  mapeo. "Más o menos" avanza (cuenta como hecha, `DONE_TODAY_SQL` = `rating != 'again'`)
  pero FSRS la reprograma más cerca que Good.
- **Confeti sin Lottie / racha con flag**: ver "Cierre de sesión" y "Racha".
- **Teclado**: ActionSheet con listeners de Keyboard (Modal Android no se
  ajusta solo) + `statusBarTranslucent`; tarjeta.js con KeyboardAvoidingView.
- **Estrellas + orden manual + sheet de estudio**: migración v4, ver arriba.
- **Etapa 2 completa (F75-F77)**: ver "Editor Notion" arriba. `react-native-webview`
  es nativo → `app.json.version` pasó a **1.3.0** en el mismo commit (misma
  regla que con expo-linear-gradient en 1.1.0): los OTA posteriores quedan
  aislados al APK 1.3.0 y no rompen el 1.2.0 instalado.

## Rediseño F83: halo único, Progreso y topes diarios

**Tipografía.** Plus Jakarta Sans con **una familia por peso**: en RN `fontFamily` y
`fontWeight` no se combinan, así que el theme expone `font(N)` y toda la app lo usa en
lugar de `fontWeight`. Va por OTA porque `expo-font` ya estaba en el binario.

**Halo.** Un solo resplandor cobalto (`glow.halo`), encendido SOLO en pressed/hover vía
`GlowPressable` o la prop `halo` de `Button`. Blur máximo 18px y `HALO_PADDING` de aire en
los carriles con scroll: en Android el shadow se recorta contra el borde del padre.

**`db/stats.js`.** Todo derivado de `review_logs` y `cards`:
- `getRetentionSummary` / `getRetentionSeries` — % de notas que NO fueron `again`, sobre
  TODOS los modos, en ventana móvil de 30 días (y por semana para el gráfico).
- `getActivityMap` — repasos por día, para el heatmap de constancia.
- `getForecast` — cuántas vencen cada uno de los próximos días, excluyendo mazos pausados;
  lo atrasado se acumula en "hoy".
- `listWeakCards` / `countWeakCards` — las de más `lapses`.
- `getDeckRetention` — la misma cuenta acotada a un mazo (pill del detalle).

El agrupado por día/semana se hace **en JS**, nunca con `substr()` en SQL: `reviewed_at` y
`due` están en UTC y la app razona en hora local, así que un repaso de las 22:00 caería en
el día siguiente.

**Movimiento y gráficos (F84-F87).** `Sheen` barre una banda de luz cobalto inclinada
(`LinearGradient` + `translateX`, ciclo de 7 s) por encima del degradé del hero de Inicio;
es el único movimiento ambiental que queda y se detiene al perder foco. Reemplazó al
`BorderBeam`, la luz que recorría el contorno del hero y de las tres cards de Crear (se
leía inquieta — F87). `RetentionChart` usa una curva
cúbica SVG, área degradada y margen lateral para no cortar el último punto. La escalerita
de `Stagger` se rearma cada vez que una pantalla recupera foco.

**Topes diarios.** `settings.dailyLimits` se aplica al final de `buildDailyQueue`, sobre la
cola ya intercalada por stride: lo que queda afuera es lo de menor prioridad.

**Modo edición del mazo.** Solo la fila enfocada monta `NotionField` (un WebView por
instancia); el resto muestra `RichText` en una caja con pinta de input. Guarda al cambiar
de fila y ante `beforeRemove`. La pantalla incorpora buscador y filtros ⭐ / ⚡ Idea /
sin revisar / suspendidas.

## Runtime nativo 1.4.0

`react-native-svg` y `expo-notifications` se agregaron juntos y `app.json.version` pasó a
**1.4.0**. El recordatorio está apagado por defecto, usa 20:30 como hora inicial y solo
programa una notificación local cuando quedan tarjetas pendientes. Se cancela/reprograma
al abrir la app y al terminar una sesión; tocarla navega a `/repaso`. En Android crea
primero el canal `repaso-diario`, usa `notification-icon.png` (AC blanco/transparente
96×96) con tinte `#3E63DD` y revierte el switch si el permiso es rechazado. No usa
`SCHEDULE_EXACT_ALARM`: el horario es aproximado.

Esta tanda exige un APK nuevo: el 1.3.0 no contiene esos módulos y no puede recibirla por
OTA. El build lo dispara Martín con `comandos AC/CONSTRUIR-APP-ANDROID.bat`.

**Preflight F86.** El `.bat` exige confirmar un respaldo reciente, sesión EAS válida,
rama `main`, árbol tracked limpio y `HEAD == origin/main`; luego corre `npm ci`, Doctor,
ESLint sin warnings, Jest y export Android. Cualquier error corta antes de EAS Build.
CI replica Doctor, lint, tests y export Android. Los imports directos dejan el export en
34 assets / 8.985.782 bytes (antes 60 / 12.650.956).

## Runtime nativo 1.5.0

El dictado del Gimnasio usa Whisper Base multilingüe cuantizado (`ggml-base-q5_1.bin`)
completamente local mediante `whisper.rn` +
`@fugood/react-native-audio-pcm-stream`. El modelo (~60 MB) se descarga una sola vez
al almacenamiento privado de la app; no agranda el APK ni envía el audio a terceros.
La interfaz imita el flujo de WhatsApp: mantener para grabar, deslizar arriba para
bloquear, pausar/reanudar, descartar o aceptar; la transcripción queda editable en el
compositor. Al pausar se fuerza y espera el último corte antes de liberar el stream para
no perder las palabras finales. Web conserva el dictado disponible del navegador como
fallback. Estos módulos son nativos, por eso `app.json.version` pasó a **1.5.0** y exige
un APK nuevo antes de cualquier OTA de esta tanda.

## Limitaciones conocidas
- **`entering` de reanimated deja el contenido invisible si la animación no arranca**
  (`visibility: hidden` permanente). Por eso `Stagger` usa `Animated` de RN.
- Whisper local no funciona en Expo Go ni puede validarse por preview web: descarga,
  grabación, velocidad, temperatura y memoria deben probarse en el APK 1.5.0 sobre el
  Galaxy A15. La primera pulsación descarga el modelo; luego hay que mantener el
  micrófono otra vez para grabar.
- `lottie-react-native` no funciona en web → StreakFlame.web.js por extensión
  de plataforma (un require condicional no alcanza: Metro resuelve estático).
- PDF: `files.js` mantiene un tope preventivo de tamaño antes de convertir a base64.
- Metro + OneDrive: watch poco confiable → reiniciar el preview tras editar.
- El navegador embebido del preview retiene locks OPFS → verificar DB en
  Chrome real.
- **Notion en la web pública no funciona**: la API de Notion no habilita CORS
  para llamadas directas desde el navegador.
  Falla con error de red al primer fetch. Es una limitación de la API de
  Notion, no arreglable sin un backend propio (descartado por diseño). En web,
  usar la fuente "Archivo" con un Markdown exportado desde Notion; la
  conexión directa solo funciona en el APK.
