# ActiveCard

App **privada** de aprendizaje a largo plazo: repetición espaciada (FSRS) +
"Gimnasio Mental" de asociación de ideas auditado por Claude. No se publica en
tiendas — se instala como APK propio y se actualiza por EAS Update (OTA).

## Operación diaria (sin terminal)

Los `.bat` de la carpeta `comandos/`:

| Script | Qué hace | Cuándo usarlo |
|---|---|---|
| `INICIAR-APP.bat` | Levanta Expo en modo desarrollo | Para probar en el teléfono |
| `ACTUALIZAR-APP.bat` | Envía cambios OTA a la app instalada (~1 min) | Cambios de código/UI |
| `CONSTRUIR-APP-ANDROID.bat` | Construye un APK nuevo en la nube (~10-20 min) | Solo si se agrega un módulo nativo |

## Desarrollo

- `npm test` — tests (Jest)
- `npm run lint` — ESLint
- Contexto para Claude Code: `CLAUDE.md` + `docs/ARQUITECTURA.md`
