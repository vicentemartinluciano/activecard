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
│   ├── (tabs)/index.js         # Inicio: fila fina (racha izq. + engranaje der., sin título)
│   │                           #   + hero "Repaso de hoy" (LinearGradient) + "Seguir estudiando"
│   ├── (tabs)/crear.js         # fuentes: texto | archivo | Notion (tiles simétricos);
│   │                           #   extracción: conceptos_clave | completo | personalizado
│   ├── (tabs)/biblioteca.js    # buscador + botón "+" (ActionSheet: Mazo/Carpeta) + grilla de
│   │                           #   carpetas (con tile virtual "Gimnasio Mental" si hay
│   │                           #   conexiones) + mazos sueltos (DeckListItem) + filtro etiquetas
│   ├── repaso.js               # repaso diario (FSRS + Gimnasio Mental), swipe unificado
│   ├── crear/preseleccion.js   # revisar/editar (RichField) antes de guardar
│   ├── mazos/[id]/index.js     # detalle: botones grandes Estudiar/Nueva tarjeta, menú "..."
│   │                           #   (ActionSheet: Renombrar/Editar detalles/Borrar) que revela
│   │                           #   tags, carpeta, PercentSlider, IconPicker
│   ├── mazos/[id]/estudiar.js  # modo Quizlet: excluye lo hecho hoy, ronda de falladas
│   ├── mazos/[id]/tarjeta.js   # editor manual (RichField frente/dorso)
│   ├── carpetas/[id]/index.js  # carpeta real: sus mazos, agregar/quitar, renombrar, borrar
│   ├── carpetas/gimnasio.js    # carpeta VIRTUAL: mazos con conexiones (derivada, no es fila
│   │                           #   de `folders`; ruta estática, no colisiona con [id])
│   ├── ajustes.js              # prioridades %, Respaldo, Claves (solo web), conexiones
│   └── conexiones.js           # conexiones validadas del Gimnasio (?deckId= filtra por mazo)
├── db/                         # SQLite async: client (retry OPFS), schema (migraciones),
│   │                           #   decks, folders, cards, settings, connections,
│   │                           #   reviewQueue, streak, progress
├── lib/                        # claude, prompts (+ instrucción personalizada), generator,
│   │                           #   auditor, notion, files, scheduler (ts-fsrs), queue (stride),
│   │                           #   streak (puro), studySession, richtext, backup(IO),
│   │                           #   keys, search (buscador puro de la Biblioteca)
├── components/                 # ui.js (Screen/Button[kind+size]/Field/Chip/Card/Pill/InlineAdd),
│   │                           #   ActionSheet (bottom sheet: menús y "+"), FlipCard, SwipeCard,
│   │                           #   DeckListItem, MicButton, ChatAuditor, ProgressBar(+gradient),
│   │                           #   StreakFlame(.web), PercentSlider, IconPicker, RichText, RichField
└── theme/                      # colors (Obsidian Cobalt: bg #09090B, cards #151518,
                                #   cardBorder translúcido, azul #3E63DD + paleta), gradients
                                #   (bar cobalto→cian, hero), textColors, spacing,
                                #   radius (sm10/md16/lg20/pill), type (+heading/label)
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

**Rich text** (`lib/richtext.js`, refactor F30-F33): marcas dentro del mismo
TEXT — `**b**  *i*  __u__  ==hl==  [[color:texto]]` (claves de
theme.textColors, anidables sin límite: `**[[azul:x]]**`) y líneas "- " como
viñetas. Núcleo = parser recursivo indexado (`parseRegion`/`parseIndexed`):
además de los spans registra el rango exacto en el string fuente de cada
tramo de texto y de cada par de marcas — de ahí salen `parseRich` (API
pública sin offsets, retrocompatible byte a byte con el corpus viejo) y
`toPlainText` (para previews/IA/buscador, sigue quitando TODO). Sobre ese
núcleo:
- `buildEditMap(text)` → `{ display, segments }`: `display` es el texto SIN
  marcadores (conserva "- " y "\n"); `displayToSource`/`sourceToDisplay`
  traducen índices entre ambos espacios.
