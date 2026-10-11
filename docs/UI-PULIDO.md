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
  fue conectado durante la sesión y ADB confirmó el APK 1.6.0. La UI nueva debe comprobarse
  después de publicar y cargar la actualización compatible.

Los cambios viven en la rama `codex/pulido-ui-activecard`, separada del trabajo de
sincronización en curso. No modificar dependencias ni publicar desde un checkout sucio.

## Cambios y validación local

Primitivas con tamaños consistentes, selección de alto contraste, foco de teclado,
texto secundario más legible y superficies mejor definidas. Inicio y Crear reducen
espacio vacío en escritorio; Biblioteca resume los contadores y muestra el contexto
de carpeta. Formularios con ancho de lectura; controles de tarjetas, chat e historial
con áreas cómodas. La carga de un mazo distingue espera, error y biblioteca vacía.

- Lint estricto y Expo Doctor offline (21/21) aprobados.
- Jest: 450 tests en 47 suites; incluye carga de mazos y controles accesibles frente
  a los atajos de estudio. En esta PC se ejecutó en serie con timeout de 60 s.
- Exportaciones locales web y Android aprobadas. CI vuelve a exportar el commit final.
- Navegador local con biblioteca sintética independiente, sin cuenta ni claves:
  Inicio, Biblioteca, mazo, edición, estudio, Crear/IA, Gimnasio y Ajustes.
  Revisión a 390, 768 y 1440 px; sin desbordamiento horizontal en las vistas comprobadas.
  Giro con Espacio comprobado; no se calificaron tarjetas reales ni se enviaron chats.
- La revisión estrecha detectó la ruta superior partida y el placeholder del chat
  recortado; se ajustaron a una línea y una invitación breve, respectivamente.

No se modifican FSRS, sincronización, formatos de datos, navegación ni dependencias.
