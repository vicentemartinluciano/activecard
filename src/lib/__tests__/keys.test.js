import { getNotionToken, getOpenAIKey, initKeys, setNotionToken, setOpenAIKey } from "../keys";
import { setSetting } from "../../db/settings";

const mockStore = {};
jest.mock("../../db/settings", () => ({
  getSetting: jest.fn(async (key, fallback) => mockStore[key] ?? fallback),
  setSetting: jest.fn(async (key, value) => { mockStore[key] = value; }),
}));

beforeEach(async () => {
  jest.clearAllMocks();
  for (const key of Object.keys(mockStore)) delete mockStore[key];
  await initKeys();
});

test("no usa secretos del entorno aunque no haya claves locales", () => {
  const previous = { openai: process.env.EXPO_PUBLIC_OPENAI_API_KEY, notion: process.env.EXPO_PUBLIC_NOTION_TOKEN };
  process.env.EXPO_PUBLIC_OPENAI_API_KEY = "clave-de-prueba-del-build";
  process.env.EXPO_PUBLIC_NOTION_TOKEN = "token-de-prueba-del-build";
  try {
    expect(getOpenAIKey()).toBeNull();
    expect(getNotionToken()).toBeNull();
  } finally {
    for (const [name, value] of [["EXPO_PUBLIC_OPENAI_API_KEY", previous.openai], ["EXPO_PUBLIC_NOTION_TOKEN", previous.notion]]) {
      if (value === undefined) delete process.env[name]; else process.env[name] = value;
    }
  }
});

test("conserva las claves de Ajustes al reiniciar y permite borrarlas", async () => {
  await setOpenAIKey(" clave-local ");
  await setNotionToken(" token-local ");
  await initKeys();
  expect(getOpenAIKey()).toBe("clave-local");
  expect(getNotionToken()).toBe("token-local");
  await setOpenAIKey("");
  await setNotionToken("");
  await initKeys();
  expect(getOpenAIKey()).toBeNull();
  expect(getNotionToken()).toBeNull();
});

test("una escritura fallida no reemplaza la clave que seguía guardada", async () => {
  await setNotionToken("token-vigente");
  setSetting.mockRejectedValueOnce(new Error("Sin espacio"));
  await expect(setNotionToken("otro-token")).rejects.toThrow("Sin espacio");
  expect(getNotionToken()).toBe("token-vigente");
});
