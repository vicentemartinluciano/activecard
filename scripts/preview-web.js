// Lanzador del preview web para Claude Code (.claude/launch.json).
// Levanta Expo en modo web en el puerto 8081 sin abrir el navegador.
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
