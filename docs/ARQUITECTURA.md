# Arquitectura de ActiveCard

Última actualización: 2026-08-30
Versión nativa: 1.5.0

## Visión

ActiveCard es una app Expo/React Native offline-first. La interfaz llama directamente a
repositorios SQLite y a funciones de dominio. Solo la generación, el Gimnasio Mental y
la lectura directa de Notion salen del dispositivo.

```text
expo-router
    ↓
pantallas + componentes
    ↓
db/* (persistencia) + lib/* (dominio)
    ↓
SQLite local

IA opcional: lib/openai.js → gateway opcional u OpenAI Responses API
Notion opcional: lib/notion.js → Notion API
```

No existe backend propio, autenticación, cuenta de usuario ni sincronización automática.
Android y web tienen bases locales independientes. Los respaldos JSON permiten mover
datos de forma explícita.

## Stack

- Expo SDK 57, React Native 0.86, React 19 y expo-router.
- JavaScript para la aplicación.
- `expo-sqlite` async.
- `ts-fsrs`.
- TipTap 3 + WebView nativo / React DOM web.
- OpenAI Responses API con GPT-5.6 Luna.
- Reconocimiento del sistema + Whisper local para voz.
- Expo Notifications para recordatorios locales.
- Jest, ESLint, Expo Doctor y exports de control.

## Estructura

```text
src/
├── app/
│   ├── _layout.js                 init global, fuentes, backup y recordatorio
│   ├── (tabs)/
│   │   ├── index.js               Inicio
│   │   ├── crear.js               Hub de creación
│   │   ├── biblioteca.js          Búsqueda y organización
│   │   └── progreso.js            Estadísticas
│   ├── repaso.js                  Repaso diario
│   ├── crear/
│   │   ├── ia.js                  Fuente, modo y generación
│   │   └── preseleccion.js        Revisión antes de persistir
│   ├── mazos/[id]/
│   │   ├── index.js               Detalle y administración
│   │   ├── estudiar.js            Estudio por mazo / débiles
│   │   └── tarjeta.js             Editor de tarjeta
│   ├── carpetas/[id]/index.js
│   ├── gimnasio/
│   │   ├── chat.js                Chat general o contextual
│   │   ├── historial.js           Chats persistidos
│   │   ├── nueva.js               Selector de tarjeta de origen
│   │   ├── index.js               Mazos con ideas
│   │   ├── [deckId].js            Ideas de un mazo
│   │   └── charla.js              Transcript histórico de una idea
│   ├── ajustes.js
│   └── importar-respaldo.js
├── components/
│   ├── ui.js, ActionSheet.js, GlowPressable.js
│   ├── FlipCard.js, SwipeCard.js, EditableCardRow.js
│   ├── NotionField.js, NotionField.web.js, RichText.js
│   ├── ChatAuditor.js, CardAttachmentSheet.js, BrainMark.js, StarField.js
│   ├── VoiceInput.native.js, VoiceInput.web.js, MicButton.js
│   └── gráficos, progreso, skeleton, toast y animaciones
├── db/
│   ├── client.js, schema.js
│   ├── cards.js, decks.js, folders.js, connections.js, gymChats.js
│   ├── reviewQueue.js, progress.js, stats.js, streak.js, settings.js
├── lib/
│   ├── scheduler.js, queue.js, studySession.js, search.js
│   ├── openai.js, prompts.js, generator.js, gymAssistant.js, notion.js, files.js
│   ├── backup.js, backupIO.js, backupMerge.js, pendingImport.js, draftStore.js
│   ├── richtext.js, richhtml.js, editorSetup.js, editorCss.js
│   ├── tiptapImage.js, tiptapTColor.js, tiptapTextAlign.js, imageCompress.js
│   ├── notifications.js, voiceTranscript.js
├── theme/index.js
└── assets/editor/editorHtml.js     bundle generado y commiteado

editor-web/index.js                 entrada de esbuild para el editor nativo
scripts/build-editor.mjs
```

## Inicialización

`src/app/_layout.js`:

1. carga las cuatro familias de Plus Jakarta Sans;
2. inicializa el caché de claves desde `settings`;
3. configura el handler de notificaciones;
4. después de las interacciones iniciales intenta el respaldo automático y sincroniza el
   recordatorio;
