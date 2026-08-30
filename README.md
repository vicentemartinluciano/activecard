# ActiveCard

App **privada** de aprendizaje a largo plazo: repetición espaciada (FSRS) +
"Gimnasio Mental" de asociación de ideas asistido por GPT-5.6 Luna. No se publica en
tiendas — se instala como APK propio y se actualiza por EAS Update (OTA).

La conexión con GPT-5.6 Luna se configura una vez desde Ajustes con una clave de
OpenAI guardada solo en el dispositivo. Un gateway propio sigue siendo la opción
recomendada si la app deja de ser de uso personal.

## Operación diaria (sin terminal)

Los `.bat` de la carpeta `comandos AC/`:

| Script | Qué hace | Cuándo usarlo |
|---|---|---|
| `INICIAR-APP.bat` | Levanta Expo en modo desarrollo | Para probar en el teléfono |
| `ACTUALIZAR-APP.bat` | Envía cambios OTA a la app instalada (~1 min) | Cambios de código/UI |
| `CONSTRUIR-APP-ANDROID.bat` | Valida respaldo, repo y calidad; luego construye el APK (~10-20 min) | Solo si se agrega un módulo nativo |

## Desarrollo

- `npm test` — tests (Jest)
- `npm run lint` — ESLint
- Contexto para Claude Code: `CLAUDE.md` + `docs/ARQUITECTURA.md`
