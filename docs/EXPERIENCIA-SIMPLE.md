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

- [ ] A01: menú por tarjeta, movimiento, suspensión y eliminación accesibles desde
  el mazo; cancelación, errores y coordinación con autoguardado.
- [ ] A02: todas las vías de mover usan selección con origen/destino y confirmación.
- [ ] A03: Inicio · Biblioteca · Gimnasio · Progreso; Crear como acción contextual y
  compatibilidad de rutas antiguas.
- [ ] A04: Biblioteca con Nuevo, búsqueda y filtros; movimientos desde el elemento;
  menús de carpetas en las listas; web angosta sin rail que reduzca el contenido.
- [ ] A05: administración secundaria agrupada, orden manual conservado en modo
  explícito, progreso compacto y + actual.
- [ ] A06: filtros explícitos que no dependen del foco y se pueden limpiar.
- [ ] A07: conservar el inicio actual de estudio, sin botón adicional de opciones.
- [ ] A08: material antes de opciones avanzadas; IA con destino heredado, entrada
  desde un mazo, sin mazos vacíos ni selectores redundantes.
- [ ] A09: destino y cantidad al inicio de preselección; Guardar disponible durante
  toda la revisión; borradores y reintentos sin duplicados.
- [ ] A10: Gimnasio coherente en ambas plataformas, acceso a conversaciones e ideas
  dentro del área; conservar contexto de tarjeta y fondo actual.
- [ ] A11: distinguir cola diaria limitada, nuevas disponibles y vencimientos de
  tarjetas aprendidas; períodos y recomendaciones correctos, sin modificar FSRS.
- [ ] A12: retirar el falso pendiente «Sin revisar»; no inventar un nuevo estado ni
  migrar procedencia/revisión por un cambio de etiquetas.
- [ ] A13: Ajustes agrupados en Cuenta, Estudio, Integraciones y Datos; importar como
  acción normal hasta elegir reemplazo destructivo; ideas dentro del Gimnasio.
- [ ] A14: reducir cajas y controles repetidos, etiquetas Frente/Dorso en edición,
  nombres consistentes y áreas táctiles adecuadas.
- [ ] Selector jerárquico compartido: raíz accesible durante búsqueda, rutas
  desambiguadas, destino actual deshabilitado, ciclos excluidos, cancelar conserva
  origen y formulario; mover conserva IDs, tarjetas e historial.
- [ ] Carga/error/vacío/sin conexión y mensajes recuperables, incluido bloqueo web
  por otra pestaña. No borrar almacenamiento para recuperarse.
- [ ] Pruebas focalizadas y completas, lint sin avisos, Doctor offline, verificadores
  SQLite/Postgres y exports web/Android. Revisión real web escritorio y 390 px.
- [ ] Commits/push/PR/CI verde, integración, web y OTA verificadas por artefactos.
- [ ] Documentación del proyecto y contexto local actualizados con evidencia y
  límites de validación; revisión final requisito por requisito.

## Semántica de los indicadores

Inicio muestra el trabajo elegido para el día por la cola y sus límites. Progreso
muestra por separado las tarjetas nuevas disponibles y los vencimientos de las
tarjetas que ya tienen repasos. Las nuevas sin introducir no son una deuda de
repaso acumulada. La prioridad y suspensión siguen excluyendo los mismos mazos y
tarjetas; la programación FSRS y sus tres notas no cambian.

## Evidencia de entrega

Implementación en curso. Los escenarios de los prototipos y sus capturas son
evidencia de la propuesta; no acreditan todavía la aplicación implementada.


## Ampliación solicitada: generación y estilo (04/11)

Martín pidió actualizar la creación con IA a los formatos del editor y tomar sus
últimos mazos como referencia. Se leyó completo el export local de «Unidad 3» del
03/11 (18 tarjetas), sin modificarlo. Usa listas jerárquicas, términos destacados,
flechas, separadores, citas y desplegables con encabezados significativos.

- [ ] Prompt y conversión de bloques JSON a formatos reales: párrafos, títulos,
  listas anidadas/numeradas, citas, separadores, tablas y desplegables.
- [ ] Preselección enriquecida, compatibilidad con propuestas anteriores y rechazo
  visible de estructuras inválidas; imágenes conservadas dentro de bloques.
- [ ] Pruebas de ida/vuelta por el editor y revisión visual del resultado generado.

El export de referencia contiene saltos literales en algunos cuerpos; no se copia
ese defecto al contrato nuevo. Los datos privados de referencia no se incorporan al
repositorio ni al prompt enviado a terceros. Se incorpora el criterio visual.


### Evidencia parcial actualizada (04/11)

- Verificador SQLite de Biblioteca aprobado con movimiento de tarjetas sin cambiar
  FSRS/IDs/historial, traslado de borradores, eliminación y guardado atómico de IA.
- Verificadores de sincronización SQLite/Postgres aprobados; Doctor offline 21/21.
- Batería general local: 72/73 suites, 634/636 casos; dos fallos del mock de
  StyleSheet.flatten en preselección, corregido; repetición focalizada aprobada
  (3 suites / 20 casos), incluida la nueva generación enriquecida.
  Esta ejecución no acredita todavía el código posterior de generación enriquecida.
- `node scripts/verify-generated-format.mjs`: aprobado; ida/vuelta por los
  conversores reales del editor con títulos, listas, numeración, tablas y desplegables.
- Revisión visual local realizada en escritorio y a 390 × 844 (innerWidth y
  scrollWidth medidos en 390): crear carpeta, heredar destino al crear mazo,
  editar/autoguardar tarjeta, menú flotante de tres acciones, suspender/reactivar,
  cancelar eliminación, mover tarjeta a otro mazo y eliminarla desde el destino.
  También: Inicio → Biblioteca desde su tab, entrada al Gimnasio, mover un mazo
  desde su menú y abrir su destino. Datos sintéticos en localhost:8144, sin login.
  Capturas locales: `.desktop-preview/qa/menu-tarjeta-390.jpg` y
  `.desktop-preview/qa/carpeta-destino-390.jpg`. La exportación web revisada precede
  al agregado de generación por bloques; falta revisar esa parte con export nuevo.
- Sin commit, integración ni publicación de esta revisión todavía. Export Android
  de control aprobado (bundle Android `index-f70bcdc050498a668728dfd68d2ec072.hbc`); sin construir APK ni operar el teléfono.
