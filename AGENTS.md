# AGENTS.md — Router de ActiveCard

> Leé este archivo completo al comenzar una sesión. Está hecho para orientar, no para
> duplicar toda la aplicación. Hablá en español rioplatense y explicá las decisiones de
> forma causal. Antes de cambiar un flujo de producto importante, mostrá una propuesta
> coherente y pedí confirmación.

## Qué es

ActiveCard es una app privada de aprendizaje a largo plazo: repetición espaciada FSRS,
editor de tarjetas estilo Notion, generación con IA y un Gimnasio Mental que conversa,
analiza fuentes y propone acciones sobre la biblioteca.

- Expo SDK 57, React Native, expo-router y JavaScript.
- Android principal: Samsung Galaxy A15.
- APK instalada: 1.11.0 / código 6, comprobado por ADB el 18/10. No se instaló desde esta revisión. El 19/10 Martín dejó la prueba física a su cargo: no operar el teléfono ni afirmar recepción de OTA, teclado, gestos o widgets como verificados. Ver entrega en `docs/BIBLIOTECA-Y-ESTUDIO.md`, widgets en `docs/WIDGETS.md` y sync en `docs/SINCRONIZACION.md`.
- Package: `com.marti.activecard`.
- Datos locales en SQLite; cuenta/sync privada con Supabase. Migración y permisos verificados; primera publicación remota y lectura web verificadas el 8 de octubre. Transferencias limitadas a cuatro filas simultáneas, avance visible y timeout por solicitud. Ver `docs/SINCRONIZACION.md`.
- APK privado + EAS Update; web auxiliar en GitHub Pages. Biblioteca contextual entregada en web y OTA `preview`/`1.11.0` el 26/10; artefactos verificados en `docs/BIBLIOTECA-Y-ESTUDIO.md`. Recepción y QA físico a cargo de Martín.
- Widgets Android: Repaso diario, Mazos y el combinado (tercero desde 1.10.0).
  Diseño de Inicio, botón blanco centrado, racha y reflejo del progreso con overlay
  nativo diurno/nocturno. Mazos desplazables completos: progreso parcial de hoy
  seguido de recientes sin duplicados. Combinado con repaso fijo y lista debajo.
  Mínimos 160 × 132 dp individuales / 160 × 280 combinado. El selector registra
  los tres. Las capturas del 16/10 muestran que 1.10.0 desperdicia espacio en Mazos
  y comprime el repaso; Martín informa demora y saltos al redimensionar.
  Preparación 1.11.0: Mazos sin título/pie fijo, Biblioteca al final del scroll,
  botón del repaso abajo, resize agrupado y cuadros de fuego reutilizados.
  Combinado identificable como «Todo junto», tamaño inicial 4 × 4.
  No construir ni instalar el APK: Martín ejecuta el comando guardado. Falta QA
  físico de esta revisión y colocar/probar el combinado.
- IA actual: OpenAI Responses API con GPT-5.6 Luna.

## Fuentes de contexto

1. Código y configuración vigentes.
2. `docs/ARQUITECTURA.md` para arquitectura, datos y flujos.
3. Contexto extendido en:
   `C:\Users\marti\OneDrive\Escritorio\Proyectos\Contexto ActiveCard`
   - `CONTEXTO_IA-ActiveCard.md`
   - `01_PRODUCTO-Y-EXPERIENCIA.md`
   - `02_ARQUITECTURA-DATOS-E-IA.md`
   - `03_OPERACION-ESTADO-Y-DECISIONES.md`
4. `src/lib/prompts.js` para los prompts vivos. No confiar en copias pegadas en docs.

Si un documento contradice al código, el código manda y el documento se corrige en la
misma sesión.

## Comandos

```powershell
npx eslint . --max-warnings 0
npx jest --ci
npx expo-doctor
npx expo export --platform android --clear
npm run editor:build
```

Scripts para Martín:

