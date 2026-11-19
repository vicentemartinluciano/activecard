// Documento HTML de la versión web (Expo Router). Solo aplica en web: en el
// APK este archivo no se usa.
import { ScrollViewStyleReset } from "expo-router/html";

const CSS = `
  :root { color-scheme: dark; }
  html, body, #root { background-color: #060608; color: #F3F4F8; -webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale; }
  ::selection { background: rgba(70, 104, 232, 0.36); color: #F3F4F8; }
  * { scrollbar-width: thin; scrollbar-color: rgba(255, 255, 255, 0.14) transparent; }
  *::-webkit-scrollbar { width: 6px; height: 6px; }
  *::-webkit-scrollbar-track { background: transparent; }
  *::-webkit-scrollbar-thumb { background: rgba(255, 255, 255, 0.14); border-radius: 999px; }
  *::-webkit-scrollbar-thumb:hover { background: rgba(255, 255, 255, 0.28); }
  [role="button"], button, input, textarea {
    transition: background-color 150ms cubic-bezier(0.16, 1, 0.3, 1),
      border-color 150ms cubic-bezier(0.16, 1, 0.3, 1),
      color 150ms cubic-bezier(0.16, 1, 0.3, 1),
      box-shadow 150ms cubic-bezier(0.16, 1, 0.3, 1),
      opacity 140ms ease;
  }
  @keyframes ac-pop {
    from { opacity: 0; transform: translateY(-4px) scale(0.98); }
    to { opacity: 1; transform: none; }
  }
  @keyframes ac-tooltip {
    from { opacity: 0; transform: translate(-5px, -50%); }
    to { opacity: 1; transform: translate(0, -50%); }
  }
  [data-ac-menu="true"] { animation: ac-pop 150ms cubic-bezier(0.16, 1, 0.3, 1); }
  [data-ac-tooltip="true"] { animation: ac-tooltip 130ms cubic-bezier(0.16, 1, 0.3, 1); }
  @media (prefers-reduced-motion: reduce) {
    [role="button"], button, input, textarea { transition: none; }
    [data-ac-menu="true"], [data-ac-tooltip="true"] { animation: none; }
  }
`;

export default function Root({ children }) {
  return (
    <html lang="es">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, shrink-to-fit=no"
        />
        <ScrollViewStyleReset />
        <style dangerouslySetInnerHTML={{ __html: CSS }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
