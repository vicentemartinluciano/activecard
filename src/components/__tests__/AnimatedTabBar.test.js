import React from "react";
import { act, create } from "react-test-renderer";

import AnimatedTabBar from "../AnimatedTabBar";

jest.mock("react-native", () => {
  const react = require("react");
  return {
    Platform: { OS: "android", select: (values) => values.android ?? values.default },
    StyleSheet: { create: (styles) => styles },
    View: ({ children, ...props }) => react.createElement("View", props, children),
    Text: ({ children, ...props }) => react.createElement("Text", props, children),
    Pressable: ({ children, ...props }) => react.createElement("Pressable", props, children),
    Animated: {
      View: ({ children, ...props }) => react.createElement("AnimatedView", props, children),
      Value: function Value(v) {
        this.value = v;
        this.setValue = (next) => {
          this.value = next;
        };
      },
      spring: () => ({ start: () => {} }),
    },
  };
});

jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock("@expo/vector-icons/Feather", () => () => null);

test("AnimatedTabBar omite la ruta oculta crear y navega al tocar otra sección", async () => {
  const navigate = jest.fn();
  const emit = jest.fn(() => ({ defaultPrevented: false }));
  const state = {
    index: 0,
    routes: [
      { key: "inicio", name: "index" },
      { key: "crear", name: "crear" },
      { key: "biblioteca", name: "biblioteca" },
      { key: "notas", name: "notas" },
      { key: "gimnasio", name: "gimnasio" },
      { key: "progreso", name: "progreso" },
    ],
  };
  const descriptors = {
    inicio: { options: { title: "Inicio" } },
    crear: { options: { href: null } },
    biblioteca: { options: { title: "Biblioteca" } },
    notas: { options: { title: "Notas" } },
    gimnasio: { options: { title: "Gimnasio" } },
    progreso: { options: { title: "Progreso" } },
  };

  let tree;
  try {
    await act(async () => {
      tree = create(
        <AnimatedTabBar
          state={state}
          descriptors={descriptors}
          navigation={{ navigate, emit }}
        />
      );
    });
    const tabs = tree.root
      .findAllByType("Pressable")
      .filter((node) => node.props?.accessibilityRole === "tab");
    expect(tabs.map((tab) => tab.props.accessibilityLabel)).toEqual([
      "Inicio",
      "Biblioteca",
      "Notas",
      "Gimnasio",
      "Progreso",
    ]);
    expect(tabs[0].props.accessibilityState).toEqual({ selected: true });

    const notasTab = tabs.find((tab) => tab.props.accessibilityLabel === "Notas");
    await act(async () => notasTab.props.onPress());
    expect(navigate).toHaveBeenCalledWith("notas", undefined);
  } finally {
    await act(async () => tree?.unmount());
  }
});
