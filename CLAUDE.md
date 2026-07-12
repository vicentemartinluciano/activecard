# CLAUDE.md — Router de contexto de ActiveCard

> Sesión nueva: leé esto entero (es corto a propósito). El detalle vive en `docs/`
> y se lee solo cuando hace falta. Hablá en español rioplatense ("vos"), tono de
> CTO/socio que explica el porqué y pide confirmación antes de cada etapa.

## Qué es
**ActiveCard** — app de aprendizaje a largo plazo ("Soberanía Mental"): repetición
espaciada (FSRS) + "Gimnasio Mental" de asociación de ideas auditado por Claude
(React Native / Expo SDK 57, expo-router, JavaScript). App **privada**: no se
publica en Play Store, se instala como APK propio y se actualiza por EAS Update
(OTA). Datos 100% locales en SQLite (`expo-sqlite`) — sin backend propio.

## Mapa de docs (leé según necesidad)
- `docs/ARQUITECTURA.md` → estructura de carpetas, esquema SQLite, flujos núcleo (repaso, generación IA, Gimnasio Mental).

## Comandos clave
- `npm test` — tests (Jest). Deben pasar siempre.
- `npm run lint` — ESLint.
- **Preview web** (verificar cambios): MCP de preview con el server `activecard-web` de
  `.claude/launch.json`. Navegar a `http://localhost:8081/`, verificar por DOM
  (preview_eval) + console errors.
- OTA al teléfono: `comandos/ACTUALIZAR-APP.bat` (= `eas update --branch preview`). Solo JS/UI.
- APK nuevo: `comandos/CONSTRUIR-APP-ANDROID.bat` (= `eas build -p android --profile preview`).
  Solo si se agrega un módulo NATIVO nuevo o cambia el identificador.
- CI: GitHub Actions corre lint+tests en cada push.

## Convenciones de trabajo
- **Un feature por commit.** Mensajes terminan con `Co-Authored-By: Claude <modelo> <noreply@anthropic.com>`.
- **Verificar en preview ANTES de commitear.** Tras cambios de lógica, correr tests.
- **Nunca** commitear `.env` ni `.claude/settings.local.json` (ya ignorados).
- Tests en `**/__tests__/*.test.js`; congelar fecha con `jest.setSystemTime(...)` si hay lógica de fechas.
- Trabajar en pasos chicos: commit + push + esperar CI verde.
- **Cuando el usuario indica que la sesión terminó** ("se terminó la sesión", "ya
  terminamos", "cerramos por hoy", etc.): antes de cerrar, actualizar los docs de
  contexto del proyecto — este `CLAUDE.md` y `docs/ARQUITECTURA.md` (commitear si
  hubo cambios) — y también los documentos de contexto equivalentes en Google
  Drive del usuario, si hay un conector de Drive disponible en la sesión.

## Decisiones de producto (NO re-litigar sin el usuario)
- **Identificador Android** `com.marti.activecard` — irreversible una vez que hay OTA activo.
- **IA: Claude Sonnet 5 (`claude-sonnet-5`) para TODO** (generar tarjetas + auditar conexiones). Un solo proveedor.
- **API keys en `.env`** (gitignoreado) vía `EXPO_PUBLIC_ANTHROPIC_API_KEY` y `EXPO_PUBLIC_NOTION_TOKEN`; en EAS van como env vars del proyecto.
- **Datos 100% locales** (SQLite). Sin sync a Notion — la base "Conexiones Creadas" en Notion se descartó explícitamente.
- **Fuentes de tarjetas**: texto pegado / archivo por document picker (PDF va en base64 directo a Claude como bloque `document`; TXT/MD se leen local) / página de Notion con internal integration token (sin OAuth).
- **FSRS** (`ts-fsrs`), calificación binaria: "Lo recordaba"=Good, "No lo recordaba"=Again.
- **Mazos** (cada tarjeta pertenece a 1) con **ícono Feather** y **prioridad 0-100%**
  (slider, pasos de 5; 0% = pausado; la cola diaria intercala por stride scheduling
  proporcional al %). Reemplazó al viejo Modo Enfoque y a las prioridades mensuales.
  **Etiquetas** sobre mazos = solo filtro/búsqueda en Biblioteca.
- **Carpetas** (tabla `folders`, migración v3): un mazo pertenece a 0 o 1 carpeta.
  Biblioteca = grilla de carpetas arriba + mazos sueltos abajo; pantalla
  `carpetas/[id]` gestiona sus mazos; chips de carpeta en el detalle del mazo.
  Borrar carpeta NUNCA borra mazos (quedan sueltos). Las carpetas no llevan tags.
- **Buscador de Biblioteca** (`lib/search.js`, en memoria con `toPlainText` — NO SQL
  LIKE): filtra carpetas por nombre, mazos por nombre/etiqueta y tarjetas por texto
  plano, insensible a tildes/mayúsculas.
- **2 modos de estudio**: repaso diario (cola FSRS + Gimnasio Mental) y mazo específico
  estilo Quizlet (swipe, alimenta FSRS, SIN Gimnasio; la sesión excluye lo ya estudiado
  hoy y al final ofrece ronda extra de falladas, que también califica en FSRS).
  **Swipe unificado**: el repaso diario usa el MISMO SwipeCard que el modo mazo
  (derecha=Good, izquierda=Again, sin gate de flip; botones siempre visibles).
- **Racha** (≥1 tarjeta/día en cualquier modo; derivada de review_logs) con Lottie en
  nativo y **progreso diario por mazo** (derivado de review_logs, se reinicia solo).
- **Gimnasio Mental**: chat de texto iterativo con auditor exigente; micrófono opcional (speech nativo Android, sin API extra); al validar → guarda conexión + crea tarjeta híbrida que entra a FSRS. Siempre salteable.
- **Generación con IA es opcional** (creación manual + importar de Quizlet pegando el texto exportado). Preservar mnemotecnias del usuario textualmente.
- **Rich text en tarjetas**: marcas livianas en el TEXT (`**negrita**`, `*cursiva*`,
  `__subrayado__`, `==resaltado==`, `[[color:texto]]`, listas "- "); editor con barrita
  al seleccionar (RichField), render con RichText, `toPlainText()` para previews/IA.
- **Respaldo manual** (Ajustes): exporta/importa un JSON con todos los datos (sin
  settings/claves). Es el puente celu ↔ web (sin sync automático). Versión 2
  (incluye folders); los respaldos v1 siguen siendo restaurables.
- **Versión web pública** en GitHub Pages (repo público, workflow deploy-web.yml,
  baseUrl /activecard). El build corre sin .env → las claves NO van embebidas en la
  web: se pegan en Ajustes (solo visible en web) y viven en settings del navegador.
  En el APK las claves sí van embebidas por env vars de EAS.
- **Sin notificaciones** (app pasiva). **UI estilo Quizlet sobre fondo #0B0B0F**, acento
  azul #3E63DD + paleta de apoyo (racha naranja, verde `successBright` para progreso,
  textColors), bottom tabs (Inicio/Crear/Biblioteca), engranaje → Ajustes. Todo en español.
