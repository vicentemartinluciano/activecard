import React from "react";
import { act, create } from "react-test-renderer";
import ChatAuditor, { isGymSendShortcut } from "../ChatAuditor";
import StarField from "../StarField";

jest.mock("react-native", () => {
  const react = require("react");
  const StyleSheet = {
    create: (styles) => styles,
    flatten: (style) => (Array.isArray(style) ? Object.assign({}, ...style.filter(Boolean)) : style || {}),
    absoluteFill: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0 },
    absoluteFillObject: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0 },
  };
  class AnimatedValue {
    constructor(val) {
      this.val = val;
    }
    setValue(v) {
      this.val = v;
    }
    interpolate() {
      return this;
    }
  }
  const noopAnim = () => ({ start: (cb) => cb?.({ finished: true }), stop: () => {} });
  return {
    Platform: { OS: "web", select: (values) => values.web ?? values.default },
    StyleSheet,
    Animated: {
      Value: AnimatedValue,
      View: ({ children, ...props }) => react.createElement("AnimatedView", props, children),
      timing: noopAnim,
      spring: noopAnim,
      parallel: noopAnim,
    },
    useWindowDimensions: () => ({ width: 1024, height: 768 }),
    Keyboard: { addListener: () => ({ remove: () => {} }) },
    KeyboardAvoidingView: ({ children, ...props }) => react.createElement("KeyboardAvoidingView", props, children),
    View: ({ children, ...props }) => react.createElement("View", props, children),
    Text: ({ children, ...props }) => react.createElement("Text", props, children),
    Pressable: ({ children, ...props }) => react.createElement("Pressable", props, children),
    ScrollView: ({ children, ...props }) => react.createElement("ScrollView", props, children),
    TextInput: (props) => react.createElement("TextInput", props),
    ActivityIndicator: () => react.createElement("ActivityIndicator"),
  };
});

jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 16, left: 0 }),
}));

jest.mock("expo-router", () => ({
  useRouter: () => ({ push: jest.fn(), back: jest.fn() }),
  useLocalSearchParams: () => ({}),
}));

jest.mock("@expo/vector-icons/Feather", () => () => null);
jest.mock("../BrainMark", () => () => null);
jest.mock("../CardAttachmentSheet", () => () => null);
jest.mock("../ActionSheet", () => ({ children }) => children || null);
jest.mock("../RichText", () => ({ text }) => text || null);
let mockVoiceActive = false;

jest.mock("../VoiceInput", () => {
  const react = require("react");
  return function MockVoiceInput({ children }) {
    return children({
      micButton: react.createElement("View", { testID: "voice-mic" }),
      panel: react.createElement("View", { testID: "voice-panel" }),
      active: mockVoiceActive,
      error: null,
    });
  };
});
jest.mock("../useSyncRefresh", () => ({
  useSyncHold: () => () => {},
  useSyncRefresh: () => {},
}));
jest.mock("../../db/cards", () => ({ createCard: jest.fn(), deleteCard: jest.fn(), getCard: jest.fn(), updateCardText: jest.fn() }));
jest.mock("../../db/connections", () => ({ saveConnection: jest.fn() }));
jest.mock("../../db/decks", () => ({
  createDeck: jest.fn(),
  deleteDeck: jest.fn(),
  getDeck: jest.fn(),
  listDecks: jest.fn().mockResolvedValue([]),
  renameDeck: jest.fn(),
  setDeckFolder: jest.fn(),
}));
jest.mock("../../db/folders", () => ({ createFolder: jest.fn(), deleteFolder: jest.fn(), getFolder: jest.fn(), renameFolder: jest.fn() }));
jest.mock("../../db/gymChats", () => ({
  addGymMessage: jest.fn(),
  createGymChat: jest.fn(),
  getGymChat: jest.fn().mockResolvedValue(null),
  listGymMessages: jest.fn().mockResolvedValue([]),
  renameGymChat: jest.fn(),
  setGymChatDraft: jest.fn(),
  updateGymMessageMetadata: jest.fn(),
}));
jest.mock("../../lib/gymAssistant", () => ({ resolveGymCardChoice: jest.fn(), runGymAssistant: jest.fn() }));
jest.mock("../../lib/files", () => ({ pickGymFiles: jest.fn() }));

describe("Gimnasio limpio, StarField estático y atajos del composer", () => {
  test("isGymSendShortcut envía con Enter y respeta Shift+Enter e IME", () => {
    expect(isGymSendShortcut({ key: "Enter", shiftKey: false, altKey: false })).toBe(true);
    expect(isGymSendShortcut({ key: "Enter", shiftKey: true })).toBe(false);
    expect(isGymSendShortcut({ key: "Enter", altKey: true })).toBe(false);
    expect(isGymSendShortcut({ key: "Enter", isComposing: true })).toBe(false);
    expect(isGymSendShortcut({ key: "Enter", keyCode: 229 })).toBe(false);
    expect(isGymSendShortcut({ key: "a" })).toBe(false);
  });

  test("StarField es estático y no agenda timers en segundo plano", () => {
    const timeoutSpy = jest.spyOn(global, "setTimeout");
    const intervalSpy = jest.spyOn(global, "setInterval");
    let tree;
    try {
      act(() => {
        tree = create(<StarField />);
      });
      expect(timeoutSpy).not.toHaveBeenCalled();
      expect(intervalSpy).not.toHaveBeenCalled();
      expect(tree.root.findAllByType("View").length).toBeGreaterThanOrEqual(16);
    } finally {
      act(() => {
        tree?.unmount();
      });
      timeoutSpy.mockRestore();
      intervalSpy.mockRestore();
    }
  });

  test("ChatAuditor muestra pantalla vacía limpia, botón + e integra panel inline de voz", async () => {
    mockVoiceActive = false;
    let idleTree;
    try {
      await act(async () => {
        idleTree = create(<ChatAuditor root />);
      });
      const idleJson = JSON.stringify(idleTree.toJSON());
      expect(idleJson).toContain("¿Qué querés explorar?");
      expect(idleJson).not.toContain("Conectar o pensar en voz alta");
      expect(idleJson).toContain("Añadir al chat");
      expect(idleJson).toContain("voice-mic");
    } finally {
      await act(async () => {
        idleTree?.unmount();
      });
    }

    mockVoiceActive = true;
    let voiceTree;
    try {
      await act(async () => {
        voiceTree = create(<ChatAuditor root />);
      });
      expect(JSON.stringify(voiceTree.toJSON())).toContain("voice-panel");
    } finally {
      mockVoiceActive = false;
      await act(async () => {
        voiceTree?.unmount();
      });
    }
  });
});
