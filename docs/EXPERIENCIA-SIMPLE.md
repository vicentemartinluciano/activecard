# Experiencia simple — alcance confirmado el 4/11/2026

Martín confirmó la auditoría completa y sus ajustes: implementar sin dejar puntos
del alcance pendientes. Base: `9162a37` (escritura del editor integrada mediante
PR #28). Las propuestas se revisaron con datos sintéticos el 3/11.

## Contratos de la entrega

- FSRS, IDs, historial, backup y sync se conservan. No se amplía el servicio remoto.
- El editor mantiene formatos E032/E033, una única tarjeta con editores montados,
  autoguardado y borradores locales. No mostrar avisos rutinarios de guardado.
- Mantener el + del mazo y Estudiar → tarjetas/orden → Empezar.
- Menú de tarjeta flotante y animado: Mover a otro mazo, Suspender/Reactivar y
  Eliminar; sin Editar ni otra acción. Editar se inicia al tocar el contenido.
- Eliminar mazos/carpetas exige el nombre exacto; eliminar tarjeta muestra su
  contenido y efecto. Descartar un borrador no crea una tarjeta.
- Sin APK nuevo ni operación del teléfono. Entrega web y OTA compatible 1.11.0;
  la recepción y prueba física continúan a cargo de Martín según AGENTS.md.

## Lista de cierre

Cada punto debe tener implementación y evidencia antes de marcar la entrega completa.

- [x] A01: menú por tarjeta, movimiento, suspensión y eliminación accesibles desde
  el mazo; cancelación, errores y coordinación con autoguardado.
- [x] A02: todas las vías de mover usan selección con origen/destino y confirmación.
- [x] A03: Inicio · Biblioteca · Gimnasio · Progreso; Crear como acción contextual y
  compatibilidad de rutas antiguas.
- [x] A04: Biblioteca con Nuevo, búsqueda y filtros; movimientos desde el elemento;
  menús de carpetas en las listas; web angosta sin rail que reduzca el contenido.
- [x] A05: administración secundaria agrupada, orden manual conservado en modo
  explícito, progreso compacto y + actual.
- [x] A06: filtros explícitos que no dependen del foco y se pueden limpiar.
- [x] A07: conservar el inicio actual de estudio, sin botón adicional de opciones.
- [x] A08: material antes de opciones avanzadas; IA con destino heredado, entrada
  desde un mazo, sin mazos vacíos ni selectores redundantes.
- [x] A09: destino y cantidad al inicio de preselección; Guardar disponible durante
  toda la revisión; borradores y reintentos sin duplicados.
- [x] A10: Gimnasio coherente en ambas plataformas, acceso a conversaciones e ideas
  dentro del área; conservar contexto de tarjeta y fondo actual.
- [x] A11: distinguir cola diaria limitada, nuevas disponibles y vencimientos de
  tarjetas aprendidas; períodos y recomendaciones correctos, sin modificar FSRS.
- [x] A12: retirar el falso pendiente «Sin revisar»; no inventar un nuevo estado ni
  migrar procedencia/revisión por un cambio de etiquetas.
- [x] A13: Ajustes agrupados en Cuenta, Estudio, Integraciones y Datos; importar como
  acción normal hasta elegir reemplazo destructivo; ideas dentro del Gimnasio.
- [x] A14: reducir cajas y controles repetidos, etiquetas Frente/Dorso en edición,
  nombres consistentes y áreas táctiles adecuadas.
- [x] Selector jerárquico compartido: raíz accesible durante búsqueda, rutas
  desambiguadas, destino actual deshabilitado, ciclos excluidos, cancelar conserva
  origen y formulario; mover conserva IDs, tarjetas e historial.
- [x] Carga/error/vacío/sin conexión y mensajes recuperables, incluido bloqueo web
  por otra pestaña. No borrar almacenamiento para recuperarse.
- [x] Pruebas focalizadas y completas, lint sin avisos, Doctor offline, verificadores
  SQLite/Postgres y exports web/Android. Revisión real web escritorio y 390 px.
- [x] Commits/push/PR/CI verde, integración, web y OTA verificadas por artefactos.
- [x] Documentación del proyecto y contexto local actualizados con evidencia y
  límites de validación; revisión final requisito por requisito.

## Semántica de los indicadores

Inicio muestra el trabajo elegido para el día por la cola y sus límites. Progreso
muestra por separado las tarjetas nuevas disponibles y los vencimientos de las
tarjetas que ya tienen repasos. Las nuevas sin introducir no son una deuda de
repaso acumulada. La prioridad y suspensión siguen excluyendo los mismos mazos y
tarjetas; la programación FSRS y sus tres notas no cambian.

## Evidencia de entrega

Implementación integrada y publicada. Los prototipos anteriores acreditan la
propuesta; la evidencia siguiente corresponde al código, artefactos y app web reales.


## Ampliación solicitada: generación y estilo (04/11)

Martín pidió actualizar la creación con IA a los formatos del editor y tomar sus
últimos mazos como referencia. Se leyó completo el export local de «Unidad 3» del
03/11 (18 tarjetas), sin modificarlo. Usa listas jerárquicas, términos destacados,
flechas, separadores, citas y desplegables con encabezados significativos.

- [x] Prompt y conversión de bloques JSON a formatos reales: párrafos, títulos,
  listas anidadas/numeradas, citas, separadores, tablas y desplegables.
- [x] Preselección enriquecida, compatibilidad con propuestas anteriores y rechazo
  visible de estructuras inválidas; imágenes conservadas dentro de bloques.
- [x] Pruebas de ida/vuelta por el editor y revisión visual del resultado generado.

El export de referencia contiene saltos literales en algunos cuerpos; no se copia
ese defecto al contrato nuevo. Los datos privados de referencia no se incorporan al
repositorio ni al prompt enviado a terceros. Se incorpora el criterio visual.


### Auditoría de cierre

| Requisitos | Evidencia que los cierra |
|---|---|
| A01 | CardActions y cardManagement; casos de cancelación/error/carrera de INSERT en Jest, eliminación real desde el mazo en web y limpieza en SQLite real. |
| A02, selector | LocationBrowser/FolderPicker/DeckPicker compartidos; pruebas de raíz, rutas, cancelación y exclusiones; movimiento real de mazo y tarjeta, IDs/FSRS/logs conservados en SQLite. |
| A03–A04, A06 | Cuatro rutas principales, redirección de Crear y LibraryContent; regresiones de creación/carga, navegación real Inicio → Biblioteca y carpeta con Nuevo; filtros explícitos en código. |
| A05, A07, A14 | Menús de mazo, editor único y etiquetas; reordenamiento real persistente al recargar, + conservado, Mi orden → Empezar sin calificar; revisión 390 px sin desborde. |
| A08–A09 | CreationFlows, DeckLoading y generator/draft tests; transacción de generación en SQLite; preselección real aislada para conteo, formatos y Guardar fijo. |
| A10 | Ruta Gimnasio abre chat, ideas e historial accesibles; contratos contextuales y fondo preservados por código/pruebas, sin modificar el servicio de IA. |
| A11–A12 | stats.test y ForecastList separan nuevas de vencidas por reps; source=ai se etiqueta Con IA sin migración ni modificación del algoritmo FSRS. |
| A13 | Agrupación de Ajustes e Importar neutro comprobados en la app web; reemplazo conserva su confirmación destructiva existente. |
| Carga/error/vacío | Casos DeckLoading/CreationFlows/databaseError; OPFS comunica bloqueo por pestaña y ofrece reintentar, sin borrar datos; vacíos reales tras mover/borrar. |
| IA y estilo | Export Unidad 3 leído completo; generatedCardFormat/generator tests y verify-generated-format: bloques y spans exactos, compatibilidad de texto e imágenes anidadas. |
| Entrega | PR integrado, gates verdes, bytes de web/OTA comparados, documentación y cuatro archivos de contexto actualizados. |

La suite local completa anterior tuvo dos fallos del mock StyleSheet.flatten,
corregidos y comprobados de forma focalizada. Las repeticiones generales locales
se interrumpieron por carga del equipo después de aprobar CI; no se presentan
como un pase local. El cierre completo se apoya en las 74 suites/644 pruebas de CI.

## Entrega verificada — 04/11/2026

Fuente de código `39e1631cd686c6bd3652b621a279fa021fb357ab`,
[PR #29](https://github.com/vicentemartinluciano/activecard/pull/29).
[CI del PR](https://github.com/vicentemartinluciano/activecard/actions/runs/41871262778)
y [CI de main](https://github.com/vicentemartinluciano/activecard/actions/runs/41873831027)
aprobados: 74 suites / 644 pruebas, ESLint sin avisos, Doctor offline 21/21,
verificadores SQLite/Postgres y formatos, exports Android/web.

[Web pública](https://vicentemartinluciano.github.io/activecard/), publicada por
[Pages 41873831022](https://github.com/vicentemartinluciano/activecard/actions/runs/41873831022).
HTML y los seis archivos JavaScript coinciden byte por byte con su artefacto.
Bundle principal `index-9964cd006066483cb2c276b5b8205207.js`, SHA-256
`6ee10ea4e1381f91f38498c6d1e44a24c455721a5234a77d0c61a161f08eaa82`.

OTA Android publicada el 04/11 a las 17:20:34 UTC, rama/canal `preview`,
runtime `1.11.0`: grupo `35cab969-6ebe-47bf-9592-35cf391d066f`,
update `01a1a793-a8b4-7765-b1be-77ddd8742e2b`.
El endpoint del canal sirve ese ID; el asset de lanzamiento coincide byte por byte
con el export local y con el hash del manifest. SHA-256:
`8cb88b514071c256608bbc5ed2aa3a8373531d5e74b3b62c18ec258164f6eea3`.
Export sin dotenv, sin claves configuradas en el bundle, publicado con
`--skip-bundler` para reutilizar esos bytes.

Evidencia reproducible local en `.desktop-preview/release-2026-11-04/` del
checkout principal: `web-verification.json`, `ota-verification.json`,
`ota-privacy.json` y `publication.json`. No contienen claves ni headers de assets.
Las capturas durables están en
`C:/Users/marti/.codex/visualizations/2026/10/25/01a174e9-c73a-7070-9cbb-22f1500a7847/`.

QA web de la aplicación exportada por CI, con datos sintéticos en localhost:
crear carpeta y mazo dentro, autoguardar, menú flotante de tres acciones,
suspender/reactivar, cancelar borrado, mover tarjeta entre mazos y borrarla en
destino; Inicio → Biblioteca, Gimnasio, mover mazo y abrir destino, orden manual
persistente tras recarga y Estudiar → Mi orden → Empezar con la tarjeta esperada.
Escritorio y viewport medido de 390 × 844 px; innerWidth y scrollWidth de 390.
Ajustes agrupados e Importar neutro también comprobados.

La preselección enriquecida se revisó a 390 × 844 con el componente real y
RichText, sobre ocho propuestas sintéticas compiladas; rutas/base/borrador
aislados y editor de modificación sustituido. Guardar permanece visible al
desplazar, desplegables abren y descartar/recuperar actualiza el conteo.
Esto acredita presentación e interacción de preselección, no una llamada al
modelo ni persistencia de esa fixture. La persistencia atómica y los reintentos
están cubiertos por Jest y SQLite real; formatos por el verificador del editor.

No hubo llamada real de generación, login de QA ni cambios a las tarjetas de
referencia. No se construyó ni instaló APK ni se operó el Galaxy A15. La recepción
de OTA y QA física siguen a cargo de Martín por decisión previa. Publicación,
artefactos, revisión web y prueba física son evidencias distintas.
