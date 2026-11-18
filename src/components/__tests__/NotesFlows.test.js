import React from "react";
import { act, create } from "react-test-renderer";

import AssociatedNotesSection from "../AssociatedNotesSection";
import ReferenceNotesSheet from "../ReferenceNotesSheet";
import Notas from "../../app/(tabs)/notas";
import NotaDetalle from "../../app/notas/[id]";

const mockPush = jest.fn();
const mockReplace = jest.fn();
const mockBack = jest.fn();
const mockDispatch = jest.fn();
const mockBeforeRemoveListeners = [];
const mockDesktopBeforeNavigate = jest.fn();

const mockListNotes = jest.fn();
const mockCreateNote = jest.fn();
const mockUpdateNote = jest.fn();
const mockGetNote = jest.fn();
const mockSetNoteFolders = jest.fn();
const mockSetNoteDecks = jest.fn();
const mockSetNoteTags = jest.fn();
const mockDuplicateNote = jest.fn();
const mockDeleteNote = jest.fn();

const mockListFolders = jest.fn();
const mockListDecks = jest.fn();
const mockListTags = jest.fn();
const mockEnsureTag = jest.fn();

jest.mock("react-native", () => {
  const react = require("react");
  return {
    Platform: { OS: "web", select: (values) => values.web ?? values.default },
    StyleSheet: { create: (styles) => styles },
    View: ({ children, ...props }) => react.createElement("View", props, children),
    Text: ({ children, ...props }) => react.createElement("Text", props, children),
    Pressable: ({ children, ...props }) => react.createElement("Pressable", props, children),
    TextInput: (props) => react.createElement("TextInput", props),
    ScrollView: ({ children, ...props }) => react.createElement("ScrollView", props, children),
    KeyboardAvoidingView: ({ children, ...props }) => react.createElement("View", props, children),
    FlatList: ({ data = [], renderItem, ListHeaderComponent, ListEmptyComponent }) =>
      react.createElement(
        "FlatList",
        null,
        ListHeaderComponent || null,
        data.length > 0
          ? data.map((item, index) =>
              react.createElement(react.Fragment, { key: item.id ?? index }, renderItem({ item, index }))
            )
          : ListEmptyComponent || null
      ),
  };
});

jest.mock("expo-router", () => ({
  Stack: { Screen: () => null },
  useLocalSearchParams: () => ({ id: "42" }),
  useRouter: () => ({
    push: mockPush,
    replace: mockReplace,
    back: mockBack,
    canGoBack: () => true,
  }),
  useNavigation: () => ({
    addListener: (event, cb) => {
      if (event === "beforeRemove") mockBeforeRemoveListeners.push(cb);
      return () => {
        const idx = mockBeforeRemoveListeners.indexOf(cb);
        if (idx >= 0) mockBeforeRemoveListeners.splice(idx, 1);
      };
    },
    dispatch: mockDispatch,
  }),
  useFocusEffect: (callback) => require("react").useEffect(callback, [callback]),
}));

jest.mock("@expo/vector-icons/Feather", () => () => null);
jest.mock("../SectionSwipe", () => ({ children }) => children);
jest.mock("../Skeleton", () => () => null);
jest.mock("../Toast", () => (props) => require("react").createElement("toast", props));
jest.mock("../useSyncRefresh", () => ({ useSyncRefresh: () => {} }));
jest.mock("../DesktopShell", () => ({
  useDesktopBeforeNavigate: (cb) => mockDesktopBeforeNavigate(cb),
}));
jest.mock("../RichText", () => (props) => require("react").createElement("rich-text", props));
jest.mock("../NotionField", () => (props) => require("react").createElement("notion-field", props));
jest.mock("../NoteAssociationsSheet", () => (props) =>
  props.visible ? require("react").createElement("assoc-sheet", props) : null
);
jest.mock("../ActionSheet", () => (props) =>
  props.visible ? require("react").createElement("action-sheet", props, props.children) : null
);
jest.mock("../ui", () => {
  const react = require("react");
  return {
    Screen: ({ children }) => react.createElement("Screen", null, children),
    Card: ({ children, onPress, ...props }) =>
      onPress
        ? react.createElement("Pressable", { ...props, onPress }, children)
        : react.createElement("Card", props, children),
    Pill: (props) => react.createElement("pill", props),
    Chip: (props) => react.createElement("chip", props),
    Button: (props) => react.createElement("ui-button", props),
    Field: (props) => react.createElement("ui-field", props),
    EmptyState: (props) => react.createElement("empty-state", props),
  };
});