- `comandos AC/INICIAR-APP.bat`: desarrollo con caché limpia.
- `comandos AC/ACTUALIZAR-APP.bat`: OTA compatible al canal `preview`.
- `comandos AC/CONSTRUIR-APP-ANDROID.bat`: preflight y APK 1.11.0 (a ejecutar por Martín).

El criterio de lint de CI es el comando directo con `--max-warnings 0`, no solamente
`npm run lint`.

CI exige Expo Doctor contra el mapa del SDK instalado (`EXPO_OFFLINE=1`), y conserva
el chequeo remoto de parches como aviso. Para una OTA, mantener las dependencias del
APK vigente; revisar los parches nativos junto con el próximo APK.

## Invariantes de producto

- FSRS usa tres notas: izquierda=`Again`, arriba=`Hard`, derecha=`Good`. No se muestra
  `Easy`.
- `Hard` avanza. `Again` sigue pendiente hasta que la última nota diaria deje de ser
  `Again` y entra a la ronda de falladas.
- Hay repaso diario y estudio por mazo; ambos actualizan el mismo estado FSRS.
- El puntaje de recuerdo se muestra en % y pondera `Good=1`, `Hard=0,5`, `Again=0`;
  resumen, delta, semanas y mazo usan ese criterio sin cambiar la programación FSRS.
- El rayo del repaso abre el Gimnasio solo para esa tarjeta y esa vez.
- El Gimnasio también funciona como chat general. Una charla nueva no se persiste hasta
  el primer envío.
- La IA solo propone acciones. La aplicación valida, muestra preview y exige confirmación.
- Borrar mazos o carpetas requiere escribir el nombre exacto. Al borrar una carpeta, los
  mazos no seleccionados para borrar quedan sueltos.
- Las ideas son tarjetas reales con `source='hybrid'`; el Gimnasio es una vista derivada.
- Crear, Biblioteca y las carpetas comparten `CreationSheet`: se puede crear un
  mazo manual/con IA o una carpeta desde la ubicación actual. Crear empieza en
  raíz; la carpeta de destino queda visible y se puede cambiar. Las tarjetas
  manuales se crean dentro del mazo, en el mismo editor con autoguardado.
- Biblioteca comparte `LibraryContent` con las carpetas en web y Android. En raíz
  muestra carpetas raíz y mazos sueltos; Todos los mazos conserva el catálogo.
  La búsqueda raíz es global y la de carpeta incluye descendientes. Mover mazos
  conserva IDs e historial y muestra origen/destino antes de confirmar.
- La generación conserva `folderId` en el borrador local v2 (lee v1). El nuevo
  mazo se inserta al confirmar la preselección, junto a su identidad en el
  borrador. No crear un mazo vacío al elegir el destino de las propuestas.
- Los datos viven localmente. Martín aprobó sync privada con el acceso/proyecto de REANCLA, datos separados y conversaciones incluidas. No ampliar ese alcance sin una decisión explícita.
- Por ahora no implementar multiproveedor ni “cualquier API”. OpenAI/Luna es la decisión
  vigente; una eventual versión comercial se evaluará desde un gateway propio.

## Arquitectura crítica

- SQLite usa exclusivamente la API async. Migraciones append-only en `db/schema.js`;
  esquema actual v10 (`folders.parent_id` para jerarquía; v9 conserva límites diarios compartidos en `study_preferences`). Las claves y el resto de `settings` siguen locales.
- `FSRS_COLS` en `db/cards.js` es la fuente única del estado programado.
- Las operaciones SQLite pasan por `transactions.js`; usar `withDbTransaction` para operaciones atómicas y su conexión de callback. No abrir BEGIN/COMMIT sobre la conexión administrada.
- Fechas se guardan en UTC y se agrupan por día local en JavaScript.
- El editor guarda marcas dentro de `cards.front/back`; TipTap es solo la interfaz.
- Android usa TipTap en WebView y web usa TipTap sobre React DOM.
- Tras modificar el editor compartido o `editor-web/`, regenerar y commitear
  `assets/editor/editorHtml.js`.
