# Biblioteca y estudio — revisión del 04/11/2026 (en preparación)

## Creación y navegación contextual

Biblioteca y cada carpeta muestran Nuevo: Mazo manual, Mazo con IA y Carpeta.
Crear deja de ser una sección principal; los accesos anteriores siguen redirigiendo
a la Biblioteca correspondiente. Crear con IA lleva directo al material, heredando
la carpeta. El destino manual muestra su ruta y permite Cambiar → recorrer → Usar
esta carpeta; Cancelar cambio conserva nombre y destino. Cancelar no inserta datos.
La navegación principal tiene Inicio, Biblioteca, Gimnasio y Progreso. Web angosta
usa las mismas cuatro tabs y retira el rail lateral.

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

Las carpetas tienen opciones en la lista y al abrirlas: renombrar, mover y borrar.
Mover un mazo se inicia desde sus opciones y usa el mismo selector jerárquico,
con origen/destino visibles y confirmación. Elegir Biblioteca lo deja suelto. No hay
acción duplicada de Sacar de esta carpeta ni chips que lo muevan directamente.
El borrado de mazos/carpetas mantiene la confirmación por nombre exacto.

## Comportamiento

- Los mazos abren editables. Solo la tarjeta activa monta dos editores; las demás
  usan lectura enriquecida. Cambiar de tarjeta, estudiar, exportar o ir al Gimnasio
  completa el guardado pendiente. `cardAutosave.js` guarda a los 350 ms y drena
  una sola cola, incluyendo texto escrito durante un guardado. Una tarjeta nueva
  se inserta al completar ambas caras; INSERT e identidad del borrador son atómicos.
  Los borradores incompletos quedan en `settings` local, se recuperan al recargar y
  no entran en FSRS, backup ni sync. Los conflictos conservan el borrador y avisan.
  No hay botones Guardar/Cancelar para la tarjeta. Ordenar tarjetas activa
  explícitamente las flechas sobre la lista completa; Listo las oculta.
  El editor individual reutiliza `EditableCardRow` y el mismo autoguardado.
- El Gimnasio contextual queda a la izquierda de la estrella. Tocar el nombre del
  mazo permite renombrarlo. Los detalles, vista web y orden se agrupan en el menú
  del mazo. Cada tarjeta tiene un menú flotante con Mover a otro mazo, Suspender /
  Reactivar y Eliminar. Eliminar muestra contenido y efecto; un error conserva la
  edición y permite reintentar. No hay una acción Editar redundante.
- Reordenar usa flechas en la tarjeta sobre la lista completa sin filtros, en el
  modo de orden explícito, conservando la edición directa. Las dos columnas web fluyen verticalmente sin huecos entre
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

## Desplegables dentro de las tarjetas (27/10/2026)

El + de la pill contextual agrega «Desplegable». El selector de formato convierte
los bloques seleccionados: primero el título, luego el contenido. Desactivar
Desplegable o usar Backspace al inicio del título desarma el bloque conservando
su formato y contenido. Texto cambia el formato sin quitar el desplegable. Enter entra al
cuerpo y, en su último párrafo vacío, sale. Se admiten desplegables anidados,
formato, listas, imágenes y tablas, también dentro de celdas.

El editor los inicia abiertos para escribir; estudiar los inicia cerrados para
cada tarjeta/cara. Abrirlos no gira ni califica. En web de escritorio la flecha
se revela al pasar el cursor por el bloque y al enfocarla con teclado. En tacto
queda tenue (40 %) y el encabezado tiene al menos 44 px de alto. El espacio de
la flecha se conserva para evitar movimientos al aparecer. La sangría es de
20 px por nivel para reducir el ancho perdido, también al anidar bloques.

El contenido usa U+E031 dentro de `front/back`; no requiere migraciones ni
módulos nativos. El estado plegado es solo visual. Búsqueda/IA incluyen el texto
interior; autoguardado reconoce imágenes incluso dentro de bloques sin título,
y conserva un desplegable vacío como borrador incompleto. Backup y sync llevan
el contenido con el resto de la tarjeta.

