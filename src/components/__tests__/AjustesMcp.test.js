import React from "react";
import { act, create } from "react-test-renderer";
import Ajustes from "../../app/ajustes";

let mockPlatformOs = "web";
const mockShare = jest.fn().mockResolvedValue({ action: "sharedAction" });
const mockClipboardWrite = jest.fn().mockResolvedValue(undefined);
let mockSyncUser = null;

const mockLoadStudySoundsEnabled = jest.fn().mockResolvedValue(true);
const mockSetStudySoundsEnabled = jest.fn(async (val) => Boolean(val));
const mockPlayStudySound = jest.fn().mockReturnValue(true);

jest.mock("react-native", () => {
  const react = require("react");
  return {
    Platform: {
      get OS() {
        return mockPlatformOs;
      },
      select: (values) => values[mockPlatformOs] ?? values.default,
    },
    StyleSheet: { create: (styles) => styles },
    Share: { share: (...args) => mockShare(...args), dismissedAction: "dismissedAction" },
    Switch: (props) => react.createElement("Switch", props),
    View: ({ children, ...props }) => react.createElement("View", props, children),
    Text: ({ children, ...props }) => react.createElement("Text", props, children),
    Pressable: ({ children, ...props }) => react.createElement("Pressable", props, children),
    ScrollView: ({ children, ...props }) => react.createElement("ScrollView", props, children),
  };
});

jest.mock("expo-router", () => ({
  Stack: { Screen: () => null },
  useRouter: () => ({ push: jest.fn() }),
  useFocusEffect: (callback) => require("react").useEffect(callback, [callback]),
}));

jest.mock("../CloudSyncProvider", () => ({
  useCloudSync: () => ({ status: { user: mockSyncUser, busy: false }, engine: {} }),
}));
jest.mock("../AccountPanel", () => () => null);
jest.mock("../Collapsible", () => {
  const react = require("react");
  return function MockCollapsible({ title, summary, children }) {
    return react.createElement("Collapsible", { title, summary }, children);
  };
});
jest.mock("../PercentSlider", () => () => null);
jest.mock("../Stagger", () => ({ children }) => children);
jest.mock("../StudySoundHost", () => (props) => require("react").createElement("StudySoundHost", props));
jest.mock("../ActionSheet", () => () => null);
jest.mock("../useSyncRefresh", () => ({ useSyncRefresh: () => {} }));
jest.mock("../ui", () => {
  const react = require("react");
  return {
    Screen: ({ children }) => react.createElement("Screen", null, children),
    Card: ({ children }) => react.createElement("Card", null, children),
    Field: (props) => react.createElement("Field", props),
    Button: (props) => react.createElement("Button", props),
    confirmAsync: jest.fn(),
  };
});
jest.mock("../../db/decks", () => ({ listDecks: jest.fn().mockResolvedValue([]), updateDeckPriority: jest.fn() }));
jest.mock("../../db/reviewQueue", () => ({
  DEFAULT_LIMITS: { maxReviews: 40, maxNew: 15 },
  getDailyLimits: jest.fn().mockResolvedValue({ maxReviews: 40, maxNew: 15 }),
}));
jest.mock("../../db/settings", () => ({
  getSetting: jest.fn().mockResolvedValue("Martín"),
  setSetting: jest.fn().mockResolvedValue(undefined),
}));
jest.mock("../../lib/keys", () => ({
  getNotionToken: () => "",
  getOpenAIKey: () => "",
  setNotionToken: jest.fn(),
  setOpenAIKey: jest.fn(),
}));
jest.mock("../../lib/backupIO", () => ({
  exportBackup: jest.fn(),
  listExportableSources: jest.fn().mockResolvedValue([]),
  pickBackupFile: jest.fn(),
  prepareParsedAdditiveImport: jest.fn(),
  restoreParsedBackup: jest.fn(),
}));
jest.mock("../../lib/pendingImport", () => ({ setPendingImport: jest.fn() }));
jest.mock("../../lib/notifications", () => ({
  DEFAULT_REMINDER: { enabled: false, time: "20:30" },
  getReminderPrefs: jest.fn().mockResolvedValue({ enabled: false, time: "20:30" }),
  parseReminderTime: jest.fn(),
  setReminderPrefs: jest.fn(),
  syncReviewReminder: jest.fn(),
  updateReviewReminderEnabled: jest.fn(),
}));
jest.mock("../../lib/studySounds", () => ({
  loadStudySoundsEnabled: (...args) => mockLoadStudySoundsEnabled(...args),
  setStudySoundsEnabled: (...args) => mockSetStudySoundsEnabled(...args),
  playStudySound: (...args) => mockPlayStudySound(...args),
}));

describe("Ajustes: Sonidos de estudio y Conexión MCP", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPlatformOs = "web";
    mockSyncUser = null;
    Object.defineProperty(globalThis, "navigator", {
      configurable: true,
      writable: true,
      value: { clipboard: { writeText: mockClipboardWrite } },
    });
  });

  test("muestra estado desconectado cuando falta iniciar sesión en sincronización", async () => {
    let screen;
    try {
      await act(async () => {
        screen = create(<Ajustes />);
      });
      const mcp = screen.root.findByProps({ title: "Conexión con agentes (MCP)" });
      expect(mcp.props.summary).toBe("Requiere conectar tu cuenta arriba");
      const json = JSON.stringify(screen.toJSON());
      expect(json).toContain("Falta conectar tu cuenta");
      expect(json).toContain("npm run mcp:build");
    } finally {
      await act(async () => screen?.unmount());
    }
  });

  test("muestra email real, copia JSON en web, comparte en móvil y prueba sonidos", async () => {
    mockSyncUser = { id: "user-1", email: "martin@example.test" };
    let screen;
    try {
      await act(async () => {
        screen = create(<Ajustes />);
      });
      const mcp = screen.root.findByProps({ title: "Conexión con agentes (MCP)" });
      expect(mcp.props.summary).toBe("Cuenta lista · 9 herramientas locales");
      const json = JSON.stringify(screen.toJSON());
      expect(json).toContain("martin@example.test");
      expect(json).toContain("mcp/dist/server.mjs");

      const copyBtn = screen.root.findByProps({ label: "Copiar JSON MCP" });
      await act(async () => {
        await copyBtn.props.onPress();
      });
      expect(mockClipboardWrite).toHaveBeenCalledWith(expect.stringContaining('"activecard"'));

      const soundSwitch = screen.root.findByProps({ accessibilityLabel: "Sonidos de estudio" });
      await act(async () => {
        await soundSwitch.props.onValueChange(false);
      });
      expect(mockSetStudySoundsEnabled).toHaveBeenCalledWith(false);

      const testSoundBtn = screen.root.findByProps({ label: "Probar sonido" });
      await act(async () => {
        testSoundBtn.props.onPress();
      });
      expect(mockPlayStudySound).toHaveBeenCalledWith("good", { force: true });

      const host = screen.root.findByType("StudySoundHost");
      expect(host.props.forceMount).toBe(true);
    } finally {
      await act(async () => screen?.unmount());
    }

    mockPlatformOs = "android";
    let mobile;
    try {
      await act(async () => {
        mobile = create(<Ajustes />);
      });
      const shareBtn = mobile.root.findByProps({ label: "Compartir JSON MCP" });
      await act(async () => {
        await shareBtn.props.onPress();
      });
      expect(mockShare).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining('"mcpServers"'),
        })
      );
    } finally {
      await act(async () => mobile?.unmount());
    }
  });
});
