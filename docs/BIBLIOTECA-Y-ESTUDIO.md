# Biblioteca y estudio — revisión del 25/10/2026

## Creación y navegación contextual

Biblioteca y cada carpeta permiten Nuevo mazo (Manual o Con IA), Nueva carpeta o
subcarpeta y Mover mazo existente. `CreationSheet` comparte los formularios con la
pestaña Crear, que empieza en raíz. El destino muestra su ruta completa y se
puede cambiar antes de confirmar. Cancelar no inserta registros ni borra una
preselección pendiente. Un destino eliminado pide elegir otra ubicación.

El borrador de IA v2 conserva carpeta, nombre y elección de mazo nuevo/existente,
incluyendo reapertura; los borradores anteriores siguen siendo legibles. Elegir
Nuevo mazo no lo inserta: se crea al confirmar las tarjetas seleccionadas. Mazo
e identidad del borrador se confirman en la misma transacción, para reintentar
en ese mazo después de un cierre o fallo de guardado. Al terminar se vuelve al
contenedor y se abre el mazo, evitando volver a la generación al pulsar Atrás.

`LibraryContent` muestra en raíz las carpetas raíz y los mazos sueltos; Todos los
mazos conserva el catálogo completo. La búsqueda raíz y los filtros por etiquetas
incluyen mazos anidados. Buscar en una carpeta incluye descendientes y tarjetas,
con rutas para distinguir nombres repetidos. Los vacíos se distinguen de una
búsqueda sin resultados y ofrecen crear contenido cuando corresponde.

`LibraryBreadcrumbs` muestra los ancestros en Android. Web reutiliza el shell;
el índice despliega todos los ancestros y observa cambios de la base local.
Navegar desde un mazo drena primero el autoguardado y conserva el borrador si falla.

Opciones de carpeta agrupa renombrar, mover y borrar. Opciones de mazo ofrece
Mover mazo y Sacar de esta carpeta; ambas muestran origen/destino y requieren
confirmar el movimiento. Se puede traer un mazo desde otra carpeta, conservando
su ID, tarjetas e historial. El borrado mantiene la confirmación por nombre exacto.

## Comportamiento

- Los mazos abren editables. Solo la tarjeta activa monta dos editores; las demás
  usan lectura enriquecida. Cambiar de tarjeta, estudiar, exportar o ir al Gimnasio
  completa el guardado pendiente. `cardAutosave.js` guarda a los 350 ms y drena
  una sola cola, incluyendo texto escrito durante un guardado. Una tarjeta nueva
  se inserta al completar ambas caras; INSERT e identidad del borrador son atómicos.
  Los borradores incompletos quedan en `settings` local, se recuperan al recargar y
  no entran en FSRS, backup ni sync. Los conflictos conservan el borrador y avisan.
  No hay botones Guardar/Cancelar ni cambio entre edición y reordenamiento.
  El editor individual reutiliza `EditableCardRow` y el mismo autoguardado.
- El Gimnasio contextual queda a la izquierda de la estrella. Tocar el nombre del
  mazo permite renombrarlo. Un botón pequeño en el encabezado despliega los
  detalles con animación; cerrado no ocupa una tarjeta propia.
- Reordenar usa flechas en la tarjeta sobre la lista completa sin filtros, en el
  mismo modo editable. Las dos columnas web fluyen verticalmente sin huecos entre
  tarjetas de distinta altura.
- Compartir genera un JSON de un solo mazo con tarjetas, imágenes, tablas y
  etiquetas. Excluye carpeta, identidades de sync, programación personal,
  destacados, suspensiones, historial y conversaciones. El receptor empieza con
  tarjetas nuevas. Se exige al menos una tarjeta. Desde Ajustes, los archivos
  `kind: deck` van a la preselección aditiva para evitar reemplazar la biblioteca.
- Las tablas adaptan los controles de REANCLA: seis puntos para seleccionar y
  abrir opciones de filas, columnas, encabezados y borrado. Se redimensionan en
  escritorio; móvil conserva esos anchos y amplía columnas pequeñas sólo para leer.
  Imagen y tabla se insertan desde el + de la pill contextual de formato, también
  en un párrafo vacío; no hay botones permanentes dentro del campo.
  No agrega módulos nativos. La persistencia usa un bloque estructurado
  con sentinel U+E030 y JSON codificado; las celdas conservan contenido enriquecido.
  Búsqueda/contexto de IA reciben texto legible. Las tablas anchas se desplazan
  horizontalmente al estudiar; `richTable.js` comparte anchos y geometría de
  celdas combinadas. `colwidth` se conserva al guardar y reabrir.
