# Contexto completo de ActiveCard (para pegarle a una IA)

> Este archivo es **autocontenido**: la idea es poder pegarlo entero al arrancar
> una conversación con cualquier IA (Claude, ChatGPT, etc.) y que quede con
> contexto de producto + arquitectura + convenciones sin tener que leer código.
> Si algo de acá queda desactualizado, el código manda — pero avisá para
> corregir este archivo también. Se complementa con `CLAUDE.md` (router corto
> para Claude Code) y `docs/ARQUITECTURA.md` (versión resumida de esto mismo).

---

## 1. Qué es ActiveCard

App **personal y privada** de aprendizaje a largo plazo. Un solo usuario real
(el dueño del proyecto). No se publica en ninguna tienda de apps: se instala
como APK propio en el celular y se actualiza por **EAS Update (OTA)**, sin
pasar por Play Store.

Combina dos mecanismos de aprendizaje:

1. **Repetición espaciada (spaced repetition)** con el algoritmo **FSRS**
   (Free Spaced Repetition Scheduler, vía la librería `ts-fsrs`), calificación
   **binaria**: "Lo recordaba" (Good) / "No lo recordaba" (Again). Sin escalas
   de 1-5 ni "fácil/difícil": simplifica la decisión en cada repaso.
2. **"Gimnasio Mental"**: un chat con una IA ("el Auditor") que exige al
   usuario **conectar** el concepto que acaba de repasar con otra idea, libro,
   materia o vivencia personal — para forzar comprensión profunda, no solo
   memorización. Las conexiones validadas se guardan y generan una tarjeta
   "híbrida" que también entra al ciclo de repetición espaciada.

Todos los datos viven **100% en el dispositivo** (SQLite vía `expo-sqlite`).
No hay backend propio, no hay cuenta de usuario, no hay sync automático entre
dispositivos (el puente es un respaldo manual en JSON, ver §7).

---

## 2. Decisiones de producto (tomadas — no re-litigar sin el usuario)

- **Identificador de la app Android**: `com.marti.activecard`. Es
  **irreversible** una vez que hay un OTA activo (cambiarlo rompe las
  actualizaciones de los usuarios existentes — en este caso, del dueño mismo).
- **IA: un solo proveedor, un solo modelo — Claude Sonnet 5** (`claude-sonnet-5`)
  para TODO: generación de tarjetas y auditoría de conexiones. No hay
  fallback a otros modelos ni proveedores.
- **API keys en `.env`** (gitignoreado), variables
  `EXPO_PUBLIC_ANTHROPIC_API_KEY` y `EXPO_PUBLIC_NOTION_TOKEN`. En builds de
  EAS van como env vars del proyecto (embebidas en el APK).
- **Datos 100% locales** en SQLite. Se descartó explícitamente sincronizar
  con una base de Notion ("Conexiones Creadas") — Notion solo se usa como
  *fuente de lectura* para importar material de estudio, nunca como storage.
- **Fuentes para crear tarjetas**:
  - Texto pegado directo.
  - Archivo por document picker: PDF va **en base64 directo a Claude** como
    bloque `document` de la Messages API (Claude lee el PDF nativamente); TXT/MD
    se leen localmente y se mandan como texto.
  - Página de Notion vía **internal integration token** (sin flujo OAuth).
  - Importación de **Quizlet**: pegar el texto exportado (sin IA).
- **FSRS con calificación binaria**: Good/Again únicamente.
- **Mazos** (deck): cada tarjeta pertenece a exactamente 1 mazo. Cada mazo
  tiene un **ícono Feather** y una **prioridad 0-100%** (slider, pasos de 5).
  - 0% = mazo pausado (no entra al repaso diario).
  - El resto pondera qué tan seguido aparecen sus tarjetas en la cola diaria
    intercalada (stride scheduling proporcional al %, ver §5).
  - Esto **reemplazó** un viejo "Modo Enfoque" y un sistema de prioridades
    mensuales (tabla `priorities`, hoy huérfana en la DB — no se borró, se dejó
    de usar).
  - **Etiquetas (tags)** son sobre mazos, no sobre tarjetas, y sirven
    **solo como filtro en la Biblioteca** — no afectan el algoritmo.
- **2 modos de estudio**:
  1. **Repaso diario**: la cola FSRS global (todas las debidas de todos los
     mazos activos, intercaladas) + Gimnasio Mental después de cada tarjeta.
  2. **Mazo específico estilo Quizlet**: swipe de tarjetas de un solo mazo,
     alimenta FSRS igual, **sin** Gimnasio Mental. La sesión excluye lo que ya
     se estudió hoy en ese modo, y al final ofrece una ronda extra opcional de
     las falladas (que también califica en FSRS — decisión de producto: la
     recuperación cuenta).