jest.mock("../../db/notes", () => ({
  listNotes: (...args) => mockListNotes(...args),
  createNote: (...args) => mockCreateNote(...args),
  updateNote: (...args) => mockUpdateNote(...args),
  getNote: (...args) => mockGetNote(...args),
  setNoteFolders: (...args) => mockSetNoteFolders(...args),
  setNoteDecks: (...args) => mockSetNoteDecks(...args),
  setNoteTags: (...args) => mockSetNoteTags(...args),
  duplicateNote: (...args) => mockDuplicateNote(...args),
  deleteNote: (...args) => mockDeleteNote(...args),
}));

jest.mock("../../db/folders", () => ({
  listFolders: (...args) => mockListFolders(...args),
}));

jest.mock("../../db/decks", () => ({
  listDecks: (...args) => mockListDecks(...args),
  listTags: (...args) => mockListTags(...args),
  ensureTag: (...args) => mockEnsureTag(...args),
}));

beforeEach(() => {
  jest.clearAllMocks();
  mockBeforeRemoveListeners.length = 0;
  mockListFolders.mockResolvedValue([{ id: 3, name: "Biología", parent_id: null }]);
  mockListDecks.mockResolvedValue([{ id: 10, name: "Célula", folder_id: 3 }]);
  mockListTags.mockResolvedValue([{ id: 5, name: "parcial" }]);
});

test("AssociatedNotesSection muestra estado vacío y abre o crea notas vinculadas", async () => {
  const onOpenNote = jest.fn();
  const onCreateNote = jest.fn();
  let emptyTree;
  let listTree;
  try {
    await act(async () => {
      emptyTree = create(<AssociatedNotesSection notes={[]} onOpenNote={onOpenNote} onCreateNote={onCreateNote} />);
    });
    const addEmpty = emptyTree.root
      .findAllByType("Pressable")
      .find((n) => n.props.accessibilityLabel === "Nueva nota asociada");
    await act(async () => addEmpty.props.onPress());
    expect(onCreateNote).toHaveBeenCalledTimes(1);

    await act(async () => {
      listTree = create(
        <AssociatedNotesSection
          notes={[
            {
              id: 8,
              title: "Mapa de membrana",
              excerpt: "Resumen previo al repaso",
              pinned: 1,
              origin: { kind: "direct", label: "Directa" },
            },
          ]}
          onOpenNote={onOpenNote}
          onCreateNote={onCreateNote}
        />
      );
    });
    const openBtn = listTree.root
      .findAllByType("Pressable")
      .find((n) => n.props.accessibilityLabel === "Abrir nota Mapa de membrana");
    await act(async () => openBtn.props.onPress());
    expect(onOpenNote).toHaveBeenCalledWith(8);
  } finally {
    await act(async () => {
      emptyTree?.unmount();
      listTree?.unmount();
    });
  }
});

test("ReferenceNotesSheet permite cambiar entre notas asociadas y abrir el editor", async () => {
  const onClose = jest.fn();
  const onEditNote = jest.fn();
  let tree;
  try {
    await act(async () => {
      tree = create(
        <ReferenceNotesSheet
          visible
          deckName="Célula"
          notes={[
            { id: 1, title: "Mapa general", body: "**Primer** mapa", tags: [{ id: 5, name: "parcial" }] },
            { id: 2, title: "Mitosis", body: "Detalle de fases", origin: { label: "De carpeta" } },
          ]}
          onClose={onClose}
          onEditNote={onEditNote}
        />
      );
    });
    expect(tree.root.findByType("rich-text").props.text).toBe("**Primer** mapa");

    const secondChip = tree.root.findAllByType("chip").find((c) => c.props.label === "Mitosis");
    await act(async () => secondChip.props.onPress());
    expect(tree.root.findByType("rich-text").props.text).toBe("Detalle de fases");

    const editBtn = tree.root.findAllByType("ui-button").find((b) => b.props.label === "Editar nota");
    await act(async () => editBtn.props.onPress());
    expect(onEditNote).toHaveBeenCalledWith(2);
  } finally {
    await act(async () => tree?.unmount());
  }
});

