# Servidor MCP local de ActiveCard (`mcp/`)

ActiveCard incluye un servidor Model Context Protocol (`stdio`, JSON-RPC 2.0) para que un agente local (Claude Desktop, Codex, Cursor, Antigravity, etc.) consulte y organice tu biblioteca sincronizada usando exactamente el mismo contrato de cuenta privada que la app móvil y web.

## Seguridad y aislamiento

- **Sin `service_role` ni contraseñas en disco:** autenticás por Supabase Auth (`email` + contraseña interactiva en consola) con la clave publishable de ActiveCard y verificación de acceso singleton (`public.activecard_access()`), sujeto al RLS de tu usuario en `activecard_sync` y `activecard-private`.
- **Solo `refreshToken` rotatorio:** la sesión guardada en `%APPDATA%\activecard-mcp\session.json` (Windows) o `~/.config/activecard-mcp/session.json` (macOS/Linux) contiene `{ url, userId, email, refreshToken, updatedAt }`.
- **Sin `record_review`:** el servidor MCP administra estructura, tarjetas (incluyendo LaTeX y bloques ricos compilados con `compileGeneratedBack`), notas, límites diarios e historial, pero los repasos FSRS siguen siendo exclusivos de la app.
- **Protección de escritura:** control de concurrencia optimista (CAS vía `activecard_commit`), validación completa con `validateDocument()`, confirmación exacta por nombre al borrar carpetas/mazos, `dryRun` y token firmado de deshacer (`activecard_undo_action`).

## Puesta en marcha

1. Conectá tu cuenta en la app (Ajustes → Cuenta y sincronización) para confirmar que la biblioteca esté sincronizada.
2. En la carpeta del repositorio ejecutá:

```powershell
npm run mcp:build
npm run mcp:login
npm run mcp:status
```

Para cerrar sesión y borrar el archivo local de tokens:

```powershell
npm run mcp:logout
```

## Configuración `mcpServers`

```json
{
  "mcpServers": {
    "activecard": {
      "command": "node",
      "args": ["<ruta-al-repo>/mcp/dist/server.mjs"]
    }
  }
}
```

## Herramientas expuestas (9)

1. `activecard_account_status`: cuenta conectada, revisión actual, límites diarios y conteos generales.
2. `activecard_get_overview`: progreso diario según prioridades y topes, racha, puntaje de recuerdo a 30 días y tarjetas con más fallos.
3. `activecard_list_library`: listado filtrable de carpetas (con ruta jerárquica), mazos, tarjetas, notas y etiquetas.
4. `activecard_search`: búsqueda normalizada sin tildes ni mayúsculas por texto plano en carpetas, mazos, tarjetas y notas.
5. `activecard_read_entity`: detalle completo de carpeta, mazo, tarjeta, nota o chat del Gimnasio (incluyendo notas heredadas).
6. `activecard_get_review_history`: historial de repasos filtrado por mazo, tarjeta o fechas y su puntaje de recuerdo.
7. `activecard_apply_action`: mutación atómica validada (`create_folder`, `rename_folder`, `move_folder`, `delete_folder`, `create_deck`, `update_deck`, `delete_deck`, `create_card`, `update_card`, `delete_card`, `create_note`, `update_note`, `delete_note`, `update_daily_limits`).
8. `activecard_batch_actions`: hasta 50 acciones en un solo commit atómico con soporte de referencias encadenadas `$ref:<refId>`.
9. `activecard_undo_action`: revierte la mutación asociada al `undoToken` siempre que la revisión remota no haya avanzado desde otro dispositivo.
