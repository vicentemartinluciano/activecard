import process from "node:process";
import { createAuthenticatedClient, runCliLogin, runCliLogout, runCliStatus } from "./auth";
import { createMcpServer } from "./protocol";
import { createActiveCardStore } from "./store";
import { createActiveCardTools } from "./tools";

function parseArgs(argv: string[]) {
  const args = argv.slice(2);
  let command = "serve";
  let sessionPath: string | undefined;

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === "--help" || arg === "-h" || arg === "help") {
      command = "help";
      continue;
    }
    if (arg === "--session" && i + 1 < args.length) {
      sessionPath = args[i + 1];
      i += 1;
      continue;
    }
    if (arg.startsWith("--session=")) {
      sessionPath = arg.slice("--session=".length);
      continue;
    }
    if (!arg.startsWith("-") && command === "serve" && ["login", "logout", "status", "serve"].includes(arg)) {
      command = arg;
      continue;
    }
    throw new Error(`Argumento desconocido: ${arg}. Usá --help para ver las opciones.`);
  }

  return { command, sessionPath };
}

function printUsage() {
  process.stderr.write(
    [
      "ActiveCard MCP Server (local por stdio, Supabase Auth + RLS)",
      "",
      "Uso:",
      "  node mcp/dist/server.mjs [serve] [--session <ruta>]   Inicia el servidor MCP por stdio (default).",
      "  node mcp/dist/server.mjs login [--session <ruta>]   Inicia sesión con tu cuenta sincronizada (sin guardar contraseña).",
      "  node mcp/dist/server.mjs status [--session <ruta>]  Verifica la sesión conectada y la revisión en Supabase.",
      "  node mcp/dist/server.mjs logout [--session <ruta>]  Cierra sesión y borra el archivo de sesión.",
      "",
      "Variables opcionales:",
      "  ACTIVECARD_SESSION_PATH   Ruta al archivo de sesión (para usar otro perfil).",
      "  ACTIVECARD_SUPABASE_URL   URL HTTPS del proyecto Supabase (opcional; usa ActiveCard por defecto).",
      "  ACTIVECARD_SUPABASE_KEY   Clave publishable/anon de Supabase (nunca service_role).",
      "  ACTIVECARD_REFRESH_TOKEN  Refresh token directo en memoria/env (entornos headless).",
      "",
    ].join("\n")
  );
}

async function main() {
  const { command, sessionPath } = parseArgs(process.argv);

  if (command === "help") {
    printUsage();
    return;
  }
  if (command === "login") {
    await runCliLogin({ sessionPath });
    return;
  }
  if (command === "logout") {
    await runCliLogout({ sessionPath });
    return;
  }
  if (command === "status") {
    await runCliStatus({ sessionPath });
    return;
  }

  const store = createActiveCardStore({
    async resolveRemote() {
      const auth = await createAuthenticatedClient({ sessionPath, requireSession: true });
      return auth.remote;
    },
  });
  const tools = createActiveCardTools(store);
  const server = createMcpServer({
    tools,
    onError(error) {
      const msg = error instanceof Error ? error.stack || error.message : String(error);
      process.stderr.write(`[activecard-mcp] ${msg}\n`);
    },
  });

  const stop = server.serveStdio({ input: process.stdin, output: process.stdout });
  const shutdown = () => {
    stop();
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main().catch((error) => {
  const msg = error instanceof Error ? error.message : String(error);
  process.stderr.write(`[activecard-mcp] Error: ${msg}\n`);
  process.exitCode = 1;
});