5. escucha toques sobre una notificación para navegar a `/repaso`;
6. envuelve la aplicación con Gesture Handler y ErrorBoundary.

La base se abre de forma perezosa desde `db/client.js`. En web, `openWithRetry()` tolera
locks transitorios de OPFS y una promesa rechazada nunca queda cacheada.

## SQLite

Migraciones append-only en `db/schema.js`. Esquema actual: v7.

### Tablas

#### `folders`

- `id`, `name`, `created_at`.

#### `decks`

- `id`, `name`, `created_at`;
- `priority` 0–100 en pasos de 5;
- `icon` Feather opcional;
- `folder_id` opcional y gestionado por la app.

#### `tags` y `deck_tags`

Etiquetas únicas y relación muchos a muchos con mazos.

#### `cards`

- identidad: `id`, `deck_id`, `created_at`;
- contenido: `front`, `back`;
- procedencia: `source`, `origin_card_id`;
- organización: `starred`, `position`, `suspended`;
- FSRS: `due`, `stability`, `difficulty`, `elapsed_days`, `scheduled_days`, `reps`,
  `lapses`, `learning_steps`, `state`, `last_review`.

`source` es `manual`, `ai` o `hybrid`. Una idea del Gimnasio es una card híbrida real.

#### `review_logs`

- `card_id`, `rating`, `mode`, `reviewed_at`.
- `rating`: `again`, `hard` o `good`.
- `mode`: `daily` o `quizlet`.

#### `connections`

Conserva tarjeta de origen, síntesis, transcript, tarjeta híbrida y fecha. La navegación
del Gimnasio se deriva desde `cards`, no desde esta tabla.

#### `gym_chats` y `gym_messages`

Chats persistentes, tarjeta de origen opcional, borrador, mensajes y metadata JSON. La
metadata guarda adjuntos y acciones propuestas/aplicadas.

#### `settings`

Preferencias y secretos locales. No forma parte del respaldo.

#### `priorities`

Tabla histórica sin consumidores actuales; no se elimina para preservar bases instaladas.

### Reglas

- Nunca editar una migración aplicada.
- `FSRS_COLS` es la lista única para persistir, snapshotear y deshacer FSRS.
- `deleteFolder()` desasigna mazos dentro de la misma transacción.
- Las consultas de listados deben evitar traer imágenes base64 cuando solo necesitan
  metadatos o texto plano.
- Las fechas se almacenan como ISO UTC; día y semana se agrupan en JS con hora local.

## Estudio y FSRS

`lib/scheduler.js` crea FSRS con `enable_short_term: false`: ActiveCard programa en días,
no repite por minutos dentro de una misma sesión.

| Nota | Rating | Avanza hoy | Repite en ronda de falladas |
|---|---|---|---|
| No la sabía | Again | No | Sí |
| Más o menos | Hard | Sí | No |
| La sabía | Good | Sí | No |

`reviewCard()` actualiza `cards` e inserta `review_logs`. `undoReview()` restaura solo el
estado FSRS y borra ese log; no toca ideas ni conexiones.

### Cola diaria

`db/reviewQueue.js` compone repositorios y `lib/queue.js`:

1. calcula inicio y fin del día local;
2. obtiene tarjetas livianas, prioridades, falladas, límites y actividad del día;
3. descuenta lo ya consumido de los topes;
4. excluye suspendidas y mazos pausados;
5. incluye debidas y `retryIds`;
6. intercala por stride scheduling según prioridad;
7. limita repasos totales y tarjetas nuevas;
8. hidrata frente y dorso solo para los IDs finales.

Una tarjeta cuya última nota diaria es `again` sigue pendiente aunque FSRS ya le haya
dado una fecha futura.

### Modo mazo

`listDeckCardsNotReviewedToday()` arma el pool del mazo. Se puede filtrar por estrella y
conservar orden manual o barajar. `debiles` es un ID virtual que usa `listWeakCards()`.

## Estadísticas

`db/stats.js` deriva sin tablas adicionales:

- retención de 30 días y delta contra la ventana anterior;
- serie semanal de 12 semanas;
- heatmap de 84 días;
- forecast de siete días;
- puntos débiles por `lapses`;
- retención del mazo.

