# ActiveCard en escritorio

## Diseño aceptado el 7 de octubre de 2026

La web funciona como un espacio de trabajo inspirado en REANCLA. Todas las secciones
siguen disponibles: Inicio, Biblioteca, Crear, Gimnasio, Progreso y Ajustes. Android
conserva sus pestañas y sus gestos.

- Barra izquierda de 60 px sin logo e iconos de 26 px. Las cinco secciones
  distribuyen el espacio vertical y Ajustes ocupa su franja inferior. El destino
  seleccionado y el icono bajo el cursor cambian a azul. Solo Ajustes tiene una línea
  separadora; los nombres aparecen al pasar el mouse o enfocar con
  teclado, y un clic de mouse no deja el nombre ni un borde inferior persistentes.
- Biblioteca tiene un índice de 280 px: carpetas desplegables, mazos hijos y mazos
  sueltos en la raíz. Su encabezado es el buscador, con creación a su derecha. Abrir y plegar el índice
  o sus carpetas tiene transición; la ruta superior permite volver a Biblioteca,
  carpeta o mazo y respeta el guardado de la edición.
  Buscar un mazo encuentra también los hijos de carpetas plegadas.
  Sus filas miden al menos 46 px, con texto de 14 px; la flecha de una carpeta aparece
  al pasar por su fila o al navegar con teclado.
- El índice se puede fijar u ocultar. Su tirador lateral aparece únicamente al pasar
  el mouse o recibir foco. Con el índice oculto, pasar por su botón abre una vista
  flotante; no reduce el contenido. Escape y un clic fuera cierran la vista previa.
- El navegador y el editor siguen montados al ocultar o desplegar el índice.
- A la derecha se abre el mazo con sus controles Editar tarjetas y Estudiar. El editor
  individual distribuye frente y dorso en columnas cuando caben. El mazo alterna entre
  lista y dos columnas de tarjetas, conserva la elección local y la aplica también
  en edición. Si no caben dos columnas, muestra una. El contenido y los editores usan
  el ancho disponible; Progreso de hoy tiene mayor altura en escritorio.
- La barra lateral guarda una edición válida antes de navegar. Una edición incompleta
  o un fallo de escritura conserva la pantalla y muestra el motivo. El navegador
  advierte antes de cerrar o recargar una tarjeta con cambios pendientes.
  Descartar cambios permite abandonar expresamente un borrador incompleto. Una
  tarjeta creada al navegar conserva su identidad si se vuelve al editor con Atrás.
- El Gimnasio abre el chat directamente. El reloj lleva al historial; no existe un
  panel de historial permanente. Encabezado, respuestas sin recuadro, burbuja del
  usuario y compositor expansible siguen la interfaz del Mentor de REANCLA tanto en
  web como en Android. El fondo estrellado es más oscuro y el pie transparente evita
  un rectángulo detrás del campo. No hay saludo inicial; los controles del campo son
  uniformes y el textarea web no muestra un marco propio. En web, el menú de adjuntos
  es un desplegable anclado al botón; Android conserva el sheet.
- Inicio distribuye repaso a la izquierda y mazos a la derecha, en dos áreas de igual
  altura que se apilan si no caben. Los mazos en progreso tienen prioridad y los
  recientes completan el espacio restante, sin repetir mazos ni mostrar avisos vacíos.
  Los recientes se ordenan por último repaso o fecha de creación. El repaso usa
  título, contadores, botón y barra proporcionados al panel. La racha web reproduce
  el mismo Lottie del celular mediante SVG local; el acceso extra al Gimnasio se quitó.
  Crear ofrece tres superficies amplias con descripción, alineadas arriba y con
  margen interno en su scroll para conservar bordes y halos.
  Progreso alterna recuerdo y constancia en un carrusel horizontal, con arrastre de
  mouse, gesto táctil y botones. Ambos usan todo el ancho; gráfico y cuadrícula tienen
  260 px de alto. Lo que viene conserva barras horizontales
  con filas y cifras más legibles, y distingue el día actual.
  Progreso y los mazos usan el ancho disponible; la tarjeta de estudio llega a 800 px, según el
  espacio disponible. Los controles y superficies web tienen más espacio interior.
- La cuenta web distribuye la explicación y el formulario/estado en dos áreas cuando
  caben. El estado diferencia conexión, avance, pendientes y error; mantiene la fecha
  del último intercambio, los mismos botones y la confirmación antes de restaurar.
  Las copias se despliegan desde Recuperación. No cambia autenticación, permisos ni
  criterios de sincronización.
- En el estudio, Espacio gira la tarjeta. Una vez vista la respuesta, 1/izquierda
  califica Again, 2/arriba Hard y 3/derecha Good. Los atajos no actúan en campos de
  texto, durante composición, con modificadores ni al mantener una tecla apretada.
  Con mouse, un clic gira; un doble clic manteniendo el segundo permite arrastrar
  izquierda/arriba/derecha. Soltar bajo el umbral o cancelar devuelve la tarjeta sin
  calificar. Estrella, lápiz y rayo no arman el arrastre. Los textos de atajos debajo
  se quitaron; los atajos y botones siguen disponibles. Android conserva su swipe.

