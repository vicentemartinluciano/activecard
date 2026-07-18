// Comprime una imagen (File o data URI) a un data URI JPEG acotado usando
// canvas. Corre DENTRO del editor: react-dom en web y WebView en nativo — ambos
// tienen DOM/canvas, así que no hace falta ninguna librería nativa. Mantiene el
// tamaño chico para que el base64 inline en la tarjeta (y el respaldo) no se
// dispare.

const MAX_DIM = 1280; // lado máximo en px
const QUALITY = 0.72; // calidad JPEG

export function fileToDataUri(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

export function compressDataUri(dataUri) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      let { width, height } = img;
      const scale = Math.min(1, MAX_DIM / Math.max(width, height));
      width = Math.max(1, Math.round(width * scale));
      height = Math.max(1, Math.round(height * scale));
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      // JPEG no tiene transparencia: fondo blanco para que los PNG con alpha no
      // salgan con fondo negro.
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, width, height);
      ctx.drawImage(img, 0, 0, width, height);
      try {
        resolve(canvas.toDataURL("image/jpeg", QUALITY));
      } catch {
        resolve(dataUri); // canvas "sucio" (no debería pasar con un data URI)
      }
    };
    img.onerror = () => resolve(dataUri);
    img.src = dataUri;
  });
}

export async function compressFile(file) {
  return compressDataUri(await fileToDataUri(file));
}
