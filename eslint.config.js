// Configuración de ESLint (el "corrector ortográfico" del código).
// Usa las reglas oficiales de Expo y excluye lo que no es código fuente.
const { defineConfig } = require("eslint/config");
const expoConfig = require("eslint-config-expo/flat");

module.exports = defineConfig([
  expoConfig,
  {
    // assets/editor: bundle del editor GENERADO por scripts/build-editor.mjs.
    // mcp/dist: bundle Node generado por scripts/build-mcp.mjs.
    ignores: ["dist/*", ".desktop-preview*/**", ".web-ci/**", ".expo/*", "assets/editor/*", "mcp/dist/**"],
  },
  {
    rules: {
      // Reglas del React Compiler (futuro): marcan el patrón OFICIAL de
      // animaciones de React Native (useRef + Animated). Se desactivan
      // hasta que React Native adopte el compilador.
      "react-hooks/refs": "off",
      "react-hooks/purity": "off",
      "react-hooks/static-components": "off",
      "react-hooks/set-state-in-effect": "off",
      // catch (e) vacío es deliberado en este código (carga defensiva).
      "no-unused-vars": ["warn", { caughtErrors: "none" }],
    },
  },
  {
    // Scripts de Node puros (lanzadores y builds).
    files: ["scripts/**/*.js", "scripts/**/*.mjs", "*.config.js", "mcp/src/**/*.ts"],
    languageOptions: {
      globals: {
        __dirname: "readonly",
        process: "readonly",
        require: "readonly",
        module: "readonly",
        console: "readonly",
        Buffer: "readonly",
        fetch: "readonly",
        URL: "readonly",
        setTimeout: "readonly",
        clearTimeout: "readonly",
        AbortController: "readonly",
        structuredClone: "readonly",
      },
    },
    rules: {
      "import/no-unresolved": ["error", { ignore: ["^node:"] }],
    },
  },
  {
    files: ["mcp/src/**/*.ts"],
    rules: {
      "no-unused-vars": "off",
      "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_", varsIgnorePattern: "^_", caughtErrors: "none" }],
    },
  },
  {
    // Los tests usan el vocabulario de Jest (describe/test/expect…).
    files: ["**/__tests__/**/*.js", "**/*.test.js"],
    languageOptions: {
      globals: {
        jest: "readonly",
        describe: "readonly",
        test: "readonly",
        it: "readonly",
        expect: "readonly",
        beforeAll: "readonly",
        afterAll: "readonly",
        beforeEach: "readonly",
        afterEach: "readonly",
      },
    },
  },
]);
