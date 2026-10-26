# Propuesta: biblioteca, carpetas y creación contextual

Fecha: 25/10/2026. Martín confirmó los cinco cambios de esta propuesta.
Estado: implementación local en validación; todavía no publicada.

## Diagnóstico

La biblioteca permite organizar contenido, pero obliga a abandonar el lugar de
trabajo para crearlo. La regla vigente de centralizar la creación en la pestaña
Crear produjo una separación que hoy agrega pasos y pierde el destino elegido.
Conviene compartir la implementación del formulario y ofrecerlo desde ambos lugares.

Hallazgos comprobados en el código anterior a esta intervención:

| Fricción | Evidencia | Consecuencia |
| --- | --- | --- |
| Una carpeta ofrece Crear subcarpeta, pero no Nuevo mazo. | `src/app/carpetas/[id]/index.js` | Hay que salir de la carpeta para crear su contenido. |
| El mazo manual se crea sin destino. | `src/app/(tabs)/crear.js`, `src/db/decks.js` | Hay que abrir detalles y asignarle carpeta después. |
| La generación con IA no conserva una carpeta de origen. | `src/app/crear/ia.js`, `src/lib/draftStore.js`, `src/app/crear/preseleccion.js` | Añadir sólo un acceso en la carpeta dejaría incompleto el recorrido con IA. |
| Agregar mazos sólo ofrece mazos sueltos. | `src/app/carpetas/[id]/index.js`, filtro `looseDecks` | Reorganizar desde otra carpeta obliga a buscar otra pantalla. |
| Una x visible junto a cada mazo lo saca de la carpeta sin nombrar la acción. | `src/app/carpetas/[id]/index.js` | La intención del control queda ambigua. |
| La portada web muestra mazos y depende del índice para las carpetas; Android muestra accesos a carpetas y luego todos los mazos. | `src/components/DesktopLibraryHome.js`, `src/app/(tabs)/biblioteca.js` | La organización cambia entre plataformas y no distingue claramente raíz de catálogo global. |
| La ruta completa existe en el shell web; en móvil el mazo no tiene un acceso equivalente a su carpeta. | `src/components/DesktopShell.js`, `src/app/mazos/[id]/index.js` | Volver a la ubicación depende del historial de navegación. |
| Los resultados de carpetas/mazos no muestran sistemáticamente la ruta completa. | `src/components/DesktopLibraryHome.js`, `src/app/(tabs)/biblioteca.js` | Nombres iguales en distintas materias son difíciles de distinguir. |

Alcance de la evidencia: inspección del código y documentación pública de otras
apps. No es una prueba de usabilidad con usuarios ni QA físico de Android.

## Comparación con otras aplicaciones

Fuentes oficiales consultadas el 25/10/2026. Son patrones documentados; no se
inició sesión ni se probó cada producto en dispositivos.

