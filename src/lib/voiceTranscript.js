const normalize = (value) => String(value || "").trim().replace(/\s+/g, " ");
const comparableWord = (word) =>
  word.toLocaleLowerCase("es").replace(/^[\p{P}\p{S}]+|[\p{P}\p{S}]+$/gu, "");

// Los motores nativos suelen mandar una frase parcial y luego repetirla
// completa en el resultado final. Unirlas a ciegas produce textos como
// "hola mundo hola mundo". Este merge conserva la versión más completa y
// elimina solamente el solapamiento entre el final anterior y el inicio nuevo.
export function mergeTranscript(previous, incoming) {
  const left = normalize(previous);
  const right = normalize(incoming);
  if (!left) return right;
  if (!right) return left;

  const leftWords = left.split(" ");
  const rightWords = right.split(" ");
  // El resultado final puede sumar puntuación a un parcial ya mostrado. Para
  // detectar ese solapamiento se compara sin signos, pero se devuelve siempre
  // el texto original más nuevo.
  const lower = (words) => words.map(comparableWord);
  const leftLower = lower(leftWords);
  const rightLower = lower(rightWords);

  if (
    leftLower.length === rightLower.length &&
    leftLower.every((word, index) => word === rightLower[index])
  ) {
    return right;
  }

  if (
    rightLower.length >= leftLower.length &&
    leftLower.every((word, index) => word === rightLower[index])
  ) {
    return right;
  }

  if (
    leftLower.length >= rightLower.length &&
    rightLower.every(
      (word, index) => word === leftLower[leftLower.length - rightLower.length + index]
    )
  ) {
    return left;
  }

  const maxOverlap = Math.min(leftWords.length, rightWords.length);
  for (let size = maxOverlap; size > 0; size -= 1) {
    const suffix = leftLower.slice(-size);
    const prefix = rightLower.slice(0, size);
    if (suffix.every((word, index) => word === prefix[index])) {
      return [...leftWords, ...rightWords.slice(size)].join(" ");
    }
  }

  return `${left} ${right}`;
}

export function composeTranscript(base, ...spokenParts) {
  const spoken = spokenParts.reduce((current, part) => mergeTranscript(current, part), "");
  return [normalize(base), spoken].filter(Boolean).join(" ");
}
