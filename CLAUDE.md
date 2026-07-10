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

## Decisiones de producto (NO re-litigar sin el usuario)
- **Identificador Android** `com.marti.activecard` — irreversible una vez que hay OTA activo.
- **IA: Claude Sonnet 5 (`claude-sonnet-5`) para TODO** (generar tarjetas + auditar conexiones). Un solo proveedor.
- **API keys en `.env`** (gitignoreado) vía `EXPO_PUBLIC_ANTHROPIC_API_KEY` y `EXPO_PUBLIC_NOTION_TOKEN`; en EAS van como env vars del proyecto.
- **Datos 100% locales** (SQLite). Sin sync a Notion — la base "Conexiones Creadas" en Notion se descartó explícitamente.
- **Fuentes de tarjetas**: texto pegado / archivo por document picker (PDF va en base64 directo a Claude como bloque `document`; TXT/MD se leen local) / página de Notion con internal integration token (sin OAuth).
- **FSRS** (`ts-fsrs`), calificación binaria: "Lo recordaba"=Good, "No lo recordaba"=Again.
- **Mazos** (cada tarjeta pertenece a 1) + **etiquetas** sobre mazos + prioridad mensual por peso (1-3).
- **3 modos de estudio**: repaso diario (cola FSRS + Gimnasio Mental), mazo específico estilo Quizlet (swipe, alimenta FSRS, SIN Gimnasio), Modo Enfoque (filtra el diario a mazos elegidos).
- **Gimnasio Mental**: chat de texto iterativo con auditor exigente; micrófono opcional (speech nativo Android, sin API extra); al validar → guarda conexión + crea tarjeta híbrida que entra a FSRS. Siempre salteable.
- **Generación con IA es opcional** (también hay creación manual). Preservar mnemotecnias del usuario textualmente.
- **Sin notificaciones** (app pasiva). **UI ultra minimalista**, fondo #0B0B0F, un solo acento, todo en español.

## Dónde estamos
- Fases 0-6 completas: scaffolding, DB async + FSRS, CRUD de mazos/tarjetas,
  repaso diario + Quizlet, generación con IA (texto/archivo/Notion),
  Gimnasio Mental con auditor, ícono y UI pulidos.
- Falta la Fase 7: crear API key de Anthropic + token de Notion con el usuario,
  `eas init`, subir env vars a EAS y construir el primer APK.
- Plan completo: `C:\Users\marti\.claude\plans\mira-quiero-planear-la-moonlit-possum.md`.

## Cuentas
- Anthropic: cuenta existente en console.anthropic.com (key pendiente de crear en Fase 7).
- Notion: integración interna pendiente de crear en Fase 7.
- Expo/GitHub: confirmar usuario en Fase 0/7.
