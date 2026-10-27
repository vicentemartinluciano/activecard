# Arquitectura de ActiveCard

Última actualización: 2026-10-26
APK instalada: 1.11.0 / código 6, comprobada por ADB el 18/10; esta revisión no construye ni instala un APK. La prueba física queda a cargo de Martín. El estado del teléfono, la cuenta y las pruebas de intercambio
entre Android y web se registran en `SINCRONIZACION.md`. La reinstalación del 8/10
perdió la clave local de OpenAI; las claves siguen siendo locales.

Runtime 1.10.0 incluye Repaso diario, Mazos y el combinado `ReviewAndDecks`.
La revisión física de 1.9.0 detectó un overlay ausente en `layout-night` y listas
recortadas por capacidad. La 1.10.0 integra overlay diurno/nocturno para fuego y
reflejo del progreso, y `ListWidget` con progreso seguido de todos los recientes.
El repaso copia el diseño de Inicio; el combinado lo fija sobre la lista.
APK compilada, inspeccionada e instalada; render Android y cachés comprobados.
Las capturas del 16/10 y el reporte de Martín detectan espacio desperdiciado en
Mazos, repaso comprimido y demora/saltos al redimensionar. Fuente preparada para
1.11.0: lista sin cabecera/pie fijos, Biblioteca como último ítem, repaso con botón
al margen inferior y espaciado repartido. El combinado se identifica «Todo junto»
en el selector y pide 4 × 4 celdas, conservando su proveedor e instancias.
Resize usa trabajo nativo único por ID, agrupación headless de 150 ms y tamaño
vigente tras leer SQLite; descarta renders de medidas anteriores. El fuego comparte
48 assets transparentes y un fondo separado; el reflejo reutiliza 33 cuadros pequeños
transparentes, sin recapturar el fondo en cada cuadro. Los URI de cuadros son
inmutables, con expiración de tamaños antiguos. Falta QA físico de esta revisión.
Por pedido de Martín no se genera, publica ni instala APK/OTA; ejecuta su BAT.
Implementación, entregas y límites de QA en `WIDGETS.md`.

## Visión

ActiveCard es una app Expo/React Native offline-first. La interfaz llama directamente a
repositorios SQLite y a funciones de dominio. La generación, el Gimnasio Mental,
Notion y la sincronización opcional salen del dispositivo.

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

La cuenta privada usa Auth y Storage de Supabase en el proyecto de REANCLA, con tablas
y permisos propios. SQLite sigue funcionando offline. La migración remota y sus
permisos se verificaron el 7 de octubre. Ver `SINCRONIZACION.md` para el protocolo,
las pruebas efectuadas y sus límites de validación.

La web tiene un shell de escritorio persistente: barra de secciones, índice de
carpetas/mazos con fijado y vista previa por hover y contenido independiente. Ver
`WEB-ESCRITORIO.md` para el diseño aprobado y `SINCRONIZACION.md` para la cuenta
privada y sincronización con conversaciones del Gimnasio.

`LibraryContent` comparte la navegación de Biblioteca y carpetas entre Android
y web. La raíz distingue En esta ubicación (carpetas raíz/mazos sueltos) y Todos
los mazos. Buscar en raíz es global; buscar dentro de una carpeta incluye sus
descendientes y muestra la ubicación de los resultados. `LibraryBreadcrumbs`
expone los ancestros en Android; web reutiliza la ruta de `DesktopShell` y abre
los ancestros del elemento activo en el índice.

`CreationSheet` y `FolderPicker` se reutilizan desde Crear, Biblioteca, carpetas
y el índice web. `createDeck(name, folderId)` inserta el destino y el mazo en una
transacción. El borrador de generación v2 conserva destino, nombre y modalidad
de mazo nuevo; lee borradores anteriores. Confirmar la preselección crea el mazo
y su referencia en `settings` atómicamente antes de guardar las tarjetas.
`DeckMoveSheet` permite mover desde cualquier carpeta con origen/destino visibles;
`setDeckFolder` valida ambas referencias en la transacción. No cambia FSRS ni
identidades y no requiere una migración de esquema ni un módulo nativo.

El pulido visual compartido de web y Android está descrito en `UI-PULIDO.md`:
primitivas accesibles, ancho de formularios y composición adaptada a ventanas angostas.

La Biblioteca contextual se integró mediante el PR #24 (`dd6b479`) y se publicó
en web y OTA Android el 26/10/2026. La OTA usa canal `preview` y runtime `1.11.0`;
la verificación de artefactos y sus identificadores están en
`BIBLIOTECA-Y-ESTUDIO.md`. No se construyó ni instaló otro APK ni se operó el teléfono.

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

La entrada `index.js` registra primero el handler headless de widgets en Android
y después carga Expo Router. Web/iOS resuelven un registro vacío.

1. carga las cuatro familias de Plus Jakarta Sans;
2. inicializa el caché de claves desde `settings`;
3. configura el handler de notificaciones;
4. después de las interacciones iniciales intenta el respaldo automático y sincroniza el
   recordatorio;
5. escucha toques sobre una notificación para navegar a `/repaso`;
6. envuelve la aplicación con Gesture Handler y ErrorBoundary.

`WidgetUpdates` observa cambios confirmados de SQLite para refrescar las instancias
instaladas, además de foreground y cambio de día con la app activa. El handler de
Android puede consultar los mismos repositorios con la app cerrada. Ver `WIDGETS.md`.

La base se abre de forma perezosa desde `db/client.js`. En web, `openWithRetry()` tolera
locks transitorios de OPFS y una promesa rechazada nunca queda cacheada.

## SQLite

