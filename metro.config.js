// Configuración de Metro. Lo no-default está acá por expo-sqlite en WEB:
// necesita el asset .wasm y headers COOP/COEP (SharedArrayBuffer) para que
// la API síncrona funcione en el preview del navegador. En Android no aplica.
const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);

config.resolver.assetExts.push("wasm");

config.server.enhanceMiddleware = (middleware) => {
  return (req, res, next) => {
    res.setHeader("Cross-Origin-Embedder-Policy", "credentialless");
    res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
    middleware(req, res, next);
  };
};

module.exports = config;
