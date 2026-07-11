import { parseQuizletExport } from "../quizletImport";

describe("parseQuizletExport", () => {
  test("formato por defecto: tab entre campos, salto de línea entre tarjetas", () => {
    const text = "Perro\tDog\nGato\tCat\nCasa\tHouse";
    expect(parseQuizletExport(text)).toEqual([
      { front: "Perro", back: "Dog" },
      { front: "Gato", back: "Cat" },
      { front: "Casa", back: "House" },
    ]);
  });

  test("tolera \\r\\n (exportado desde Windows)", () => {
    const text = "Perro\tDog\r\nGato\tCat";
    expect(parseQuizletExport(text)).toEqual([
      { front: "Perro", back: "Dog" },
      { front: "Gato", back: "Cat" },
    ]);
  });

  test("descarta líneas vacías", () => {
    const text = "Perro\tDog\n\n\nGato\tCat\n";
    expect(parseQuizletExport(text)).toEqual([
      { front: "Perro", back: "Dog" },
      { front: "Gato", back: "Cat" },
    ]);
  });

  test("descarta líneas sin el separador de campo", () => {
    const text = "Perro\tDog\nsin separador\nGato\tCat";
    expect(parseQuizletExport(text)).toEqual([
      { front: "Perro", back: "Dog" },
      { front: "Gato", back: "Cat" },
    ]);
  });

  test("descarta líneas con un campo vacío", () => {
    const text = "Perro\tDog\n\tsin frente\nGato\t";
    expect(parseQuizletExport(text)).toEqual([{ front: "Perro", back: "Dog" }]);
  });

  test("separadores personalizados (coma y punto y coma)", () => {
    const text = "Perro,Dog;Gato,Cat;Casa,House";
    expect(parseQuizletExport(text, { fieldSep: ",", cardSep: ";" })).toEqual([
      { front: "Perro", back: "Dog" },
      { front: "Gato", back: "Cat" },
      { front: "Casa", back: "House" },
    ]);
  });

  test("recorta espacios alrededor de cada campo", () => {
    const text = "  Perro  \t  Dog  ";
    expect(parseQuizletExport(text)).toEqual([{ front: "Perro", back: "Dog" }]);
  });

  test("texto vacío o sin tarjetas válidas devuelve []", () => {
    expect(parseQuizletExport("")).toEqual([]);
    expect(parseQuizletExport(null)).toEqual([]);
    expect(parseQuizletExport("solo texto sin separador")).toEqual([]);
  });

  test("el separador de campo puede aparecer más de una vez: solo corta en la primera ocurrencia", () => {
    const text = "¿Cuánto es 2+2?\tLa respuesta es\t4";
    expect(parseQuizletExport(text)).toEqual([
      { front: "¿Cuánto es 2+2?", back: "La respuesta es\t4" },
    ]);
  });
});
