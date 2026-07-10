// Lanzador del preview web para Claude Code (.claude/launch.json).
// Levanta Expo en modo web en el puerto 8081 sin abrir el navegador.
// NOTA: el navegador embebido del preview retiene los locks de OPFS (SQLite
// web) entre recargas — para verificar flujos con base de datos usar un
// navegador real (Chrome) apuntando a este mismo puerto.
const { spawn } = require("child_process");

const child = spawn(
  "npx",
  ["expo", "start", "--web", "--port", "8081"],
  {
    cwd: __dirname + "/..",
    stdio: "inherit",
    shell: true,
    env: { ...process.env, CI: "1", BROWSER: "none" },
  }
);

child.on("exit", (code) => process.exit(code ?? 0));
