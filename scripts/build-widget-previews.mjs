// El selector usa los mismos componentes y fuentes que la vista previa del JSX.
// Requiere Chromium/Chrome y --tools-dir <node_modules con playwright>.
process.argv.push('--selector');
await import('./preview-widget-layouts.mjs');