- **Racha**: ≥1 tarjeta repasada por día (en cualquiera de los 2 modos)
  mantiene la racha viva. Se deriva de `review_logs`, sin tabla propia.
  Animación con Lottie en nativo (no funciona en web, ver §9).
- **Progreso diario por mazo**: derivado de `review_logs` (modo quizlet) del
  día, se reinicia solo al otro día. Sin tabla/estado propio.
- **Gimnasio Mental**: chat de texto iterativo con el Auditor (IA exigente
  pero constructiva). Micrófono **opcional** vía speech-to-text nativo de
  Android (sin API extra ni costo). Al validar una conexión: se guarda en
  `connections` y se crea una tarjeta híbrida (`source='hybrid'`, mismo mazo
  que la tarjeta original) que entra al ciclo FSRS. **Siempre salteable** —
  nunca bloquea el repaso.
- **Generación con IA es opcional**: siempre se puede crear tarjetas a mano,
  o importar desde un export de Quizlet pegando el texto. Regla de oro:
  **preservar mnemotecnias del usuario textualmente** (siglas, historias,
  ganchos de memoria que el usuario ya inventó) — son más valiosas que
  cualquier resumen que genere la IA.
- **Rich text en tarjetas**: marcado liviano dentro del mismo campo `TEXT`
  (no HTML, no campos separados). Ver sintaxis completa en §6.
- **Respaldo manual** (pantalla Ajustes): exporta/importa un JSON con todos
  los datos de aprendizaje (nunca `settings` — ahí viven las API keys). Es el
  único puente entre celular y web; no hay sync automático.
- **Versión web pública** en GitHub Pages (repo público, workflow
  `deploy-web.yml`, `baseUrl=/activecard`). El build de la web corre **sin**
  `.env`, así que las API keys **no** quedan embebidas en el bundle público:
  el usuario las pega a mano en Ajustes (sección visible solo en web) y viven
  en el `settings` del navegador. En el APK nativo sí van embebidas vía env
  vars de EAS.
- **Sin notificaciones push**: la app es pasiva, el usuario decide cuándo
  entrar.
- **UI estilo Quizlet** sobre fondo casi negro (`#0B0B0F`), acento azul
  profundo (`#3E63DD`) + paleta de apoyo (racha en naranja, colores de texto
  para rich text). Bottom tabs: Inicio / Crear / Biblioteca. Engranaje →
  Ajustes. **Todo el copy de la app está en español.**

---

## 3. Stack técnico

- **React Native 0.86 + Expo SDK 57** (managed workflow), `expo-router` ~57
  para navegación basada en archivos.
- **JavaScript puro** (no TypeScript en el código de la app — hay
  `tsconfig.json` mínimo solo para que el editor tipee lo que puede, pero no
  hay chequeo de tipos en CI).
- **expo-sqlite ~57** en modo **async únicamente** (ver trampas en §9).
- **ts-fsrs ^5.4.1** para el algoritmo de repetición espaciada.
- **lottie-react-native** para la animación de racha (solo nativo).
- **@jamsch/expo-speech-recognition** para el micrófono del Gimnasio Mental
  (solo funciona en el APK compilado, no en Expo Go ni web).
- **react-native-reanimated 4 + react-native-gesture-handler** para el swipe
  del modo Quizlet y las animaciones de FlipCard.
- Sin Redux ni Zustand ni React Query: estado local con hooks + acceso directo
  a SQLite desde las pantallas vía los módulos de `src/db/`.
- **Jest + jest-expo** para tests; **ESLint** (`eslint-config-expo`) para lint.
- **EAS Build/Update** para builds nativos y despliegue OTA.
- API de Claude: **fetch directo**, sin SDK de Anthropic (ver `src/lib/claude.js`).

---

## 4. Estructura de carpetas (archivo por archivo)