test("la pestaña Notas busca, navega directo a carpetas o mazos asociados y crea una nota", async () => {
  mockListNotes.mockResolvedValue([
    {
      id: 12,
      title: "Guía de estudio",
      excerpt: "Conceptos clave",
      pinned: 0,
      updated_at: "2026-11-18T12:00:00.000Z",
      folders: [{ id: 3, name: "Biología" }],
      decks: [{ id: 10, name: "Célula" }],
      tags: [{ id: 5, name: "parcial" }],
    },
  ]);
  mockCreateNote.mockResolvedValue(99);

  let tree;
  try {
    await act(async () => {
      tree = create(<Notas />);
    });

    const folderPill = tree.root.findAllByType("pill").find((p) => p.props.label === "Biología");
    await act(async () => folderPill.props.onPress());
    expect(mockPush).toHaveBeenCalledWith("/carpetas/3");

    const deckPill = tree.root.findAllByType("pill").find((p) => p.props.label === "Célula");
    await act(async () => deckPill.props.onPress());
    expect(mockPush).toHaveBeenCalledWith("/mazos/10");

    const searchField = tree.root.findByType("ui-field");
    await act(async () => searchField.props.onChangeText("membrana"));
    expect(mockListNotes).toHaveBeenLastCalledWith(
      expect.objectContaining({ query: "membrana" })
    );

    const newBtn = tree.root.findAllByType("ui-button").find((b) => b.props.label === "Nueva nota");
    await act(async () => {
      await newBtn.props.onPress();
    });
    expect(mockCreateNote).toHaveBeenCalled();
    expect(mockPush).toHaveBeenCalledWith("/notas/99");
  } finally {
    await act(async () => tree?.unmount());
  }
});

test("el editor de nota guarda cambios al vuelo antes de ir al mazo vinculado y fija la nota", async () => {
  mockGetNote.mockResolvedValue({
    id: 42,
    title: "Título inicial",
    body: "Cuerpo inicial",
    pinned: 0,
    folders: [{ id: 3, name: "Biología" }],
    decks: [{ id: 10, name: "Célula" }],
    tags: [{ id: 5, name: "parcial" }],
  });
  mockUpdateNote.mockResolvedValue(true);

  let tree;
  try {
    await act(async () => {
      tree = create(<NotaDetalle />);
    });

    const titleInput = tree.root
      .findAllByType("TextInput")
      .find((t) => t.props.accessibilityLabel === "Título de la nota");
    await act(async () => titleInput.props.onChangeText("Título editado"));

    const editor = tree.root.findByType("notion-field");
    expect(editor.props.page).toBe(true);
    await act(async () => editor.props.onChangeText("Cuerpo **enriquecido**"));

    const deckPill = tree.root.findAllByType("pill").find((p) => p.props.label === "Célula");
    await act(async () => {
      await deckPill.props.onPress();
    });

    expect(mockUpdateNote).toHaveBeenCalledWith(42, {
      title: "Título editado",
      body: "Cuerpo **enriquecido**",
      pinned: 0,
    });
    expect(mockPush).toHaveBeenCalledWith("/mazos/10");

    const pinBtn = tree.root
      .findAllByType("Pressable")
      .find((p) => p.props.accessibilityLabel === "Fijar nota");
    await act(async () => {
      await pinBtn.props.onPress();
    });
    expect(mockUpdateNote).toHaveBeenCalledWith(42, {
      title: "Título editado",
      body: "Cuerpo **enriquecido**",
      pinned: 1,
    });
  } finally {
    await act(async () => tree?.unmount());
  }
});

test("la pestaña Notas muestra estado vacío minimalista y crea desde ahí", async () => {
  mockListNotes.mockResolvedValue([]);
  mockCreateNote.mockResolvedValue(77);

  let tree;
  try {
    await act(async () => {
      tree = create(<Notas />);
    });
    const addEmpty = tree.root.findAllByType("ui-button").find((b) => b.props.label === "+ Crear nota");
    await act(async () => {
      await addEmpty.props.onPress();
    });
    expect(mockCreateNote).toHaveBeenCalledTimes(1);
    expect(mockPush).toHaveBeenCalledWith("/notas/77");
  } finally {
    await act(async () => tree?.unmount());
  }
});
