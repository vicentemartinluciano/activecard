# Pulido de UI de web y Android

Alcance confirmado por Martín el 11 de octubre de 2026: mejorar la presentación de
toda la aplicación manteniendo identidad y flujos actuales.

- **Objetivo y usuario:** una interfaz más coherente y cómoda para Martín en web y Android.
- **Recorrido:** revisar primitivas compartidas, Inicio, Biblioteca y mazos, Crear e IA,
  edición y estudio, Gimnasio e historial, Progreso y Ajustes; validar los tamaños y estados.
- **Entradas:** código vigente, auditoría visual previa y observaciones del navegador.
- **Resultado:** texto secundario legible, selección clara, controles cómodos, superficies
  proporcionadas y formularios con ancho de lectura. Crear conserva sus emojis.
- **Reglas:** conservar fondo oscuro, cobalto, estrellas del Gimnasio, navegación, datos,
  programación FSRS, gestos, guardado y confirmación de acciones. Sin cambios nativos.
- **Casos límite:** ventanas angostas y de poca altura, nombres y contenido largos,
  biblioteca vacía, carga de tarjetas, errores, foco de teclado y acciones internas de estudio.
- **Calidad:** selección con contraste suficiente, controles principales de al menos 44 px,
  ausencia de desbordamiento horizontal a 390/768/1440 px; carga diferenciada de vacío;
  repaso y editor conservan sus contratos. Export y tests se registran por separado de QA física.
- **Límite de evidencia:** una simulación móvil de web no prueba Android. El Galaxy A15
  fue conectado durante la sesión y ADB confirmó el APK 1.6.0. Se comprobó la ejecución
  de la UI nueva en el teléfono; el recorrido físico restante queda a cargo de Martín,
  por su elección explícita. Los detalles de esa separación se registran abajo.

Implementación integrada en `main` mediante el PR #18, commit `9a15886`. Se trabajó en
un worktree independiente y se conservaron los cambios de sincronización anteriores.

## Cambios y validación local

Primitivas con tamaños consistentes, selección de alto contraste, foco de teclado,
texto secundario más legible y superficies mejor definidas. Inicio y Crear reducen
espacio vacío en escritorio; Biblioteca resume los contadores y muestra el contexto
de carpeta. Formularios con ancho de lectura; controles de tarjetas, chat e historial
con áreas cómodas. La carga de un mazo distingue espera, error y biblioteca vacía.

- Lint estricto y Expo Doctor offline (21/21) aprobados.
- Jest en CI: 450 tests en 47 suites; incluye carga de mazos y controles accesibles
  frente a los atajos de estudio. En esta PC se verificó la suite inicial de 449 tests
  en serie y después las 11 pruebas de teclado/SwipeCard con timeout de 60 s.
- Exportaciones locales y finales de CI para web y Android aprobadas.
- Navegador local con biblioteca sintética independiente, sin cuenta ni claves:
  Inicio, Biblioteca, mazo, edición, estudio, Crear/IA, Gimnasio y Ajustes.
  Revisión a 390, 768 y 1440 px; sin desbordamiento horizontal en las vistas comprobadas.
  Giro con Espacio comprobado; no se calificaron tarjetas reales ni se enviaron chats.
- La revisión estrecha detectó la ruta superior partida y el placeholder del chat
  recortado; se ajustaron a una línea y una invitación breve, respectivamente.

No se modifican FSRS, sincronización, formatos de datos, navegación ni dependencias.

## Publicación y comprobación en el teléfono

- CI y deploy web del commit `9a15886`: aprobados. La web publicada fue recargada y
  muestra el formulario nuevo. Sobre la biblioteca sintética del artefacto final de
  CI se comprobó Espacio para girar y flecha derecha para avanzar de 1/3 a 2/3.
- OTA Android en `preview`, runtime 1.6.0, grupo
  `b2ae3f41-ae8f-4ac5-a868-0c60a140eeae`, update
  `01a12d37-3a2f-71f8-b2b8-d0ea1851f47c`, desde ese mismo commit.
- Galaxy A15: la app fue reabierta y se observaron los botones nuevos de Inicio,
  las descripciones nuevas de Crear, la selección del formulario IA, Biblioteca,
  detalle de mazo y frente de la tarjeta de estudio con controles legibles.
  No se calificaron tarjetas reales, editaron datos ni enviaron mensajes a la IA.
- Martín eligió hacer la revisión física restante: giro y scroll del dorso, editor
  y teclado, Gimnasio e historial, Progreso y Ajustes. Esas interacciones nativas
  no se afirman verificadas por navegador, CI ni disponibilidad de la OTA.