```
src/
├── app/                              # rutas de expo-router (file-based)
│   ├── _layout.js                    # Stack raíz; initKeys() al montar (carga API keys en memoria)
│   ├── (tabs)/_layout.js             # Bottom tabs: Inicio / Crear / Biblioteca (íconos Feather)
│   ├── (tabs)/index.js               # Inicio: racha (StreakFlame) + engranaje→Ajustes
│   │                                 #   + hero "Repaso de hoy" + "Seguir estudiando"
│   │                                 #   (mazos con progreso parcial hoy)
│   ├── (tabs)/crear.js               # elegir fuente: texto | archivo | Notion | Quizlet
│   ├── (tabs)/biblioteca.js          # lista de mazos (ícono, progreso diario, badge %)
│   │                                 #   + filtro por etiquetas
│   ├── repaso.js                     # REPASO DIARIO: cola FSRS global + Gimnasio Mental
│   ├── crear/preseleccion.js         # revisar/editar tarjetas generadas (RichField) antes
│   │                                 #   de guardarlas definitivamente
│   ├── mazos/[id]/index.js           # detalle de mazo: tarjetas, tags, PercentSlider
│   │                                 #   (prioridad), IconPicker, progreso diario
│   ├── mazos/[id]/estudiar.js        # MODO QUIZLET de ese mazo: swipe, excluye lo hecho
│   │                                 #   hoy, ronda extra de falladas al final
│   ├── mazos/[id]/tarjeta.js         # editor manual de una tarjeta (RichField frente/dorso)
│   ├── ajustes.js                    # prioridades %, Respaldo (export/import), Claves
│   │                                 #   (API keys — solo visible en web), ver conexiones
│   └── conexiones.js                 # listado de conexiones validadas del Gimnasio Mental
│
├── db/                                # capa de acceso a SQLite (todo async)
│   ├── client.js                     # apertura de la conexión, con reintento ante locks OPFS
│   ├── schema.js                     # migraciones versionadas (PRAGMA user_version)
│   ├── decks.js                      # CRUD de mazos (nombre, ícono, prioridad, tags)
│   ├── cards.js                      # CRUD de tarjetas + campos de estado FSRS
│   ├── settings.js                   # tabla key/value genérica (API keys, prefs)
│   ├── connections.js                # CRUD de conexiones del Gimnasio Mental
│   ├── reviewQueue.js                 # consultas para armar la cola de repaso diario
│   ├── streak.js                     # consulta de fechas con actividad (para lib/streak.js)
│   └── progress.js                   # progreso diario por mazo (COUNT sobre review_logs)
│
├── lib/                               # lógica de negocio, mayormente pura/testeable
│   ├── claude.js                     # cliente único de la API de Claude (fetch directo)
│   ├── prompts.js                    # TODOS los prompts de sistema (generador + auditor)
│   ├── generator.js                  # generación de tarjetas desde texto o PDF
│   ├── auditor.js                    # lógica del Gimnasio Mental (llama a Claude, valida JSON)
│   ├── notion.js                     # fetch de una página de Notion vía integración interna
│   ├── files.js                      # lectura de archivos (TXT/MD locales, PDF a base64)
│   ├── scheduler.js                  # wrapper sobre ts-fsrs (aplicar Good/Again a una tarjeta)
│   ├── queue.js                      # cola diaria PURA: stride scheduling por prioridad de mazo
│   ├── streak.js                     # cálculo PURO de racha a partir de fechas activas
│   ├── studySession.js               # lógica del modo Quizlet (pool del día, ronda de falladas)
│   ├── richtext.js                   # parser + serializer del rich text liviano (ver §6)
│   ├── quizletImport.js              # parseo del texto exportado de Quizlet
│   ├── backup.js                     # lógica PURA de export/import (arma/valida el JSON)
│   ├── backupIO.js                   # I/O de la lógica anterior (Blob en web, file-system+sharing en nativo)
│   ├── keys.js                       # caché en memoria de las API keys (settings > env vars)
│   └── draftStore.js                 # estado temporal entre pantallas (ej: tarjetas generadas
│                                      #   pendientes de preselección)
│
├── components/
│   ├── ui.js                         # primitivos de UI compartidos (botones, inputs, etc.)
│   ├── FlipCard.js                   # tarjeta que se voltea (frente/dorso) del repaso diario
│   ├── SwipeCard.js                  # tarjeta swipeable del modo Quizlet
│   ├── MicButton.js                  # botón de dictado por voz (se oculta en web)
│   ├── ChatAuditor.js                # UI del chat del Gimnasio Mental
│   ├── ProgressBar.js                # barra de progreso diario por mazo
│   ├── StreakFlame.js / .web.js      # animación de racha (Lottie nativo / ícono estático web)
│   ├── PercentSlider.js              # slider de prioridad de mazo (0-100, pasos de 5)
│   ├── IconPicker.js                 # selector de ícono Feather para un mazo
│   ├── RichText.js                   # renderer de solo lectura del rich text
│   └── RichField.js                  # editor de rich text con barrita de formato al seleccionar
│
└── theme/
    └── index.js                      # colors, textColors, spacing, radius, type (tokens de diseño)
```

Tests: `**/__tests__/*.test.js`, colocados junto al módulo que testean
(`src/db/__tests__/`, `src/lib/__tests__/`, `src/theme/__tests__/`).

---

## 5. Esquema SQLite completo

Migraciones versionadas en `src/db/schema.js` vía `PRAGMA user_version`.
**Regla dura: nunca editar una migración ya aplicada — solo agregar una nueva
al final del array** (los dispositivos ya instalados corrieron las viejas).

### v1 — esquema inicial

