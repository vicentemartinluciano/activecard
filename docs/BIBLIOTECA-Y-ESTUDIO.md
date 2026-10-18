# Biblioteca y estudio — revisión del 18/10/2026

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
quedan en raíz. Crear centraliza las subcarpetas; el detalle permite mover carpetas
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

## Verificación y entrega

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

Esto no equivale a QA del Galaxy A15. Faltan teclado, tablas desplazables sin
calificar por accidente, compartir/importar, detalles animados y subcarpetas sobre
Android físico. El APK 1.11.0 se construyó el 16/10 (EAS
`55b278b9-5651-4b6f-a30f-75a1d3616b41`); no se instaló desde esta conversación.
La revisión del 18/10 requiere publicación posterior: no se construye otro APK
ni se publica OTA como parte de estas correcciones.