QA local con los componentes web reales en una página de prueba: crear desde
la pill, escribir título/cuerpo, plegar y abrir al estudiar. Escritorio: flecha
oculta en reposo y visible con hover. Navegador con viewport real de 390 × 844 y
entrada táctil emulada: flecha tenue y sin desborde horizontal. Evidencia local:
`.desktop-preview/toggles/desktop.png` y `.desktop-preview/toggles/mobile.png`.
Estas comprobaciones no sustituyen el teclado, los gestos ni la recepción de
OTA en el Galaxy A15. No se construyó ni instaló un APK para este cambio.

Entrega publicada el 27/10/2026, autorizada por Martín con la QA física completa
diferida a su disponibilidad. [PR #26](https://github.com/vicentemartinluciano/activecard/pull/26)
integrado en `f192edaa18bffe46f638a81ef8a4ab78e396a091`.
[CI main 40600559698](https://github.com/vicentemartinluciano/activecard/actions/runs/40600559698)
verde: 67 suites/557 pruebas, lint sin warnings, Doctor offline 21/21,
verificadores SQLite/Postgres y exports Android/web.

Web publicada por el
[despliegue 40600559714](https://github.com/vicentemartinluciano/activecard/actions/runs/40600559714).
El HTML y el bundle servido coinciden con su artefacto de Pages. SHA-256 del
bundle: `1e73b24df2f626d5deb83c13e60c5d55121ee904ad3cd78a31eab06a1a1b341d`.

OTA Android en rama/canal `preview`, runtime `1.11.0`: grupo
`a3d3492b-cb77-455c-a3f5-64913b4a03ed`, update
`01a17faa-9156-77ad-86f0-ce560d79e179`. El manifest del canal sirve ese ID;
el asset descargado coincide byte por byte con el export local, SHA-256
`fed29854a72eba163af19ea5568df3262af84cb7fefe749db888d8cb51e1cbbc`.
Se exportó sin `.env`, se comprobó que no incluyera sus claves y se publicó
con `--skip-bundler` para no volver a inyectar variables remotas de EAS.
Evidencia local en `.desktop-preview/toggles/pages-verification.json`,
`ota-privacy-check.json` y `ota-verification.json`. La publicación no acredita
recepción en el teléfono ni QA nativa; no se operó el dispositivo.

### Formatos combinables (02/11/2026)

El encabezado conserva el bloque completo: párrafo, H1/H2/H3, cita, viñetas o
lista numerada. Se puede cambiar su formato manteniendo el desplegable activo;
la pill refleja ambos estados. Desactivarlo devuelve el bloque con su formato,
marcas y contenido. El cuerpo mantiene su formato independiente. Los títulos
enriquecidos también se renderizan al estudiar, con la flecha alineada con su
primera línea y la sangría de 20 px. Se conservan los desplegables anteriores;
no requiere migración de SQLite ni de respaldos.

Regresiones automatizadas: conversión/reapertura/restauración de encabezados,
citas con varios párrafos, numeración inicial, estilos y alineación; estados
simultáneos de formato/desplegable en la pill; lectura enriquecida sin activar
el giro ni la calificación. QA visual local sobre los componentes web: cambiar
Título 2 a Título 1 azul, reabrir y conservar el cuerpo. Evidencias en
`.desktop-preview/toggles/formats-menu.png` y `formats-desktop.png`.

Entrega completa el 02/11/2026: [PR #27](https://github.com/vicentemartinluciano/activecard/pull/27)
integrado en `536b2fbf9d93de6172541711e5fc44caafd4d48f`.
[CI main 41550193917](https://github.com/vicentemartinluciano/activecard/actions/runs/41550193917)
verde, con 67 suites/569 pruebas, lint, Doctor offline 21/21, SQLite/Postgres y
exports Android/web. [Web publicada por 41550193927](https://github.com/vicentemartinluciano/activecard/actions/runs/41550193927):
el HTML y el bundle servido coinciden con el artefacto de Pages, SHA-256
`646fa24112e6b82385bd40457f38ac194c9663a9ab28d49f53ad484b3ed86d74`.

OTA Android publicada en rama/canal `preview`, runtime `1.11.0`: grupo
`e11bd4a6-544c-475f-9600-a6c430661c1a`, update
`01a19ebf-3053-75db-9f6a-7a575c778428`. El manifest del canal sirve ese ID y
el asset remoto coincide byte por byte con el export local, SHA-256
`ef69e0ad4bbd0c971f109e011c2c2a695268c58d24488d220b866fbf2bbb1eba`.
Se exportó sin `.env`, se controló que sus claves no estuvieran en el bundle
y se publicó ese export con `--skip-bundler`. Evidencia local:
`.desktop-preview/toggles/formats-pages-verification.json`,
`formats-privacy-check.json` y `formats-ota-verification.json`.
No requiere otro APK. No se operó el teléfono ni se afirmó recepción de la
OTA o QA física; Martín las mantiene a su cargo.

### Escritura y formato (04/11/2026)

[PR #28](https://github.com/vicentemartinluciano/activecard/pull/28), integrado en
`9162a37c7f1a858fd97aaac5661b7a71a0f33f39`, corrige Enter en el encabezado
desplegable, las selecciones y el borrado en sus límites. Shift+Enter conserva
saltos internos. El guardado conserva listas anidadas, estilos combinados,
caracteres literales, espacios y reinicios de numeración. Convertir un ítem no
absorbe sus hermanos. La pill agrega tachado, quitar estilos y sangría táctil;
deshacer formato conserva lo recién escrito. Reglas y compatibilidad de E032/E033
en [EDITOR-ESCRITURA.md](EDITOR-ESCRITURA.md).

[CI main 41768967837](https://github.com/vicentemartinluciano/activecard/actions/runs/41768967837)
verde: 69 suites/617 pruebas, lint estricto, Doctor offline 21/21,
SQLite/Postgres reales y exports Android/web. Se comprobó sobre los componentes
web reales dividir el título, guardar/reabrir con espacios intactos y cambiar
sangría desde la pill conservando descendientes. Viewports reales de 390 y
1280 px sin desbordamiento. Capturas en
`.desktop-preview/writing-audit/escritura-movil.png` y `escritura-desktop.png`.
El botón «Guardar y reabrir» de esas capturas pertenece al arnés de prueba.

[Web publicada por 41768968045](https://github.com/vicentemartinluciano/activecard/actions/runs/41768968045):
HTML y JavaScript servidos coinciden byte por byte con el artefacto de Pages.
Bundle `_expo/static/js/web/index-bbd84d368d03cbf011cfe492588608c4.js`, SHA-256
`d7c72ac845c14e8fa0d606ababbaef8d606cf348fbf51356bccfc3c3b77b2b18`.

OTA Android en rama/canal `preview`, runtime `1.11.0`: grupo
`c477d032-edd1-4355-96e9-15b1c604981b`, update
`01a1a4ba-e3fb-783d-b7c2-c38e602397e5`, sobre el commit de código `9162a37`.
El manifest del canal sirve ese ID. El bundle remoto coincide byte por byte con
el export local y con el hash del asset, SHA-256
`35815cdc192fb4a18b6b2c677b33d91f4334354e61dd2b0a0c85d42009177991`.
Se exportó sin `.env`, se verificaron los secretos locales y la presencia de
los formatos nuevos, y se publicó con `--skip-bundler`. Evidencia local en
`.desktop-preview/writing-audit/pages-verification.json`, `privacy-check.json`
y `ota-verification.json`. Los clientes anteriores deben actualizarse antes de
editar contenido con los formatos nuevos. No se construyó ni instaló un APK ni
se operó el teléfono. Recepción y QA física a cargo de Martín.

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

La entrega se completó el 26/10/2026: PR #24 integrado en `dd6b479`, CI main
`40260968188` verde y web publicada por el despliegue `40260968162`. El HTML y
el bundle servido por GitHub Pages coinciden con el artefacto del despliegue
(SHA-256 del bundle: `896ffbc1e07588f5a2c8d7d03d6c4f5db5686643c3b324849523138369f7149e`).

OTA Android publicada en rama/canal `preview`, runtime `1.11.0`: grupo
`6249e415-7c45-4dc2-ba25-e5100ddf44a5`, update
`01a177ed-4aa7-784f-bbee-723467935671`. Se verificó que el canal sirve ese ID y
que su asset de lanzamiento coincide byte por byte con el export local
(SHA-256 `a367fb020dec0d6d956cb0b994e6e977215d3c89ca49eae7bf41da9924f5e8a8`).
El export se generó sin `.env`; las claves de IA siguen exclusivamente en los
settings locales. Se usó el bundle ya exportado al publicar, sin volver a
inyectar variables del entorno EAS en el código.

No se construyó ni instaló otro APK. La recepción de la OTA y la prueba física
siguen a cargo de Martín; el editor compartido y sus assets no cambian.

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