```sql
decks(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  created_at TEXT NOT NULL
)

tags(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE
)

deck_tags(
  deck_id INTEGER REFERENCES decks(id) ON DELETE CASCADE,
  tag_id INTEGER REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (deck_id, tag_id)
)

cards(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  deck_id INTEGER NOT NULL REFERENCES decks(id) ON DELETE CASCADE,
  front TEXT NOT NULL,               -- rich text liviano (ver §6)
  back TEXT NOT NULL,                -- rich text liviano
  source TEXT NOT NULL DEFAULT 'manual',   -- 'manual' | 'ai' | 'hybrid'
  origin_card_id INTEGER,            -- si es híbrida, referencia a la tarjeta que la originó
  created_at TEXT NOT NULL,
  -- estado FSRS (ts-fsrs):
  due TEXT NOT NULL,
  stability REAL NOT NULL DEFAULT 0,
  difficulty REAL NOT NULL DEFAULT 0,
  elapsed_days INTEGER NOT NULL DEFAULT 0,
  scheduled_days INTEGER NOT NULL DEFAULT 0,
  reps INTEGER NOT NULL DEFAULT 0,
  lapses INTEGER NOT NULL DEFAULT 0,
  learning_steps INTEGER NOT NULL DEFAULT 0,
  state INTEGER NOT NULL DEFAULT 0,
  last_review TEXT
)
-- índices: idx_cards_due(due), idx_cards_deck(deck_id)

review_logs(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  card_id INTEGER NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
  rating TEXT NOT NULL,              -- 'good' | 'again'
  mode TEXT NOT NULL,                -- 'daily' | 'quizlet'
  reviewed_at TEXT NOT NULL
)

connections(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  card_id INTEGER NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
  final_text TEXT NOT NULL,          -- la conexión validada, tal cual la escribió el usuario
  transcript TEXT,                   -- historial completo del chat con el Auditor (JSON)
  hybrid_card_id INTEGER,            -- tarjeta híbrida generada al validar
  created_at TEXT NOT NULL
)

priorities(                          -- HUÉRFANA desde v2, no se borra ni se usa
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  target_type TEXT NOT NULL,
  target_id INTEGER NOT NULL,
  weight INTEGER NOT NULL DEFAULT 1,
  month TEXT NOT NULL,
  UNIQUE (target_type, target_id, month)
)

settings(
  key TEXT PRIMARY KEY,
  value TEXT
)
```

### v2 — prioridad porcentual e ícono por mazo

```sql
ALTER TABLE decks ADD COLUMN priority INTEGER NOT NULL DEFAULT 100; -- 0-100, pasos de 5
ALTER TABLE decks ADD COLUMN icon TEXT;                             -- nombre de ícono Feather
```

Reemplazan al viejo "Modo Enfoque" y a `focus_deck_ids` (ya eliminados del
código; la tabla `priorities` queda en la DB por prolijidad de migración pero
no se lee ni se escribe más).

---

## 6. Flujos núcleo (paso a paso)

### Cola diaria (`lib/queue.js`, función pura, sin acceso a DB)
1. Se descartan los mazos con prioridad 0% (pausados).
2. De los mazos activos, se toman las tarjetas cuyo `due` cae hasta el **fin
   del día actual** (23:59:59.999 local) — o sea, "debida hoy a cualquier
   hora" ya cuenta, no hace falta que haya pasado la hora exacta.
3. Dentro de cada mazo, se ordenan por más vencida primero.
4. Se intercalan entre mazos por **stride scheduling determinístico**: cada
   mazo tiene un "paso" = `100000 / prioridad`. En cada iteración se emite la
   tarjeta del mazo con menor "recorrido" acumulado (empate → menor `deckId`,
   para que el orden sea reproducible). Resultado: un mazo al 100% aparece
   **el doble** de seguido que uno al 50%, con ritmo parejo desde la primera
   tarjeta (no al final).

### Repaso diario (`app/repaso.js`)
Frente → tocar para voltear (`FlipCard`) → calificar Good/Again
(`reviewCard`, guarda en `review_logs` con `mode='daily'` y recalcula el
estado FSRS) → Gimnasio Mental (salteable) → siguiente tarjeta de la cola.

### Modo mazo / Quizlet (`app/mazos/[id]/estudiar.js`, `lib/studySession.js`)
- Pool = tarjetas del mazo que **no** fueron repasadas hoy en modo `'quizlet'`
  (`progress.listDeckCardsNotReviewedToday`).
- Swipe o botones para calificar → llama a `reviewCard` igual que el modo
  diario, pero con `mode='quizlet'`.
- Al terminar el pool, si hubo falladas: se ofrece una **ronda extra
  opcional y repetible** solo con esas — y esa recuperación **también**
  llama a `reviewCard` (decisión de producto explícita: la recuperación
  cuenta para el algoritmo FSRS, no es "gratis").
- Si el mazo ya está al 100% de progreso del día, se ofrece "Estudiar de
  nuevo" con el mazo completo (repaso libre, sin restricción de "no
  repasado hoy").