- Las citas contiguas separadas conservan sus límites mediante U+E024. Las
  tarjetas antiguas siguen agrupando las líneas de una misma cita. Los títulos
  H1/H2/H3 escalan 1,55/1,3/1,12 veces el texto base, igual que el editor.
  La barra web se suscribe a transacciones y selecciones de TipTap.
- Repaso y estudio por mazo usan StarField, sin título superior, con volver junto
  a la barra y tarjeta ampliada (máximo web 1120 px). FSRS y sus notas no cambian.
  El rayo también está disponible al estudiar por mazo o Puntos débiles: tras
  calificar abre el Gimnasio para esa tarjeta, y se apaga al pasar a la siguiente.

## Carpetas y compatibilidad

SQLite v10 agrega `folders.parent_id` con migración append-only. Las existentes
quedan en raíz. Crear y el detalle comparten la creación de subcarpetas; el detalle permite mover carpetas
y navegar a ancestros/hijos. El índice web refleja el árbol y la búsqueda mantiene
visibles los ancestros de resultados.

No se permiten ciclos ni destinos inexistentes. Borrar exige escribir el nombre
exacto: los mazos quedan sueltos y los hijos suben al padre anterior. Los ciclos
formados por movimientos concurrentes de sync se cortan hacia la raíz registrando
conflicto para conservar la alternativa local.

Respaldo v5 conserva la jerarquía y restaura v1–v4. Importar incluye los ancestros
necesarios y remapea padres tras insertar carpetas. Sync acepta carpetas antiguas
sin `parent_id` y expresa padres mediante identidades estables. No cambia tablas
ni permisos de Supabase. Clientes anteriores pueden rechazar el nuevo formato:
actualizar web y Android antes de usar la jerarquía entre dispositivos.

## Verificación de navegación del 25/10/2026

[PR #24](https://github.com/vicentemartinluciano/activecard/pull/24): CI con 64
suites/538 pruebas, ESLint sin warnings, Doctor offline 21/21, verificadores
SQLite/Postgres y exports Android/web. Las 23 pruebas locales enfocadas cubren
creación contextual, cancelación, destinos eliminados, reintentos, navegación
con autoguardado y búsqueda. La suite completa local se interrumpió tras dos
timeouts bajo carga; la suite completa pasó en CI sin modificar esos tests.

QA sobre el export web de CI, con datos sintéticos: carpetas anidadas, mazo
manual en su carpeta, origen/destino al mover, raíz frente a catálogo global,
búsqueda y entrada a IA con destino heredado. Viewport real de 390 × 844 px,
sin desborde horizontal ni índice inicialmente superpuesto. El recorrido
carpeta → mazo → ancestro → Atrás vuelve al nivel anterior. Los enlaces de
ancestros usan dismissTo, conservando el guardado previo del editor.

No se generó ni instaló un APK ni se publicó OTA. La prueba física sigue a
cargo de Martín; el editor compartido y sus assets no cambian.

## Verificación y entrega anteriores

Pruebas de persistencia de tablas, export privado, árbol, ciclos concurrentes y
edición de mazos. `verify-library-sqlite.mjs` comprueba migración, repositorios,
borrado, backup, aplicación de sync e importación con remapeo en SQLite real.
La CI lo ejecuta junto a las comprobaciones anteriores de SQLite y SQL.

La revisión visual local web comprobó crear una tarjeta dentro del mazo, insertar
y guardar una tabla y leerla al estudiar. Evidencia local:
`outputs/mejoras-biblioteca/estudio-tablas-web.png`.

Revisión web local del 18/10 con contenido sintético: crear y completar tarjetas
sin botón Guardar; recargar un borrador con una cara y retomarlo; plegar detalles
desde el encabezado; mostrar tabla/imagen dentro de la pill; abrir el editor
individual desde estudio; distinguir H1/H2/H3 y citas separadas en la respuesta;
tocar una celda sin girar la tarjeta. Evidencia:
`outputs/correcciones-editor-estudio/estudio-formato-tabla.png`.

El 19/10 se quitaron los avisos rutinarios de guardado del mazo y del editor
individual. Agregarlos y quitarlos desplazaba los hijos de `Stagger` y repetía
la animación de entrada al escribir; el guardado en cola y los errores continúan.
Una regresión de la pantalla real comprueba que teclear, iniciar y terminar el
guardado no remonten el editor ni repitan la entrada.

El APK 1.11.0 se construyó el 16/10 (EAS
`55b278b9-5651-4b6f-a30f-75a1d3616b41`). ADB confirmó 1.11.0 / código 6
instalado el 18/10; no se instaló desde esta revisión. El 19/10 Martín dejó la
prueba física a su cargo: teclado, tablas desplazables sin calificar por accidente,
compartir/importar, detalles animados, subcarpetas y recepción de OTA. La entrega
compatible usa runtime 1.11.0 y canal `preview`; no requiere otro APK.