- `toggleMark`/`setColor`: edición "modelo → serialización" — parten los
  tramos por la selección, mutan los estilos y re-serializan a markup
  balanceado (soporta partir un run al medio: `**left SEL right**` →
  `**left**SEL**right**`). `setColor` reemplaza la clave de color en vez de
  anidar. `getActiveMarks` da el estado de formato de un rango (para la
  barra). `wrapSelection`/`wrapColor`/`toggleListLines` quedan como legado.
- `editSource`/`diffDisplays`: traducen una edición hecha sobre el texto
  visible (sin marcadores) al string fuente — borrado que preserva marcas
  intermedias, inserción con bias izquierdo, limpieza de pares vacíos.

**Editor (`components/RichField.js`)**: sin panel de "Vista previa" — el
campo es el único elemento. El TextInput muestra `buildEditMap(value).display`
con texto transparente; detrás, una capa fantasma (`pointerEvents="none"`)
renderiza esos mismos caracteres con los estilos de cada tramo (negrita
simulada con `textShadow` para no desalinear el caret; cursiva/subrayado/
resaltado/color reales) — como ambas capas comparten tipografía y padding,
el caret cae sobre el glifo estilizado. Aplicar/quitar formato no cambia el
display (los marcadores son invisibles) → no hay salto de caret ni pérdida
de foco; solo el toggle de lista o el colapso de un marcador tipeado a mano
reponen la selección por un único render (`forcedSelection`). Barra de
formato: píldora flotante glass (`pillBg`/`pillBorder`, sin `expo-blur` —
JS puro, sale por OTA), íconos Feather, estado "encendido" por marca vía
`getActiveMarks`; se posiciona solapando el borde superior del propio campo
(no por completo afuera) para no quedar recortada por el `ScrollView`
cuando el campo está pegado arriba de la pantalla.

**Generación IA**: texto | TXT/MD local | PDF→base64 como bloque `document` |
página de Notion → prompt generador → JSON {cards} → preselección → FSRS.
Extracción: `conceptos_clave` | `completo` | `personalizado` (instrucción libre
del usuario, concatenada en el mensaje user vía `buildGeneratorMessage({..,
custom})`/`buildGeneratorPdfPrompt(mode, custom)` — el system prompt queda fijo
y cacheable). Import de Quizlet eliminado (F23): las fuentes son texto,
archivo y Notion.

**Gimnasio Mental**: chat multi-turno con el Auditor (JSON
{veredicto, feedback, hybrid_card}). Al validar: inserta en `connections` +
tarjeta híbrida (source 'hybrid', mismo mazo) que entra a FSRS.

**Carpetas** (`db/folders.js`): nivel de organización sobre los mazos.
Biblioteca = grilla de carpetas (tiles con nombre + cantidad) arriba y mazos
sueltos abajo; pantalla `carpetas/[id]` gestiona sus mazos; el detalle del
mazo tiene chips de carpeta con toggle. Las etiquetas siguen siendo solo
filtro/búsqueda (las carpetas no llevan tags). Se crean/renombran desde el
botón "+" de la Biblioteca (`ActionSheet` → Mazo/Carpeta), no hay más
InlineAdd suelto en la pantalla.

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
Dos usos: botón "+" de la Biblioteca (crear Mazo/Carpeta) y menú "..." del
header en el detalle de mazo (Renombrar/Editar detalles/Borrar — "Editar
detalles" togglea la visibilidad de la card de tags/carpeta/prioridad/ícono,
oculta por defecto). Es el único patrón de overlay de la app; no crear otros
Modal/ActionSheet ad-hoc.

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
degradados cobalto→cian (`theme.gradients.bar`) en las barras de progreso por
mazo vía `expo-linear-gradient` (prop `gradient` de `ProgressBar`, además del
`color` sólido de siempre) y degradado azul profundo (`gradients.hero`) en el
hero de Inicio. `expo-linear-gradient` es módulo nativo → se bumpeó
`app.json.version` a `1.1.0` en el mismo commit que lo instaló: con
`runtimeVersion.policy: "appVersion"`, los OTA posteriores solo llegan al APK
que se compile con ese runtime — el APK 1.0.0 no se rompe por un módulo nativo
que no tiene.

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