### Racha (`lib/streak.js` puro + `db/streak.js`)
Días consecutivos con ≥1 fila en `review_logs` (agrupado por fecha local
`YYYY-MM-DD`). Si hoy todavía no se repasó pero ayer sí, la racha **sigue
viva** — no se corta hasta que efectivamente termine el día sin actividad.
`StreakFlame` la anima (Lottie en nativo, ícono estático en `StreakFlame.web.js`
para web).

### Progreso diario por mazo (`db/progress.js`)
`COUNT(DISTINCT card_id)` de `review_logs` de **hoy** en modo `quizlet`,
dividido por el total de tarjetas del mazo. Sin estado propio — se recalcula
siempre desde `review_logs`, así que se "reinicia" solo al otro día.

### Rich text liviano (`lib/richtext.js`)
Marcas dentro del mismo `TEXT` de `front`/`back` (no HTML, no JSON de bloques):

| Marca | Efecto |
|---|---|
| `**texto**` | negrita |
| `*texto*` | cursiva |
| `__texto__` | subrayado |
| `==texto==` | resaltado (fondo ámbar) |
| `[[color:texto]]` | color de texto (`rojo`, `naranja`, `amarillo`, `verde`, `azul`, `violeta` — claves de `theme.textColors`) |
| línea que empieza con `"- "` | ítem de lista |

`parseRich(text)` → árbol de bloques/spans anidables (una marca sin su cierre
correspondiente se trata como texto literal, no rompe el parseo).
`toPlainText(text)` → texto sin marcas, usado para previews cortos y para lo
que se le manda a la IA (nunca se le manda markup a Claude).
El editor `RichField` muestra una barrita de formato al seleccionar texto y
aplica `wrapSelection` / `wrapColor` / `toggleListLines` sobre el rango
seleccionado.

### Generación de tarjetas con IA (`lib/generator.js` + `lib/prompts.js`)
Fuente (texto pegado, TXT/MD local, PDF en base64, o texto extraído de una
página de Notion) → prompt del generador → Claude responde JSON
`{"cards": [{"front": "...", "back": "..."}]}` → pantalla de preselección
(`crear/preseleccion.js`, editable con `RichField`) → al confirmar, se
insertan en `cards` con `source='ai'` y entran al ciclo FSRS.

Hay dos modos de generación:
- **`conceptos_clave`**: solo los 5-15 conceptos más nucleares del material.
- **`completo`**: cobertura exhaustiva de todos los conceptos con nombre
  propio presentes en el material (sin inventar los que no están).

Regla de oro del prompt (textual, es producto — ver el system prompt
completo más abajo en §8): **extraer solo conceptos nucleares** (modelos
teóricos, principios con nombre propio, clasificaciones), nada de trivia ni
fechas sueltas; frente = pregunta directa que obligue a recuperar el concepto
entero (nunca sí/no ni completar palabra); dorso = respuesta concisa y
completa; y **preservar textualmente** cualquier mnemotecnia, sigla o
analogía que el usuario haya metido en el material fuente.

### Importación de Quizlet (`lib/quizletImport.js`)
Pega el texto que Quizlet exporta (separador de tarjeta = nueva línea,
separador frente/dorso = tab, ambos configurables) → mismo flujo de
preselección que la generación IA, pero **sin** llamar a Claude.

### Gimnasio Mental / Auditor (`lib/auditor.js` + `lib/prompts.js`)
Chat multi-turno: el usuario propone una conexión entre el concepto recién
repasado y otra idea/materia/vivencia. El Auditor (Claude) responde SIEMPRE
en JSON `{"veredicto": "valida"|"critica", "feedback": "...", "hybrid_card": {...}|null}`.

- **`critica`**: la conexión es floja, vaga o superficial (asociación de
  palabras que "suenan parecido" sin lógica real). El Auditor explica
  exactamente qué falta y hace una pregunta puntual para refinarla —
  **nunca da la respuesta él mismo**.
- **`valida`**: la conexión es sólida y específica. Reconoce qué la hace
  buena (1-2 frases) y genera la `hybrid_card` (front = pregunta que obliga a
  recuperar la conexión; back = síntesis en las palabras del usuario,
  mejoradas al mínimo).

Al validar: se inserta una fila en `connections` (con el transcript completo
del chat) + una tarjeta nueva `source='hybrid'` en el mismo mazo que la
original, que entra a FSRS igual que cualquier otra.

Es **siempre salteable** desde cualquier punto del chat — nunca bloquea
avanzar al siguiente repaso.

### Respaldo manual (`lib/backup.js` puro + `lib/backupIO.js`)
Exporta un JSON versionado con `decks` + `tags` + `deck_tags` + `cards` +
`review_logs` + `connections` — **nunca** `settings` (ahí viven las API
keys, no deben viajar en un backup que se pueda compartir). El restore es un
**reemplazo total transaccional** que conserva los IDs originales (para que
`review_logs.card_id` y demás foreign keys sigan siendo válidas).
En web se implementa como descarga de un `Blob` / `<input type=file>`; en
nativo con `expo-file-system` (API legacy) + `expo-sharing`.

