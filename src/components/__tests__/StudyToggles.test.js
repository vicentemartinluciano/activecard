/** @jest-environment jsdom */
import React, { act, useRef } from "react";
import { createRoot } from "react-dom/client";
import { Animated } from "react-native";
import FlipCard from "../FlipCard";
import SwipeCard from "../SwipeCard";
import useStudyKeyboard from "../useStudyKeyboard";
import { encodeToggle } from "../../lib/richtext";

jest.mock("react-native", () => jest.requireActual("react-native-web"));
jest.mock("../RichToggle", () => jest.requireActual("../RichToggle.web"));
jest.mock("expo-router", () => ({ useFocusEffect: (callback) => require("react").useEffect(callback, [callback]) }));
jest.mock("@expo/vector-icons/Feather", () => () => null);
jest.mock("@expo/vector-icons/FontAwesome", () => () => null);

let root, host;
const flip = jest.fn();
const grade = jest.fn();
function Study({ cardId = 1 }) {
  const ref = useRef(null);
  useStudyKeyboard({ enabled: true, flipped: true, flip, grade, isBusy: () => false });
  return <SwipeCard ref={ref} cardId={cardId} onSwipeLeft={grade} onSwipeUp={grade} onSwipeRight={grade}>
    <FlipCard cardId={cardId} front="Pregunta" back={encodeToggle("**Explicación**", "Detalle\n" + encodeToggle("Más", "Profundidad"))}
      flipped onFlip={flip} />
  </SwipeCard>;
}

beforeEach(async () => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  Object.defineProperty(globalThis, "fetch", { configurable: true, writable: true, value: jest.fn() });
  jest.spyOn(Animated, "timing").mockImplementation((value, { toValue }) => ({ start: (done) => { value.setValue(toValue); done?.({ finished: true }); }, stop: () => {} }));
  host = document.createElement("div"); document.body.append(host); root = createRoot(host);
  await act(async () => root.render(<Study />));
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); jest.restoreAllMocks(); jest.clearAllMocks(); });

test("click y teclado abren solo el desplegable, sin girar ni calificar", async () => {
  const title = host.querySelector('[data-study-action="toggle"]');
  expect(title.getAttribute("aria-expanded")).toBe("false");
  expect(host.textContent).not.toContain("Detalle");
  await act(async () => title.click());
  expect(host.textContent).toContain("Detalle");
  expect(host.textContent).not.toContain("Profundidad");
  await act(async () => {
    title.focus();
    title.dispatchEvent(new KeyboardEvent("keydown", { key: " ", bubbles: true, cancelable: true }));
  });
  expect(title.getAttribute("aria-expanded")).toBe("false");
  await act(async () => title.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true })));
  expect(title.getAttribute("aria-expanded")).toBe("true");
  await act(async () => title.dispatchEvent(new KeyboardEvent("keydown", { key: "3", bubbles: true, cancelable: true })));
  expect(flip).not.toHaveBeenCalled(); expect(grade).not.toHaveBeenCalled();
});

test("otra tarjeta con contenido idéntico vuelve a empezar cerrada", async () => {
  await act(async () => host.querySelector('[data-study-action="toggle"]').click());
  expect(host.textContent).toContain("Detalle");
  await act(async () => root.render(<Study cardId={2} />));
  expect(host.querySelector('[data-study-action="toggle"]').getAttribute("aria-expanded")).toBe("false");
  expect(host.textContent).not.toContain("Detalle");
});
