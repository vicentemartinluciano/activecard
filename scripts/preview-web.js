// Lanzador del preview web para Claude Code (.claude/launch.json).
// Levanta Expo en modo web sin abrir el navegador.
//
// El puerto sale de PORT si está definido (así el harness puede asignar uno
// libre cuando 8081 lo ocupa otro proyecto) y cae en 8081 como siempre si no.
//
// OJO CON CI=1: acá había un `CI: "1"` y eso pone a Metro en modo CI, donde
// **el watch está desactivado** ("reloads are disabled"). O sea: ningún cambio
// se reflejaba sin reiniciar el server a mano, y parecía un problema de
// file-watching de OneDrive. No volver a ponerlo.
//
// NOTA: el navegador embebido del preview retiene los locks de OPFS (SQLite
// web) entre recargas — para verificar flujos con base de datos usar un
// navegador real (Chrome) apuntando a este mismo puerto.
const { spawn } = require("child_process");

const port = process.env.PORT || "8081";

const child = spawn(
  "npx",
  ["expo", "start", "--web", "--port", port],
  {
    cwd: __dirname + "/..",
    stdio: "inherit",
    shell: true,
    env: { ...process.env, BROWSER: "none" },
  }
);

child.on("exit", (code) => process.exit(code ?? 0));