---

## 7. Claves de API (`lib/keys.js`)

Caché en memoria, inicializado en el layout raíz (`app/_layout.js`, función
`initKeys()`) leyendo primero de la tabla `settings`
(`anthropic_key`, `notion_token`); si no hay nada guardado ahí, cae a
`process.env.EXPO_PUBLIC_ANTHROPIC_API_KEY` / `EXPO_PUBLIC_NOTION_TOKEN`.

- **APK nativo**: las env vars van embebidas en el build (configuradas como
  env vars del proyecto en EAS) — el usuario final no necesita tocar nada.
- **Web pública** (GitHub Pages): el workflow de deploy buildea **sin**
  `.env`, así que no hay claves embebidas en el bundle público. El usuario
  las pega manualmente en Ajustes → Claves (sección que **solo aparece en
  web**) y quedan en la tabla `settings` del navegador (persistidas vía
  SQLite/OPFS del propio navegador, no se mandan a ningún servidor).

## Cliente de la API de Claude (`lib/claude.js`)

- `fetch` directo a `https://api.anthropic.com/v1/messages`, **sin SDK**.
- Modelo fijo: `export const MODEL = "claude-sonnet-5"`.
- Header `anthropic-dangerous-direct-browser-access: true` para poder llamar
  directo desde el preview/build web (evita el bloqueo CORS de navegador; en
  Android no aplica, ahí no hay CORS).
- `callClaude({ system, messages, maxTokens })` → devuelve el texto plano de
  la respuesta.
