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
│   ├── (tabs)/index.js         # Inicio: racha + engranaje→Ajustes + hero "Repaso de hoy"
│   │                           #   + "Seguir estudiando" (mazos con progreso parcial)
│   ├── (tabs)/crear.js         # fuentes: texto | archivo | Notion | Quizlet (pegar export)
│   ├── (tabs)/biblioteca.js    # buscador (carpetas/mazos/tarjetas) + grilla de carpetas
│   │                           #   + mazos sueltos (DeckListItem) + filtro etiquetas
│   ├── repaso.js               # repaso diario (FSRS + Gimnasio Mental), swipe unificado
│   ├── crear/preseleccion.js   # revisar/editar (RichField) antes de guardar
│   ├── mazos/[id]/index.js     # detalle: tarjetas, tags, carpeta, PercentSlider, IconPicker
│   ├── mazos/[id]/estudiar.js  # modo Quizlet: excluye lo hecho hoy, ronda de falladas
│   ├── mazos/[id]/tarjeta.js   # editor manual (RichField frente/dorso)
│   ├── carpetas/[id]/index.js  # carpeta: sus mazos, agregar/quitar, renombrar, borrar
│   ├── ajustes.js              # prioridades %, Respaldo, Claves (solo web), conexiones
│   └── conexiones.js           # conexiones validadas del Gimnasio
├── db/                         # SQLite async: client (retry OPFS), schema (migraciones),
│   │                           #   decks, folders, cards, settings, connections,
│   │                           #   reviewQueue, streak, progress
├── lib/                        # claude, prompts, generator, auditor, notion, files,
│   │                           #   scheduler (ts-fsrs), queue (stride), streak (puro),
│   │                           #   studySession, richtext, quizletImport, backup(IO),
│   │                           #   keys, search (buscador puro de la Biblioteca)
├── components/                 # ui.js (Screen/Button/Field/Chip/Card/Pill/InlineAdd),
│   │                           #   FlipCard, SwipeCard, DeckListItem, MicButton,
│   │                           #   ChatAuditor, ProgressBar, StreakFlame(.web),
│   │                           #   PercentSlider, IconPicker, RichText, RichField
└── theme/                      # colors (azul #3E63DD + paleta), textColors, spacing,
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

**Rich text** (`lib/richtext.js`): marcas dentro del mismo TEXT —
`**b**  *i*  __u__  ==hl==  [[color:texto]]` (claves de theme.textColors) y
líneas "- " como viñetas. `parseRich` → bloques/spans anidables; marca sin
cierre = literal. `toPlainText` para previews e IA. El editor (RichField)
muestra la barrita al seleccionar y aplica `wrapSelection`/`wrapColor`/
`toggleListLines` sobre el rango.

**Generación IA**: texto | TXT/MD local | PDF→base64 como bloque `document` |
página de Notion → prompt generador → JSON {cards} → preselección → FSRS.
**Import Quizlet** (`lib/quizletImport.js`): pega el export (tab/nueva línea
por defecto, separadores configurables) → mismas pantallas, sin IA.

**Gimnasio Mental**: chat multi-turno con el Auditor (JSON
{veredicto, feedback, hybrid_card}). Al validar: inserta en `connections` +
tarjeta híbrida (source 'hybrid', mismo mazo) que entra a FSRS.

**Carpetas** (`db/folders.js`): nivel de organización sobre los mazos.
Biblioteca = grilla de carpetas (tiles con nombre + cantidad) arriba y mazos
sueltos abajo; pantalla `carpetas/[id]` gestiona sus mazos; el detalle del
mazo tiene chips de carpeta con toggle. Las etiquetas siguen siendo solo
filtro/búsqueda (las carpetas no llevan tags).

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