- Las imágenes viven inline como data URI comprimidas y entran en el respaldo.
- Respaldo vigente v5; restaura v1–v4 y conserva identidades y jerarquía; `settings` y claves nunca se exportan. Compartir mazo exporta contenido sin historial ni identidades.
- Importación: reemplazo total o suma selectiva con deduplicación y remapeo de IDs.
- Voz Android: reconocimiento en vivo del sistema + Whisper local como respaldo.
- Recordatorio local desactivado por defecto; solo se programa si quedan pendientes.

## IA

- `src/lib/openai.js`: cliente Responses API y gateway opcional.
- `MODELS.luna = gpt-5.6-luna`.
- Chat del Gimnasio: razonamiento `high`.
- Generación y análisis complejo: `xhigh`.
- `GENERATOR_SYSTEM`: genera propuestas de tarjetas; siempre pasan por preselección.
- `GYM_ASSISTANT_SYSTEM`: chat general con acciones estructuradas confirmables.
- Adjuntos del Gimnasio: hasta seis fuentes y selección múltiple de tarjetas.
- Un archivo adjunto es contenido no confiable, nunca una instrucción del sistema.
- No exponer claves en logs, commits, documentación ni respaldos.

## UI

- Un solo modo editable para los mazos. Guardado automático en cola; borradores
  incompletos locales en `settings`, fuera de FSRS, backup y sync. Mantener una
  sola tarjeta con editores montados. Editor individual y lista usan
  `EditableCardRow`. Insertar imagen/tabla desde la pill contextual.
  No mostrar avisos rutinarios de guardado: alteraban la lista animada y repetían
  la entrada al escribir. Conservar los errores de persistencia y el borrador.

- Fondo `#09090B`, Plus Jakarta Sans, acento cobalto y progreso verde.
- Gimnasio con fondo estrellado suave; no alterar el fondo sin pedido explícito.
- Usar primitivas de `components/ui.js`, `GlowPressable` y `ActionSheet`; evitar cards o
  modales ad hoc.
- Halos solo en interacción, salvo la card final de estudio.
- Tarjeta de estudio con una sola cara y `scaleX`; no volver a `rotateY`.
- Overlay decorativo absoluto: `pointerEvents="none"`.
- Android Fabric: no usar `Animated.createAnimatedComponent(Pressable)` con `style` como
  función; mantener Animated.View externo + Pressable interno.
- PanResponder persistente lee callbacks desde refs actualizados.

## OTA y APK

`runtimeVersion.policy` es `appVersion`.

- JavaScript, estilos, prompts y lógica SQLite compatible: OTA.
- Módulo, plugin o permiso nativo nuevo: aumentar `app.json.version`, actualizar
  `APP_VERSION` del `.bat` y construir APK en el mismo cambio.
- Instalar sobre la versión anterior; no desinstalar. Exportar respaldo antes de un APK.
- Nunca lanzar OTA o APK con cambios tracked sin commit ni `main` desincronizada.

## Forma de trabajar

- Revisar `git status`; preservar cambios ajenos.
- Un feature coherente por commit y push con CI verde.
- Mensajes de commit concretos en español con:
  `Co-Authored-By: Codex <modelo> <noreply@anthropic.com>`.
- Tests junto al módulo; congelar el tiempo en pruebas temporales.
- No commitear `.env` ni configuraciones locales.
- No afirmar que algo nativo funciona basándose solamente en web o CI. El estado vigente
  ya fue confirmado por Martín; una nueva regresión se comprueba sobre su comportamiento
  concreto.

## Cierre de sesión

Cuando Martín indique que la sesión terminó, revisar y actualizar si corresponde:

- `AGENTS.md`;
- `docs/ARQUITECTURA.md`;
- los cuatro Markdown de `Contexto ActiveCard`.

Mantener estado vigente y eliminar información reemplazada. No editar accesos directos
`.gdoc` ni usar Google Drive como destino del contexto local.