Migraciones append-only en `db/schema.js`. Esquema actual: v10. v8 agrega `sync_id`, `sync_state` y `sync_recovery`; v9 lleva exclusivamente los límites diarios a `study_preferences`; v10 agrega `folders.parent_id`. Conserva datos anteriores y no modifica migraciones ya aplicadas. Ver `BIBLIOTECA-Y-ESTUDIO.md` para edición permanente, tablas, export por mazo y jerarquía.

### Tablas

#### `folders`

- `id`, `name`, `created_at`, `parent_id` opcional para subcarpetas (v10).

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

#### `study_preferences`

Una única fila `dailyLimits` comparte los máximos diarios de repasos y nuevas tarjetas.
La migración v9 conserva los valores de `settings.dailyLimits`; la API de configuración
redirige esa clave a la tabla compartida. El resto de `settings` sigue local. Solo las
copias internas de sincronización incluyen esta fila; el respaldo manual v5 no incluye preferencias ni claves.

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

- puntaje de recuerdo de 30 días y delta contra la ventana anterior;
- serie semanal de 12 semanas;
- heatmap de 84 días;
- forecast de siete días;
- puntos débiles por `lapses`;
- puntaje de recuerdo del mazo.

El puntaje de recuerdo vale 1 por `good`, 0,5 por `hard` y 0 por `again`.
Se divide la suma por la cantidad de respuestas y se lleva a una escala de 100,
redondeada al entero más cercano. Cuenta cada respuesta de todos los modos.
Resumen, delta, serie semanal e indicador del mazo usan los mismos pesos sobre
los registros existentes, sin migración ni modificación del estado FSRS.

El gráfico semanal destaca el último dato con repasos y muestra el promedio de
las semanas con datos en una leyenda separada. Usa escala 50–100, ampliada a
0–100 si algún dato queda por debajo de 50. El número principal conserva su
ventana de 30 días. La UI expresa el puntaje ponderado en %, conservando los
pesos 1/0,5/0; no es un porcentaje binario de aciertos. La tarjeta muestra
el valor principal, el delta y el gráfico con su promedio semanal, sin la
fórmula ni la explicación duplicada de la comparación.

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
- tabla (`E030`) con celdas, combinaciones y anchos;
- desplegable (`E031`) con título en marcas y contenido recursivo. El estado
  abierto/cerrado es local a la vista; no altera el contenido ni la sincronización.

`richhtml.js` convierte marcas ↔ HTML sin depender del DOM. `RichText` renderiza la vista
de lectura y `toPlainText()` elimina formato e imágenes para búsqueda y contexto de IA.

Android monta TipTap en WebView usando `assets/editor/editorHtml.js`. Web monta TipTap con
React DOM. Configuración compartida en `editorSetup.js` evita diferencias.

`tiptapToggle.js` define los desplegables: insertar desde + o convertir una
selección desde formato; el primer bloque pasa a ser título y los siguientes,
contenido. Admiten listas, imágenes, tablas y otros desplegables. Enter desde el
título entra al contenido; Enter en el último párrafo vacío sale; Texto o
Backspace al inicio del título desarman el contenedor conservando el contenido.
El editor los abre para escribir. `RichToggle` los inicia cerrados al estudiar y
su toque no gira ni califica la tarjeta. En web, la flecha se revela al pasar el
cursor por el bloque o al enfocarla con teclado; en tacto queda tenue. `toggleCss.js`
comparte el aspecto entre lectura web y editor. La búsqueda y el contexto de IA
incluyen todo el texto, aunque esté plegado. Backup y sync conservan el bloque en
`front/back`, sin migraciones ni permisos nuevos.

El mazo y el editor individual comparten `EditableCardRow` y una sola experiencia
editable. `cardAutosave.js` serializa los guardados; `settings` conserva los
borradores locales incompletos. No hay avisos rutinarios de guardado: insertar y
quitar esos avisos entre los hijos de `Stagger` repetía la entrada al escribir.
Los errores siguen visibles y conservan el borrador. `richTable.js` mantiene anchos y celdas combinadas
al leer; los controles y la pill contextual adaptan los de REANCLA. Ver
`BIBLIOTECA-Y-ESTUDIO.md` para comportamiento y límites de verificación.

Al cambiar `editor-web/`, `editorSetup.js`, `editorCss.js`, `tiptapImage.js`,
`tiptapTColor.js`, `tiptapTextAlign.js`, `tiptapToggle.js` o `toggleCss.js`, ejecutar `npm run editor:build`.

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

En modo JSON, el cliente agrega una instrucción `developer` explícita dentro de
`input`. Responses valida la presencia de JSON en los mensajes; escribirlo solamente
en `instructions` puede provocar un 400 antes de generar la respuesta. El historial y
los adjuntos se conservan sin cambios.

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

Formato vigente: v5; conserva identidades de sincronización y jerarquía de carpetas y permite restaurar v1–v4. Compartir un mazo genera un export de contenido sin historial, chats ni identidades. Las tablas se conservan dentro de `front/back`.

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

CI valida con Expo Doctor el mapa de dependencias del SDK instalado mediante
`EXPO_OFFLINE=1`. El chequeo online de parches queda informativo para planificar el
próximo APK; no exige actualizar módulos nativos para publicar una OTA compatible.

## Seguridad

- `.env` ignorado.
- OpenAI y Notion se configuran en Ajustes en Android y web; no se leen de variables
  públicas del build. Las claves locales existentes se conservan al actualizar.
- Los perfiles EAS deshabilitan dotenv y reemplazan las variables antiguas de OpenAI,
  Notion y Anthropic por `DISABLED_USE_DEVICE_SETTINGS`, aunque sigan configuradas
  en el entorno remoto. EAS no admite strings vacíos; los clientes no leen ese marcador.
- Las claves no entran en respaldos ni sincronización.
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
