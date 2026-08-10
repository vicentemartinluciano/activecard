import { composeTranscript, mergeTranscript } from "../voiceTranscript";

describe("mergeTranscript", () => {
  test("reemplaza un parcial por su versión final sin duplicarlo", () => {
    expect(mergeTranscript("hola mundo", "hola mundo desde ActiveCard")).toBe(
      "hola mundo desde ActiveCard"
    );
  });

  test("une segmentos consecutivos eliminando el solapamiento", () => {
    expect(mergeTranscript("quiero estudiar matemática", "matemática financiera hoy")).toBe(
      "quiero estudiar matemática financiera hoy"
    );
  });

  test("conserva segmentos diferentes", () => {
    expect(mergeTranscript("primera idea", "segunda idea")).toBe(
      "primera idea segunda idea"
    );
  });

  test("conserva el segmento anterior si el nuevo es un sufijo repetido", () => {
    expect(mergeTranscript("uno dos tres", "dos tres")).toBe("uno dos tres");
  });

  test("une el solapamiento más largo sin repetir palabras", () => {
    expect(mergeTranscript("uno dos tres cuatro", "tres cuatro cinco seis")).toBe(
      "uno dos tres cuatro cinco seis"
    );
  });

  test("compara sin distinguir mayúsculas", () => {
    expect(mergeTranscript("Hola Mundo", "hola mundo desde ActiveCard")).toBe(
      "hola mundo desde ActiveCard"
    );
  });

  test("reemplaza el parcial cuando el final solo agrega puntuación", () => {
    expect(mergeTranscript("hola mundo", "hola mundo.")).toBe("hola mundo.");
  });

  test("normaliza entradas vacías y espacios internos", () => {
    expect(mergeTranscript("", "  frase   dictada  ")).toBe("frase dictada");
    expect(mergeTranscript("  frase   dictada  ", " ")).toBe("frase dictada");
  });

  test("no confunde un prefijo de palabra con una frase repetida", () => {
    expect(mergeTranscript("no", "nosotros vamos")).toBe("no nosotros vamos");
    expect(mergeTranscript("a", "aprender")).toBe("a aprender");
  });
});

describe("composeTranscript", () => {
  test("preserva el texto escrito antes de dictar", () => {
    expect(composeTranscript("Nota previa", "frase dictada")).toBe(
      "Nota previa frase dictada"
    );
  });

  test("normaliza espacios y omite partes vacías", () => {
    expect(composeTranscript("  Nota   previa ", "", " frase   dictada ")).toBe(
      "Nota previa frase dictada"
    );
  });

  test("compone varios segmentos hablados con solapamientos", () => {
    expect(
      composeTranscript(
        "Nota previa",
        "primera idea importante",
        "idea importante para estudiar",
        "estudiar hoy"
      )
    ).toBe("Nota previa primera idea importante para estudiar hoy");
  });
});
