# Escritura y formato

Revisión del 03/11/2026. Alcance aprobado por Martín: comportamiento de escritura,
conservación del formato y pill contextual, tomando como referencia las reglas
documentadas de Notion y el caso de Enter en un desplegable abierto.
Entregada el 04/11/2026 en web y OTA Android `preview`/`1.11.0`, mediante PR #28.
Identificadores, hashes y evidencia en `BIBLIOTECA-Y-ESTUDIO.md`.

## Reglas de edición

| Acción | Resultado |
| --- | --- |
| Enter en el encabezado abierto | Divide en el cursor. Conserva el prefijo en el encabezado y mueve el resto al comienzo del cuerpo, antes del contenido anterior. Un título dividido continúa como párrafo, con sus marcas inline. |
| Enter con texto seleccionado en el encabezado | Reemplaza el rango seleccionado y aplica la misma división. |
| Enter al final del encabezado abierto | Abre un párrafo inicial vacío para escribir sin sobrescribir el cuerpo. Reutiliza el cuerpo si solo contenía su párrafo vacío obligatorio. |
| Enter en encabezado cerrado | Divide en un desplegable hermano, conservando tipo de encabezado y cuerpo anterior. El nuevo hermano empieza cerrado y vacío por dentro. |
| Shift+Enter | Inserta un salto dentro del mismo bloque. Se conserva al guardar y estudiar. |
| Enter en el último párrafo vacío del cuerpo | Sale al párrafo siguiente al desplegable. |
| Backspace al inicio del encabezado | Quita el contenedor y conserva formato y contenido. |
| Backspace al inicio del primer párrafo del cuerpo / Delete al final del encabezado | Une ambos textos. Conserva los bloques restantes y sus marcas. No atraviesa tablas ni límites de celda. |
| Ctrl/Cmd+Enter | Abre/cierra el desplegable del cursor. Cerrar retira la selección del contenido oculto. |
| Tab / Shift+Tab | Aumenta/reduce el nivel de un ítem de lista o de un desplegable. Para anidar un desplegable tiene que haber un desplegable hermano anterior. |
| `>` y espacio | Crea un desplegable. |
| `"` y espacio | Crea una cita. |

Enter, borrado y salto interno también manejan los eventos `beforeinput` que
algunos teclados móviles envían sin `keydown`; no intervienen durante composición.
La recepción concreta de eventos en Gboard/WebView requiere QA físico separado.

Convertir un ítem de lista en desplegable conserva los hermanos que no están en
la selección, incluidos sus números iniciales. Un desplegable admite encabezados
en Texto, H1/H2/H3, Cita, Viñetas y Numerada. Cambiar ese formato no lo desactiva.

## Pill contextual

La barra conserva foco y selección. Ofrece tachado y quitar estilos del texto;
esta última acción respeta títulos, listas y desplegables. La segunda fila indica
el formato del bloque o «Varios formatos» si la selección es mixta. Sangría y
reducción de sangría tienen botones táctiles cuando se edita una lista o un
encabezado desplegable; se deshabilitan si la estructura no admite la operación.

Los cambios explícitos de formato y color abren un grupo de historial. Deshacer
la acción conserva el texto recién escrito. Dividir, unir y mover desplegables
también se deshace como una operación.

## Persistencia y compatibilidad

`front/back` siguen siendo TEXT. No cambia SQLite, FSRS ni la versión v5 del
respaldo. Los formatos simples siguen usando sus marcas existentes. El lector
nuevo incorpora dos extensiones:

- `E032`: lista compleja con `ordered`, `start` e `items` recursivos. Conserva
  niveles, párrafos adicionales, tablas, imágenes y desplegables dentro de ítems.
- `E033`: bloque con tipo, alineación y spans exactos. Se usa cuando las marcas
  anteriores no pueden representar la combinación de estilos, un salto interno
  o caracteres literales sin reinterpretarlos.

Los payloads son JSON codificado en URI con validación de tipos y atributos
admitidos. Las claves de estilos tienen un orden canónico para que guardar y
reabrir no produzca cambios artificiales. `RichText` muestra niveles de lista
reales y los mismos estilos/saltos del editor; `toPlainText` extrae texto legible
para búsqueda, previews y contexto de IA. Las imágenes no aportan sus data URI.

El código nuevo lee tarjetas y respaldos anteriores sin reescribir toda la
biblioteca. Los clientes anteriores no interpretan E032/E033: deben actualizarse
antes de editar contenido nuevo que los use. El respaldo conserva esos strings
sin pérdidas, pero no convierte un cliente viejo en compatible. La entrega debe
incluir web y OTA Android compatibles en la misma revisión; no requiere APK.

## Verificación

Los casos nuevos están junto a los módulos en `writingBehavior.test.js` y
`richContent.test.js`. Comprueban dividir/unir, selección entre bloques,
beforeinput/composición, deshacer/rehacer, listas a varios niveles, marcas
combinadas, texto literal, numeración y compartir/restaurar un mazo.
`EditorSelection.test.js` prueba los botones de la pill sobre el editor real y
`StudyToggles.test.js` comprueba el contenido enriquecido en la lectura de estudio.

Las comprobaciones automatizadas no equivalen a QA físico del Galaxy A15 ni a
recepción de OTA. El bundle WebView se regenera con `npm run editor:build`.

Referencias: [Notion, atajos de teclado](https://www.notion.com/help/keyboard-shortcuts)
y [Notion, escritura y edición](https://www.notion.com/help/writing-and-editing-basics).
No se afirma equivalencia exhaustiva con todas las funciones de Notion.