- **Convención de superficies** (rediseño Quizlet): toda card visual usa `Card`
  (surfaceCard nivel base / surfaceHigh nivel "high", radios 16-20 de `theme.radius`)
  y `Pill` (píldoras translúcidas para tags/contadores/badges) de `components/ui.js` —
  NO definir cards ad-hoc por pantalla. Barras de progreso: verde = repaso diario,
  azul = progreso por mazo, naranja = racha.

## Dónde estamos
- Fases 0-6 y rediseño F8-F15 completos (tema azul, tabs, prioridad %, racha,
  progreso diario, falladas, rich text, import Quizlet, respaldo, web pública).
- F16: subir env vars a EAS y construir el primer APK + smoke test.
- F17-F20 completas (rediseño Quizlet 2.0): contenedores Card/Pill en toda la app,
  swipe unificado en el repaso diario, sistema de Carpetas (migración v3 + backup v2)
  y buscador integrado en Biblioteca.
- Plan completo: `C:\Users\marti\.claude\plans\mira-quiero-planear-la-moonlit-possum.md`.

## Cuentas
- Anthropic: key creada y validada (en `.env` local como EXPO_PUBLIC_ANTHROPIC_API_KEY).
- Notion: integración interna "ActiveCard" creada y validada (token en `.env`).
- GitHub: vicentemartinluciano / repo público `activecard` (CI + deploy de Pages).
- Expo/EAS: vicentemartinluciano, proyecto `activecard` (id c0ae7728-…-c8a010375d8c).
- Web pública: https://vicentemartinluciano.github.io/activecard/

## Trampas conocidas (no re-descubrir)
- **Metro + OneDrive**: el file-watching es poco confiable — si el preview no refleja
  un cambio, reiniciar el server de preview (no debuggear bundle viejo).
- **SQLite web**: SOLO la API async de expo-sqlite (la sync se cuelga). Al recargar,
  la apertura puede fallar transitoriamente por locks de OPFS ("Access Handle…" /
  "Invalid VFS state") → db/client.js reintenta; no cachear promesas rechazadas.
- **El navegador embebido del preview de Claude Code retiene locks de OPFS** entre
  recargas → verificar flujos con DB en un Chrome real apuntando a localhost:8081.
- **lottie-react-native no funciona en web** → StreakFlame.web.js (resolución por
  extensión de plataforma; un require condicional NO alcanza, Metro resuelve estático).
