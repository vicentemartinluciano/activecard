# Arquitectura de ActiveCard

## Visión
App personal de aprendizaje a largo plazo: repetición espaciada (FSRS) +
asociación de ideas auditada por IA ("Gimnasio Mental"). Todo local, sin backend.

## Estructura de carpetas

```
src/
├── app/                     # rutas (expo-router)
│   ├── _layout.js           # Stack raíz, tema oscuro, init DB
│   ├── index.js             # Home: Repasar (N) / Estudiar un mazo / Crear / Mazos / Ajustes
│   ├── repaso.js            # repaso diario (FSRS + Gimnasio Mental)
│   ├── crear/index.js       # fuente: texto | archivo | Notion | manual
│   ├── crear/preseleccion.js
│   ├── mazos/index.js
│   ├── mazos/[id]/index.js
│   ├── mazos/[id]/estudiar.js  # modo Quizlet (swipe)
│   └── ajustes.js
├── db/                      # SQLite: client, schema (migraciones), repos
├── lib/                     # claude.js, prompts.js, scheduler.js (ts-fsrs), queue.js, notion.js, files.js
├── components/              # FlipCard, ChatAuditor, SwipeDeck, MicButton...
└── theme/                   # tokens de diseño (fondo #0B0B0F, acento único)
```

## Esquema SQLite (migraciones con PRAGMA user_version en src/db/schema.js)

- `decks(id, name, created_at)`
- `tags(id, name UNIQUE)` / `deck_tags(deck_id, tag_id)`
- `cards(id, deck_id, front, back, source 'manual'|'ai'|'hybrid', origin_card_id,
  created_at, + estado FSRS: due, stability, difficulty, elapsed_days,
  scheduled_days, reps, lapses, state, last_review)`
- `review_logs(id, card_id, rating, mode 'daily'|'quizlet', reviewed_at)`
- `connections(id, card_id, final_text, transcript JSON, hybrid_card_id, created_at)`
- `priorities(id, target_type 'deck'|'tag', target_id, weight 1-3, month 'YYYY-MM')`
- `settings(key, value)`

## Flujos núcleo

**Repaso diario**: `queue.getDailyQueue(hoy)` → tarjetas con `due <= hoy`,
ordenadas por peso mensual del mazo/etiqueta (desc) y luego más vencida primero.
Frente → voltear → "Lo recordaba" (Good) / "No lo recordaba" (Again) →
`scheduler.rate()` actualiza estado FSRS → Gimnasio Mental (opcional, salteable).

**Modo Quizlet** (`mazos/[id]/estudiar`): swipe derecha=Good / izquierda=Again
sobre todo el mazo. Alimenta FSRS igual. No abre Gimnasio Mental.

**Modo Enfoque**: flag en settings + lista de deck_ids; el repaso diario filtra
a esos mazos (y completa con próximas a vencer si hay pocas debidas).

**Generación IA**: fuente (texto | TXT/MD leído local | PDF→base64 como bloque
`document` | Notion via token) → prompt generador (modo completo|conceptos_clave)
→ JSON `{cards:[{front,back}]}` → pantalla de preselección (editar/descartar/
agregar/elegir mazo) → se insertan como tarjetas nuevas FSRS.

**Gimnasio Mental**: chat multi-turno con el Auditor Exigente (system prompt
estricto). Respuesta JSON `{veredicto: 'valida'|'critica', feedback,
hybrid_card|null}`. Al validar: inserta en `connections` + crea tarjeta híbrida
(`source='hybrid'`, mismo mazo, `origin_card_id`) que entra al ciclo FSRS.

## Reglas de la API de Claude
- `fetch` directo a `https://api.anthropic.com/v1/messages`, modelo `claude-sonnet-5`,
  headers `anthropic-version: 2023-06-01`, `x-api-key`,
  `anthropic-dangerous-direct-browser-access: true` (para el preview web).
- Key desde `process.env.EXPO_PUBLIC_ANTHROPIC_API_KEY` (embebida en el build).
- Parseo JSON robusto: extraer primer bloque `{...}`; 1 reintento pidiendo solo JSON.

## Notion
- Internal integration token (`EXPO_PUBLIC_NOTION_TOKEN`), API v1
  (`Notion-Version: 2022-06-28`). `notion.js` acepta URL o ID de página,
  recorre bloques con paginación y children recursivos → texto plano.
- Las páginas deben compartirse con la integración (menú ··· → Connections).
- En preview web puede fallar por CORS: validar en dispositivo.

## Limitaciones conocidas
- `@jamsch/expo-speech-recognition` no funciona en Expo Go ni web → micrófono
  solo verificable en el APK. En web se oculta el MicButton.
- PDF: límite de la API de Claude ~100 páginas / 32MB por request.
