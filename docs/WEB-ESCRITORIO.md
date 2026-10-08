# ActiveCard en escritorio

## Diseño aceptado el 7 de octubre de 2026

La web funciona como un espacio de trabajo inspirado en REANCLA. Todas las secciones
siguen disponibles: Inicio, Biblioteca, Crear, Gimnasio, Progreso y Ajustes. Android
conserva sus pestañas y sus gestos.

- Barra izquierda de 64 px, iconos de 20 px dentro de controles de 38 px. El destino
  seleccionado cambia de color; los nombres aparecen al pasar el mouse o enfocar.
- Biblioteca tiene un índice de 240 px: carpetas desplegables, mazos hijos y mazos
  sueltos en la raíz. Buscar un mazo encuentra también los hijos de carpetas plegadas.
- El índice se puede fijar u ocultar. Su tirador lateral aparece únicamente al pasar
  el mouse o recibir foco. Con el índice oculto, pasar por su botón abre una vista
  flotante; no reduce el contenido. Escape y un clic fuera cierran la vista previa.
- El navegador y el editor siguen montados al ocultar o desplegar el índice.
- A la derecha se abre el mazo con sus controles Editar tarjetas y Estudiar. El editor
  individual distribuye frente y dorso en columnas cuando caben.
- La barra lateral guarda una edición válida antes de navegar. Una edición incompleta
  o un fallo de escritura conserva la pantalla y muestra el motivo. El navegador
  advierte antes de cerrar o recargar una tarjeta con cambios pendientes.
  Descartar cambios permite abandonar expresamente un borrador incompleto. Una
  tarjeta creada al navegar conserva su identidad si se vuelve al editor con Atrás.
- El Gimnasio abre el chat directamente. El reloj lleva al historial; no existe un
  panel de historial permanente. El fondo estrellado sigue siendo el de la app.
- Inicio y Crear distribuyen sus contenidos según el ancho. Progreso muestra recuerdo
  y constancia juntos cuando caben, y en filas en ventanas angostas.
- En el estudio, Espacio gira la tarjeta. Una vez vista la respuesta, 1/izquierda
  califica Again, 2/arriba Hard y 3/derecha Good. Los atajos no actúan en campos de
  texto, durante composición, con modificadores ni al mantener una tecla apretada.

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
distinta de GitHub Pages. El servidor escucha únicamente en la máquina local y agrega
los encabezados que requiere SQLite web. `.desktop-preview` no se commitea.

## Cuenta y sincronización: alcance aprobado

Martín confirmó usar el mismo correo, contraseña y proyecto de Supabase que REANCLA,
con tablas y permisos de ActiveCard separados y acceso privado únicamente para él.
Se incluyen carpetas, mazos, etiquetas, tarjetas, imágenes, repasos, progreso e ideas,
además de conversaciones del Gimnasio. Las claves y configuraciones locales no viajan.

El criterio de REANCLA incluye un estado común, revisiones esperadas para impedir que
un dispositivo pise al otro y copias recuperables de ambas alternativas antes de
resolver conflictos. La integración de FSRS debe mantener coherentes sus estados y
su historial; no basta con unir registros y elegir una programación al azar.

La adaptación visual no demuestra que la cuenta o la sincronización estén operativas.
Su cierre requiere migración remota, permisos verificados, inicio de sesión en ambos
dispositivos, Android → web → Android, recuperación offline y conflictos reales.

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

La suite local pasó 350 tests en 36 suites. Expo Doctor offline pasó 21/21 controles;
ESLint con cero warnings y los exports web/Android pasaron. La exportación Android
no acredita una prueba física sobre el Galaxy A15.
