// Documento HTML de la versión web (Expo Router). Solo aplica en web: en el
// APK este archivo no se usa.
import { ScrollViewStyleReset } from "expo-router/html";

const CSS = `
  html, body { background-color: #09090B; }
  /* Las barras de scroll del navegador rompen la ilusión de app. No alcanza con
     showsVerticalScrollIndicator={false}: react-native-web solo emite
     scrollbar-width con esa prop, y eso no cubre WebKit. Por eso va global. */
  * { scrollbar-width: none; -ms-overflow-style: none; }
  *::-webkit-scrollbar { width: 0; height: 0; display: none; }
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