| Aplicación | Patrón documentado | Aplicación a ActiveCard |
| --- | --- | --- |
| [Brainscape](https://brainscape.zendesk.com/hc/en-us/articles/115002369971-How-do-I-create-or-delete-Decks) | Dentro de una clase se crea un mazo desde la lista y después se abre el editor de tarjetas. | Crear en el contenedor actual y continuar directamente en el mazo. |
| [RemNote](https://help.remnote.com/en/articles/6030703-documents-and-folders) | Carpetas anidadas con creación, movimiento y organización de contenido dentro de ellas. | Hacer de la carpeta un lugar operativo, con acciones locales. |
| [Anki](https://docs.ankiweb.net/manual/editing) | El formulario de altas muestra explícitamente el mazo de destino y permite elegir otro. | Mostrar y permitir cambiar el destino antes de confirmar. |
| [Mochi](https://www.mochi.cards/docs/decks/intro/) | Jerarquía de mazos y submazos para organizar temas. | Exponer la jerarquía existente de ActiveCard de manera consistente. No convertir carpetas en mazos ni heredar preferencias de estudio. |
| [Quizlet](https://help.quizlet.com/hc/en-ca/articles/360030986151-Organizing-study-content-with-folders) | Distingue crear una carpeta de agregar contenido existente a ella; las acciones documentadas varían según plataforma. | Nombrar por separado Nuevo mazo y Mover mazo existente. No usar Agregar para ambas cosas. |

Conclusión de diseño, inferida de la comparación y del código: el destino tiene
que acompañar la acción desde su inicio hasta su confirmación. Un botón aislado
no resuelve los recorridos manual, IA, cancelación y vuelta al contenedor.

## Alcance propuesto para implementar

1. **Crear desde donde estás.** En Biblioteca y en cada carpeta: Nuevo mazo como
   acción principal. Abre el mismo formulario compartido, con dos caminos:
   Manual y Con IA. Muestra Dentro de con la ruta actual preseleccionada y la
   posibilidad de cambiarla. Nueva subcarpeta y Mover mazo existente quedan
   disponibles como acciones secundarias. La pestaña Crear conserva sus tres
   opciones y reutiliza la misma selección de destino, comenzando en raíz.
2. **Conservar el recorrido.** Crear manualmente abre el nuevo mazo ya ubicado.
   Cancelar devuelve a la carpeta sin crear nada. La generación con IA conserva
   el destino en su borrador local y en la preselección, también tras recargar.
   Crear el mazo sólo ocurre al confirmar la preselección. Si la carpeta fue
   eliminada, se informa el problema y se pide elegir otro destino.
3. **Mostrar la ubicación.** Ruta Biblioteca / Materia / Tema / Mazo, adaptable
   a pantallas pequeñas, con acceso a los ancestros. En web se reutiliza la del
   shell para no duplicarla; se despliegan sus ancestros en el árbol. Volver a
   la carpeta y Atrás conservan su significado y no acumulan rutas repetidas.
   Navegar desde un editor respeta el guardado pendiente existente.
4. **Organizar con acciones claras.** Mover mazo existente abre un selector con
   búsqueda, ubicación de origen y confirmación del destino. Incluye mazos de
   otras carpetas: mueve su pertenencia, no duplica contenido. Las acciones de
   carpeta van a Opciones: Renombrar, Mover carpeta y Borrar carpeta. Las de
   mazo incluyen Mover y Sacar de esta carpeta. Se elimina la x ambigua.
5. **Una biblioteca coherente.** En raíz, En esta ubicación muestra carpetas
   raíz y mazos sueltos. Todos los mazos conserva el catálogo global. Dentro de
   una carpeta se muestran sus hijos directos, con secciones Subcarpetas y
   Mazos y cantidades explícitas. Los estados vacíos ofrecen crear contenido.
   La búsqueda de Biblioteca sigue siendo global; en carpeta se agrega Buscar
   en esta carpeta, incluyendo descendientes y mostrando la ruta del resultado.
   Los filtros por etiquetas conservan acceso a todos los mazos.

Se conservan identidad visual, pestañas, editor con autoguardado, preselección de
IA, FSRS y confirmaciones de borrado. La mejora utiliza la jerarquía existente;
no requiere un módulo nativo nuevo ni una migración de esquema.

Estudiar una carpeta completa, reorganizar todas las pestañas, agregar nuevos
modos de estudio o cambiar el modelo de datos quedan fuera de esta primera
intervención: necesitan resolver contratos propios y no corrigen la fricción principal.

## Ejemplo del recorrido

Biblioteca → Facultad → Administración de Operaciones → Nuevo mazo → Manual →
nombre Programación lineal → Crear y abrir. El mazo ya pertenece a Administración
de Operaciones. Volver a esa carpeta lo muestra en su lista. Con IA, el destino
acompaña la generación y la selección de tarjetas antes de crear el mazo.

La vista interactiva adjunta a la conversación usa contenido de ejemplo y simula
creación manual, cancelación, navegación y movimiento. No guarda datos reales,
no ejecuta IA y no representa una versión implementada.

Se comprobó en el navegador del prototipo: creación manual con destino heredado,
apertura del mazo, regreso a la carpeta con el listado actualizado, movimiento de
un mazo desde otra carpeta, conservación del destino hasta la preselección de IA
simulada y cancelación sin crear un mazo adicional. Se revisó visualmente el
formulario en una superficie angosta. Esto no valida el comportamiento de la app.

## Criterios de aceptación y validación posterior a la confirmación

- Crear un mazo manual en raíz y en una carpeta anidada lo inserta con el destino
  correcto en una operación atómica; doble toque y error no duplican mazos.
- Crear desde la pestaña Crear y desde una carpeta usa el mismo formulario;
  abrir Crear después no reutiliza un destino contextual viejo.
- Cancelar no crea registros ni borra otro borrador.
- El borrador de IA conserva destino durante generación, preselección y reapertura;
  mantiene compatibilidad con borradores anteriores y permite corregir un destino
  eliminado. El usuario sigue confirmando qué tarjetas se guardan.
- Mover muestra origen/destino, mantiene IDs e historial y actualiza el listado.
- Búsqueda y vista Todos los mazos mantienen accesible contenido de subcarpetas;
  distinguir sin resultados de carpeta vacía.
- La navegación por ruta y por Atrás no pierde texto ni descarta errores de guardado.
- Verificar web en escritorio y viewport real de 390 px, nombres largos y teclado.
  La prueba táctil en Galaxy A15 sigue a cargo de Martín.
- Pruebas de integración del flujo y del repositorio afectado, controles SQLite
  pertinentes, ESLint sin warnings, Jest, Expo Doctor offline y export Android.
  Regenerar el editor sólo si se modifica su código compartido.
- Actualizar AGENTS.md y documentación para que Crear sea el centro de la
  implementación compartida, con entradas contextuales en Biblioteca y carpetas.

Confirmación recibida: implementar los cinco puntos anteriores en app y web.
La publicación y la recepción física de una OTA son etapas de evidencia separadas.