## Ajuste aprobado el 8 de octubre de 2026

- **Objetivo:** dar más espacio y legibilidad al escritorio y trasladar la interfaz
  del Mentor de REANCLA al Gimnasio.
- **Usuario:** Martín, en su web privada y Android; el cambio del Gimnasio cubre ambos.
- **Flujo:** navegar por secciones, abrir carpetas/mazos desde el índice, editar o
  estudiar tarjetas, conversar y consultar historial, revisar progreso.
- **Entradas:** pedido de Martín, componentes de REANCLA y datos existentes de prueba.
- **Salida:** barra distribuida, índice y superficies más grandes, tarjeta de estudio
  amplia, nuevo gesto de mouse, Gimnasio coherente entre dispositivos y gráfico legible.
- **Reglas:** mantener FSRS, teclado, funciones del Gimnasio y confirmación de acciones;
  aplicar los tamaños de escritorio solo en web y conservar el fondo estrellado.
- **Excepciones:** ventanas pequeñas, navegación con teclado, contenido largo, edición
  pendiente, arrastre cancelado y pulsación sobre controles internos.
- **Calidad:** tooltip desaparece al salir después de un clic; flecha oculta sin hover;
  gestos producen un solo repaso; chat conserva borradores, adjuntos y acciones;
  gráfico aprovecha su panel sin recorte ni cambio de porcentajes.
- **Ambigüedades resueltas:** Martín confirmó el segundo clic mantenido, la estructura
  del Mentor y que el gráfico resultaba pequeño (no denunció superposición).
- **Siguiente verificación:** probar navegación, gesto y chat en navegador; exportar
  Android y comprobar el Gimnasio en el dispositivo antes de acreditar QA nativa.

## Implementación

`DesktopShell` envuelve el Stack sin sustituirlo. Centraliza la barra, el índice y la
protección de navegación de los editores. `desktopLayout` contiene las reglas de
rutas y búsqueda del árbol. Los componentes específicos se montan sólo en web.

Para una vista local aislada, exportar sin cargar las claves de `.env`:

```powershell
$env:EXPO_NO_DOTENV='1'
$env:EXPO_OFFLINE='1'
npx expo export --platform web --output-dir .desktop-preview
node scripts/preview-web.mjs
```

Abrir `http://localhost:8125/activecard/biblioteca`. Esa URL usa una base SQLite
distinta de GitHub Pages. El servidor escucha únicamente en la máquina local y usa
las mismas condiciones de encabezados que GitHub Pages. `.desktop-preview` no se commitea.

## Cuenta y sincronización: alcance aprobado

Martín confirmó usar el mismo correo, contraseña y proyecto de Supabase que REANCLA,
con tablas y permisos de ActiveCard separados y acceso privado únicamente para él.
Se incluyen carpetas, mazos, etiquetas, tarjetas, imágenes, repasos, progreso e ideas,
además de conversaciones del Gimnasio. Los límites diarios se comparten desde el 8/10;
las claves y el resto de configuraciones locales no viajan.

El criterio de REANCLA incluye un estado común, revisiones esperadas para impedir que
un dispositivo pise al otro y copias recuperables de ambas alternativas antes de
resolver conflictos. La integración de FSRS debe mantener coherentes sus estados y
su historial; no basta con unir registros y elegir una programación al azar.

La implementación de cuenta y sync está documentada en `SINCRONIZACION.md`.

La adaptación visual no demuestra que la cuenta o la sincronización estén operativas.
La migración remota y los permisos se verificaron el 7 de octubre. Su cierre requiere
inicio de sesión en ambos dispositivos, Android → web → Android, recuperación offline
y conflictos reales.

## Verificación del escritorio

El 7 de octubre se comprobó la web local con una carpeta, un mazo y dos tarjetas de
prueba: persistencia tras recarga, árbol desplegable, ocultado del índice, vista
previa por hover sin cambiar el ancho ni el texto del editor, línea lateral visible
sólo al pasar el mouse, bloqueo de salida incompleta, guardado al navegar y regreso
al editor sin duplicados. El historial conserva el borrador y Nueva conversación lo
limpia sin persistir una charla vacía.

En estudio, Espacio mostró la respuesta y 2 registró Hard, avanzó la ronda y produjo
un recuerdo ponderado de 50%. Se verificaron gráficos en columnas a 1280 px y el
contenido de progreso/editor a 736 y 320 px sin desbordamiento horizontal. No hubo
errores de consola en estas interacciones.

La suite local pasó 372 tests en 40 suites. Expo Doctor offline pasó 21/21 controles;
ESLint con cero warnings y los exports web/Android pasaron. La exportación Android
no acredita una prueba física sobre el Galaxy A15.
