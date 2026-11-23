import { build } from "esbuild";
import { Buffer } from "node:buffer";
import { mkdir, readFile, stat } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const outFile = resolve(root, "mcp/dist/server.mjs");

await mkdir(dirname(outFile), { recursive: true });

const activeCardNodeStubsPlugin = {
  name: "activecard-mcp-node-stubs",
  setup(pluginBuild) {
    pluginBuild.onResolve({ filter: /^react-native$/ }, () => ({
      path: "react-native",
      namespace: "ac-rn-stub",
    }));
    pluginBuild.onLoad({ filter: /.*/, namespace: "ac-rn-stub" }, () => ({
      contents: `export const Platform = { OS: "node", select: (map) => map?.default ?? map?.web };\n`,
      loader: "js",
    }));

    pluginBuild.onResolve({ filter: /^expo-crypto$/ }, () => ({
      path: "expo-crypto",
      namespace: "ac-crypto-stub",
    }));
    pluginBuild.onLoad({ filter: /.*/, namespace: "ac-crypto-stub" }, () => ({
      contents: `import { createHash, randomUUID as nodeRandomUUID } from "node:crypto";
export const CryptoDigestAlgorithm = { SHA256: "sha256" };
export async function digestStringAsync(alg, text) {
  return createHash(String(alg || "sha256").toLowerCase().replace("-", "")).update(String(text), "utf8").digest("hex");
}
export function randomUUID() {
  return nodeRandomUUID();
}
`,
      loader: "js",
    }));

    pluginBuild.onResolve({ filter: /^\.\/syncSession$/ }, () => ({
      path: "syncSession",
      namespace: "ac-sync-session-stub",
    }));
    pluginBuild.onLoad({ filter: /.*/, namespace: "ac-sync-session-stub" }, () => ({
      contents: `export const readRefreshToken = async () => null;
export const readRememberSession = async () => false;
export async function saveRefreshToken() {}
`,
      loader: "js",
    }));
  },
};

const result = await build({
  entryPoints: [resolve(root, "mcp/src/index.ts")],
  outfile: outFile,
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node20",
  plugins: [activeCardNodeStubsPlugin],
  banner: {
    js: "#!/usr/bin/env node",
  },
  logLevel: "info",
});

const info = await stat(outFile);
const kb = Math.round(Buffer.byteLength(await readFile(outFile, "utf8"), "utf8") / 1024);
if (!result.errors.length) {
  console.log(`mcp/dist/server.mjs generado (${kb} KB, ${info.size} bytes)`);
}
