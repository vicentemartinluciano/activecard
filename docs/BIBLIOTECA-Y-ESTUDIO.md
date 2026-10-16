# Biblioteca y estudio — revisión del 16/10/2026

## Comportamiento

- Los mazos abren editables. Solo la tarjeta activa monta dos editores; las demás
  usan lectura enriquecida. Cambiar de tarjeta, estudiar, exportar o ir al Gimnasio
  guarda primero el borrador. Una tarjeta nueva se escribe en el mismo mazo y se
  inserta en SQLite al completar ambas caras. Guardados simultáneos se agrupan.
- El Gimnasio contextual queda a la izquierda de la estrella. Tocar el nombre del
  mazo permite renombrarlo. «Editar detalles» es una sección plegable y animada.
- Reordenar conserva el orden manual: arrastre en Android y botones en web sobre
  la lista completa sin filtros.
- Compartir genera un JSON de un solo mazo con tarjetas, imágenes, tablas y
  etiquetas. Excluye carpeta, identidades de sync, programación personal,
  destacados, suspensiones, historial y conversaciones. El receptor empieza con
  tarjetas nuevas. Se exige al menos una tarjeta. Desde Ajustes, los archivos
  `kind: deck` van a la preselección aditiva para evitar reemplazar la biblioteca.
- TableKit de TipTap agrega tablas 3 × 3, controles para filas/columnas, encabezado
  y borrado. No agrega módulos nativos. La persistencia usa un bloque estructurado
  con sentinel U+E030 y JSON codificado; las celdas conservan contenido enriquecido.
  Búsqueda/contexto de IA reciben texto legible. Las tablas anchas se desplazan
  horizontalmente al estudiar.
- Repaso y estudio por mazo usan StarField, sin título superior, con volver junto
  a la barra y tarjeta ampliada (máximo web 1120 px). FSRS y sus notas no cambian.

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

Esto no equivale a QA del Galaxy A15. Faltan teclado, tablas desplazables sin
calificar por accidente, compartir/importar, detalles animados y subcarpetas sobre
Android físico. No se construye ni instala APK ni se publica OTA en esta sesión;
Martín conserva el comando de construcción de 1.11.0.