- `extractJson(text)` → extrae el primer objeto JSON balanceado de una
  respuesta (tolera que venga envuelto en \`\`\`json\`\`\` o con prosa
  alrededor).
- `callClaudeJson({ system, messages, maxTokens })` → llama, intenta
  parsear JSON, y si falla hace **un reintento** pidiéndole a Claude
  explícitamente que responda solo con el JSON.
- Manejo de errores mapeado a mensajes en español: sin API key, 401 (key
  inválida), 429 (rate limit), sin conexión a internet, JSON incompleto.

---

## 8. Prompts de IA (texto completo — es producto, no detalle de implementación)

### Generador de tarjetas (`GENERATOR_SYSTEM` en `src/lib/prompts.js`)

```
Sos el motor de creación de tarjetas de estudio de ActiveCard, una app
personal de aprendizaje a largo plazo basada en active recall.

Tu tarea: leer el material que te pasa el usuario y extraer tarjetas de
estudio de calidad.

REGLAS DE ORO:
1. Extraé ÚNICAMENTE conceptos nucleares: modelos teóricos, principios con
   nombre propio, definiciones de autor, clasificaciones y distinciones
   clave (ej: "la pirámide de Maslow", "las 5 fuerzas de Porter",
   "filantropía vs acción filantrópica"). NADA de trivia, fechas sueltas ni
   detalles accesorios.
2. Frente = una pregunta directa y general que obligue a recuperar el
   concepto entero ("¿Cuáles son las formas de obtener ventaja
   competitiva?"). Nunca preguntas de sí/no ni de completar una palabra.
3. Dorso = la respuesta concisa y completa, con la estructura del concepto
   (listas cortas si corresponde). Sin relleno.
4. MNEMOTECNIAS DEL USUARIO: si el material contiene siglas, historias o
   ganchos de memoria inventados por el usuario (ej: "I.E.E.A", "el vaquero
   domina al toro", "O.I.I.L.C.P"), PRESERVALOS TEXTUALMENTE en el dorso de
   la tarjeta correspondiente. Son oro: el usuario ya los construyó.
5. Si el material trae analogías o ejemplos propios del usuario, incluilos
   en el dorso de forma abreviada.
6. Todo en español rioplatense neutro.

MODOS:
- "conceptos_clave": solo los 5-15 conceptos más nucleares del material.
- "completo": cobertura exhaustiva de todos los conceptos con nombre propio
  del material (sin inventar los que no están).

FORMATO DE SALIDA — respondé ÚNICAMENTE con este JSON, sin texto adicional:
{"cards": [{"front": "...", "back": "..."}]}
```

Para PDFs, el documento se manda como bloque `document` aparte y el texto que
lo acompaña es simplemente: `Modo: {modo}\n\nEl material de estudio es el PDF
adjunto. Extraé las tarjetas según tus reglas.`

### Auditor del Gimnasio Mental (`AUDITOR_SYSTEM` en `src/lib/prompts.js`)

```
Sos el Auditor Exigente del Gimnasio Mental de ActiveCard, una app personal
de aprendizaje. Tu usuario acaba de repasar un concepto y te propone una
CONEXIÓN: cómo ese concepto se relaciona con otra idea, libro, materia o
vivencia suya.

Tu rol: profesor estricto pero constructivo. Entrenás su criterio, no su
ego.

CÓMO AUDITAR:
1. ¿La conexión tiene lógica real, o es una asociación superficial de
   palabras que suenan parecido?
2. ¿Es específica? "Esto se conecta con la vida" no vale; "el liderazgo en
   costos de Porter es lo que hace Vaca Muerta con el shale: escala para
   abaratar el barril" sí vale.
3. ¿Demuestra que entendió el concepto, o solo lo menciona?
4. ¿La relación agrega algo? Una buena conexión ilumina ambas ideas.

VEREDICTOS:
- "critica": la conexión es floja, vaga o incorrecta. Explicá EXACTAMENTE
  qué le falta y hacé UNA pregunta concreta que lo empuje a refinarla. No
  des vos la respuesta.
- "valida": la conexión es sólida y específica. Reconocé QUÉ la hace buena
  (1-2 frases) y generá la tarjeta híbrida.

TARJETA HÍBRIDA (solo al validar): captura la conexión para que no se
pierda.
- front: pregunta que obliga a recuperar la conexión (ej: "¿Qué tiene en
  común la entropía de la teoría de sistemas con tu experiencia en el
  club?").
- back: la síntesis de la conexión, en las palabras del usuario mejoradas
  al mínimo.

REGLAS:
- Exigente no es imposible: si hay razonamiento genuino y específico,
  validá. No pidas perfección académica a una vivencia personal.
- No valides por insistencia: si tras varios intentos sigue floja, seguí
  criticando con paciencia.
- Feedback breve: 2 a 4 frases. Español rioplatense. Directo, sin
  condescendencia ni elogios vacíos.

FORMATO — respondé ÚNICAMENTE con este JSON, sin texto adicional:
{"veredicto": "valida" | "critica", "feedback": "...", "hybrid_card":
{"front": "...", "back": "..."} | null}
("hybrid_card" solo cuando el veredicto es "valida"; si no, null.)
```

El contexto que precede al primer turno del chat es:
`CONCEPTO REPASADO:\nFrente: {front}\nDorso: {back}\n\nA continuación el
usuario propone su conexión.`

---

## 9. Diseño (tokens completos, `src/theme/index.js`)

Estética inspirada en Quizlet sobre fondo oscuro profundo.

```js
colors = {
  bg: "#0B0B0F",
  surface: "#15151C",
  surfaceHigh: "#1E1E27",
  surfaceCard: "#181820",   // fondo de tarjetas/paneles destacados
  border: "#26262F",
  text: "#E9E9EF",
  textMuted: "#8B8B98",
  accent: "#3E63DD",        // azul profundo, acento principal
  accentSoft: "#1C2647",    // fondo atenuado del acento
  accentText: "#8FA6F3",    // azul claro para texto/íconos activos sobre oscuro
  danger: "#C05A5F",
  success: "#5F9E6E",
  streak: "#F76B15",        // naranja del fuego de racha
  streakSoft: "#3A2113",
  highlight: "#4A3A12",     // fondo de resaltado rich text (ámbar oscuro)
}

textColors = {              // claves usadas por el markup [[color:texto]]
  rojo: "#E5484D", naranja: "#F76B15", amarillo: "#FFC53D",
  verde: "#46A758", azul: "#6E8BEB", violeta: "#9E6EDE",
}

spacing = { xs: 4, sm: 8, md: 16, lg: 24, xl: 40 }
radius  = { sm: 8, md: 14, lg: 22 }
type    = { title, subtitle, body, small }  // ver archivo para valores exactos
```

Bottom tabs con íconos **Feather** (`@expo/vector-icons`). Los íconos de
mazos también son Feather (elegidos con `IconPicker`).

---

## 10. Comandos y operación

- `npm test` — Jest (`jest-expo` preset, matchea `**/__tests__/*.test.js`).
  **Deben pasar siempre** antes de dar algo por terminado.
- `npm run lint` — ESLint (`eslint-config-expo`).
- **Preview web** para verificar cambios visualmente: MCP de preview con el
  server `activecard-web` de `.claude/launch.json`. Navegar a
  `http://localhost:8081/`, verificar por DOM (`preview_eval`) + consola sin
  errores.
- **OTA al teléfono** (solo cambios JS/UI): `comandos/ACTUALIZAR-APP.bat`
  → `eas update --branch preview`.
- **APK nuevo** (solo si se agrega un módulo **nativo** o cambia el
  identificador de la app): `comandos/CONSTRUIR-APP-ANDROID.bat` →
  `eas build -p android --profile preview`.
- `comandos/INICIAR-APP.bat` → levanta Expo en modo desarrollo para probar
  en el teléfono con Expo Go / dev client.
- **CI**: GitHub Actions corre lint + tests en cada push.
- **Deploy web**: `.github/workflows/deploy-web.yml` → `expo export -p web`
  → agrega `404.html` (fallback SPA) + `.nojekyll` →
  `actions/deploy-pages`. `experiments.baseUrl = "/activecard"`.
  URL pública: https://vicentemartinluciano.github.io/activecard/

---

## 11. Convenciones de trabajo

- **Un feature por commit.** Los mensajes de commit terminan con
  `Co-Authored-By: Claude <modelo> <noreply@anthropic.com>`.
- **Verificar en el preview ANTES de commitear.** Después de cambios de
  lógica, correr los tests.
- **Nunca** commitear `.env` ni `.claude/settings.local.json` (ya están en
  `.gitignore`).
- Tests en `**/__tests__/*.test.js`; si hay lógica sensible a fechas, congelar
  el reloj con `jest.setSystemTime(...)`.
- Trabajar en pasos chicos: commit + push + esperar a que el CI quede verde
  antes de seguir.
- **No re-litigar** las decisiones de producto de la §2 sin el usuario —
  ya se discutieron y se cerraron.
- Idioma de conversación con el desarrollador: **español rioplatense**
  ("vos"), tono de socio/CTO que explica el porqué y pide confirmación antes
  de avanzar de etapa.

---

## 12. Trampas conocidas (no perder tiempo re-descubriéndolas)

- **Metro + OneDrive**: el file-watching es poco confiable en esta máquina —
  si el preview no refleja un cambio, reiniciar el server de preview en vez
  de ponerse a debuggear un bundle viejo.
- **SQLite en web**: usar **solo la API async** de `expo-sqlite` (la
  síncrona se cuelga en el navegador). Al recargar la página, la apertura de
  la conexión puede fallar transitoriamente por locks de OPFS (errores tipo
  "Access Handle…" / "Invalid VFS state") → `db/client.js` ya reintenta esto;
  no cachear promesas rechazadas de la apertura.
- **El navegador embebido del preview de Claude Code retiene locks de OPFS**
  entre recargas de la página → para verificar flujos que tocan la base de
  datos, probar en un **Chrome real** apuntando a `localhost:8081`, no
  confiar solo en el preview embebido.
- **`lottie-react-native` no funciona en web** → se resuelve con
  `StreakFlame.web.js` (resolución por extensión de plataforma de Metro). Un
  `if (Platform.OS === 'web')` con `require` condicional **no alcanza**,
  porque Metro resuelve los `require` de forma estática en build time.
- **`@jamsch/expo-speech-recognition`** no funciona ni en Expo Go ni en web
  → el micrófono del Gimnasio Mental solo es verificable en el APK
  compilado. En web, `MicButton` se oculta directamente.
- **Límite de PDF de la API de Claude**: ~100 páginas / 32MB por request.

---

## 13. Cuentas y configuración externa

- **Anthropic**: API key creada y validada, vive en `.env` local como
  `EXPO_PUBLIC_ANTHROPIC_API_KEY`.
- **Notion**: integración interna llamada "ActiveCard" creada y validada
  (token en `.env` como `EXPO_PUBLIC_NOTION_TOKEN`). Se usa solo para leer
  páginas como fuente de material de estudio, sin OAuth.
- **GitHub**: usuario `vicentemartinluciano`, repo público `activecard`
  (corre CI de lint+tests y el deploy de GitHub Pages).
- **Expo/EAS**: cuenta `vicentemartinluciano`, proyecto `activecard`
  (id `c0ae7728-…-c8a010375d8c`).
- **Web pública**: https://vicentemartinluciano.github.io/activecard/

---

## 14. Estado actual del proyecto

- Fases 0-6 y el rediseño F8-F15 están **completos**: tema azul, bottom
  tabs, prioridad por porcentaje, racha, progreso diario, ronda de falladas,
  rich text, importación de Quizlet, respaldo manual, versión web pública.
- **En curso — Fase 16**: subir las env vars al proyecto de EAS y construir
  el primer APK real + smoke test en un dispositivo físico.
- El plan completo y detallado (fuera de este repo) vive en
  `C:\Users\marti\.claude\plans\mira-quiero-planear-la-moonlit-possum.md`
  en la máquina del usuario.

---

## 15. Cómo usar este archivo con una IA

Si vas a pegar esto en una conversación nueva (con Claude, ChatGPT, o
cualquier otra IA) para pedir ayuda con ActiveCard:

1. Pegá el archivo entero — está pensado para ser autocontenido.
2. Aclará qué parte del código específica vas a tocar (la IA todavía no ve
   el código, solo este resumen) — si hace falta, pegá también el archivo
   puntual.
3. Recordale las decisiones de producto de la §2 si la tarea las toca, para
   que no proponga alternativas ya descartadas (otro proveedor de IA,
   sync automático, calificación no binaria, etc.).
4. Si la tarea es de lógica pura (FSRS, cola, racha, rich text, backup), esos
   módulos tienen tests — pedile que los corra o los actualice.
