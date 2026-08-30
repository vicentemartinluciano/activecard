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
- Versión nativa vigente: 1.5.0.
- Package: `com.marti.activecard`.
- Datos locales en SQLite; sin cuenta, backend ni sincronización automática.
- APK privado + EAS Update; web auxiliar en GitHub Pages.
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
- `comandos AC/CONSTRUIR-APP-ANDROID.bat`: preflight y APK 1.5.0.

El criterio de lint de CI es el comando directo con `--max-warnings 0`, no solamente
`npm run lint`.

## Invariantes de producto

- FSRS usa tres notas: izquierda=`Again`, arriba=`Hard`, derecha=`Good`. No se muestra
  `Easy`.
- `Hard` avanza. `Again` sigue pendiente hasta que la última nota diaria deje de ser
  `Again` y entra a la ronda de falladas.
- Hay repaso diario y estudio por mazo; ambos actualizan el mismo estado FSRS.
- El rayo del repaso abre el Gimnasio solo para esa tarjeta y esa vez.
- El Gimnasio también funciona como chat general. Una charla nueva no se persiste hasta
  el primer envío.
- La IA solo propone acciones. La aplicación valida, muestra preview y exige confirmación.
- Borrar mazos o carpetas requiere escribir el nombre exacto. Al borrar una carpeta, los
  mazos no seleccionados para borrar quedan sueltos.
- Las ideas son tarjetas reales con `source='hybrid'`; el Gimnasio es una vista derivada.
- Crear mazos, carpetas o contenido se centraliza en la pestaña Crear.
- Biblioteca consulta, busca, filtra y organiza.
- Los datos viven localmente; no agregar sync o backend sin una decisión explícita.
- Por ahora no implementar multiproveedor ni “cualquier API”. OpenAI/Luna es la decisión
  vigente; una eventual versión comercial se evaluará desde un gateway propio.

## Arquitectura crítica

- SQLite usa exclusivamente la API async. Migraciones append-only en `db/schema.js`;
  esquema actual v7.
- `FSRS_COLS` en `db/cards.js` es la fuente única del estado programado.
- Fechas se guardan en UTC y se agrupan por día local en JavaScript.
- El editor guarda marcas dentro de `cards.front/back`; TipTap es solo la interfaz.
- Android usa TipTap en WebView y web usa TipTap sobre React DOM.
- Tras modificar el editor compartido o `editor-web/`, regenerar y commitear
  `assets/editor/editorHtml.js`.
- Las imágenes viven inline como data URI comprimidas y entran en el respaldo.
- Respaldo vigente v3; `settings` y claves nunca se exportan.
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