Retención considera correcta cualquier nota distinta de `again`.

## Rich text y editor

`cards.front/back` siguen siendo TEXT. El formato interno usa marcas y sentinels; TipTap
es una capa WYSIWYG.

### Marcas

```text
**negrita**
*cursiva*
__subrayado__
==resaltado==
~~tachado~~
[[color:texto]]
- viñeta
1. numerada
---
```

Sentinels Unicode privados representan:

- alineación izquierda, centro y derecha;
- título 1, 2 y 3;
- cita;
- imagen con ancho porcentual y data URI.

`richhtml.js` convierte marcas ↔ HTML sin depender del DOM. `RichText` renderiza la vista
de lectura y `toPlainText()` elimina formato e imágenes para búsqueda y contexto de IA.

Android monta TipTap en WebView usando `assets/editor/editorHtml.js`. Web monta TipTap con
React DOM. Configuración compartida en `editorSetup.js` evita diferencias.

Al cambiar `editor-web/`, `editorSetup.js`, `editorCss.js`, `tiptapImage.js`,
`tiptapTColor.js` o `tiptapTextAlign.js`, ejecutar `npm run editor:build`.

Las imágenes manuales se comprimen en canvas, se guardan inline y se dimensionan S/M/G.
En Android su proporción sale de `Image.onLoad`, no de `Image.getSize`.

## Generación con IA

`lib/openai.js` es el único cliente actual:

- modelo `gpt-5.6-luna`;
- chat `high`;
- generación/análisis `xhigh`;
- Responses API;
- texto o JSON;
- `store: false`;
- gateway opcional para Android.

No existe abstracción multiproveedor. La decisión vigente es conservar un solo proveedor
hasta que una necesidad comercial justifique gateway, routing y adaptadores.

### Flujo

```text
texto / archivo / Notion
        ↓
generator.js + GENERATOR_SYSTEM
        ↓
JSON { cards: [{ front, back }] }
        ↓
generationDraft en settings
        ↓
preselección editable
        ↓ confirmación
cards source='ai' o 'manual'
```

PDF entra como archivo base64; TXT y Markdown como texto. Notion convierte bloques,
descarga imágenes y conserva marcadores que `resolveImageMarkers()` reemplaza por data
URI. El tope preventivo de archivos es aproximadamente 18 MB.

La preselección puede guardar parcialmente y recuerda qué tarjetas ya fueron insertadas.

## Gimnasio Mental

`ChatAuditor` es la interfaz. `gymAssistant.js` arma el contexto, llama al modelo, valida
su contrato y resuelve búsquedas ambiguas.

Una charla libre es efímera hasta el primer envío. `ensureSession()` crea `gym_chats` y
luego cada turno se guarda en `gym_messages`. El primer contenido genera el título.

### Contexto enviado

- historial reciente persistido;
- tarjeta de origen opcional;
- catálogo de carpetas y mazos;
- tarjetas referenciadas completas;
- fuentes adjuntas recientes;
- resumen de acciones anteriores.

### Adjuntos

- hasta seis fuentes: PDF, texto, Markdown, imagen, Word o PowerPoint;
- múltiples tarjetas seleccionables por búsqueda, carpeta, mazo y etiqueta;
- pills compactas y colores distintos para fuente y tarjeta;
- adjuntar contexto no presupone una acción.

### Acciones

```text
search_cards
edit_card | create_card | delete_card | create_cards
create_deck | rename_deck | move_deck | delete_deck
create_folder | rename_folder | delete_folder
```

La app valida IDs contra el catálogo enviado. Una búsqueda con varias coincidencias pide
elección y vuelve a llamar al modelo con la tarjeta real. Toda mutación muestra preview y
requiere confirmación. Borrar mazo o carpeta exige escribir el nombre exacto; borrar una
carpeta permite elegir qué mazos hijos también se eliminan.

Una `create_card` híbrida puede guardar `connections` y aparecer en la vista de ideas.

## Voz

`VoiceInput.native.js` usa reconocimiento en vivo del servicio Android con resultados
interinos. Cuando finaliza conserva el resultado nativo si es fiable; si no, procesa el
WAV persistido con Whisper Base q5_1 local.

- idioma del reconocimiento: `es-AR`;
- idioma de Whisper: `es`;
- modelo: ~60 MB, descarga única a almacenamiento privado;
- audio temporal eliminado tras procesar o descartar;
- controles: mantener, bloquear, pausar, reanudar, descartar y aceptar;
- web usa `MicButton` y la capacidad del navegador.

## Respaldo

Formato vigente: v3.

```text
folders, decks, tags, deck_tags, cards, review_logs,
connections, gym_chats, gym_messages
```

`settings` nunca se exporta.

### Exportación

El usuario elige qué fuentes adjuntas incluir; chats y referencias se conservan. Web
descarga un Blob. Android comparte un JSON mediante FileSystem y Sharing.

### Reemplazo

Valida, normaliza versiones previas y restaura todas las tablas conservando IDs.

### Suma

`backupMerge.js`:

- deduplica tarjetas por frente+dorso y chats por contenido;
- renombra padres que colisionan;
- permite selección granular;
- crea solo carpetas y mazos necesarios;
- remapea IDs de relaciones, mensajes, adjuntos y acciones;
- crea un respaldo automático antes de aplicar.

### Automático

Android rota `activecard-auto-1/2/3.json` como máximo una vez por semana. No reemplaza la
copia manual externa. Web no puede escribir silenciosamente a disco.

## Notificaciones

`notifications.js` guarda preferencias en settings, crea el canal Android
`repaso-diario`, cancela el recordatorio anterior y programa uno nuevo solo si quedan
pendientes. Está apagado por defecto y no requiere alarma exacta.

## Diseño

Tokens en `theme/index.js`:

- fondo `#09090B`;
- surfaces oscuras y borde translúcido;
- acento cobalto `#3E63DD`;
- progreso verde;
- rating rojo/azul/verde;
- Plus Jakarta Sans por familia de peso;
- ancho máximo 480 nativo, 840 web y 560 para estudio web.

Primitivas principales: `Card`, `Pill`, `Button`, `Field`, `Chip`, `Screen`,
`GlowPressable` y `ActionSheet`. El halo cobalto solo aparece en interacción, salvo el
cierre de sesión. El Gimnasio usa `StarField` y `BrainMark`.

La tarjeta de estudio usa una sola cara y `scaleX`. No usar `rotateY` ni dos caras
absolutas en Android Fabric.

## Plataforma

### Android

- SQLite privado.
- Notion directo.
- WebView para editor.
- drag & drop nativo.
- notificaciones y voz híbrida.
- APK + OTA.

### Web

- SQLite OPFS async.
- TipTap React DOM.
- sin drag & drop nativo.
- Notion directo bloqueado por CORS: usar archivo exportado.
- clave de OpenAI ingresada en Ajustes.
- deploy estático a GitHub Pages con base `/activecard`.

## OTA y código nativo

`runtimeVersion.policy = appVersion`.

- Cambios JS, prompts, estilos y migraciones compatibles: OTA.
- Dependencia, plugin o permiso nativo nuevo: bump de `app.json.version`, cambio de
  `APP_VERSION` en el `.bat` y APK nuevo en el mismo commit.

## Seguridad

- `.env` ignorado.
- Variables posibles: gateway URL/token, OpenAI key y Notion token.
- Las claves no entran en respaldos.
- Una clave `EXPO_PUBLIC_*` puede extraerse del bundle; una distribución comercial debe
  usar gateway, autenticación, cuotas y observabilidad.
- Adjuntos son contenido no confiable.
- La IA propone; el código valida; el usuario confirma.

## Trampas que no deben redescubrirse

- API sync de SQLite: no usar.
- OPFS: reintentos y promesas rechazadas no cacheadas.
- Metro + OneDrive: reiniciar con caché limpia si el bundle parece viejo.
- Android Fabric: Animated.View externo + Pressable interno.
- Overlays invisibles todavía capturan toques; usar `pointerEvents="none"`.
- PanResponder persistente debe leer callbacks desde refs.
- El glow de progreso pertenece al fill y no debe recortarse.
- `Image.getSize` falla con data URI Android; usar `onLoad`.
- Bundle TipTap debe regenerarse.
- `***negrita+cursiva***` no se conserva con fidelidad.
- Notion web requiere archivo por CORS.
- Imágenes base64 no deben cargarse en listados livianos.
