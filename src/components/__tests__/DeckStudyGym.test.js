import React from "react";
import { act, create } from "react-test-renderer";
import Estudiar from "../../app/mazos/[id]/estudiar";
import { reviewCard } from "../../db/cards";

jest.mock("react-native", () => ({
  Platform: { OS: "android", select: (values) => values.android ?? values.default },
  StyleSheet: { create: (styles) => styles }, View: "View", Text: "Text", Pressable: "Pressable",
}));
jest.mock("expo-router", () => ({
  Stack: { Screen: () => null }, useLocalSearchParams: () => ({ id: "7", ordered: "1" }),
  useRouter: () => ({}), useFocusEffect: (callback) => require("react").useEffect(callback, [callback]),
}));
jest.mock("expo-haptics", () => ({}));
jest.mock("@expo/vector-icons/Feather", () => () => null);
jest.mock("../ConfettiOverlay", () => () => null);
jest.mock("../StarField", () => () => null);
jest.mock("../ProgressBar", () => () => null);
jest.mock("../Skeleton", () => () => null);
jest.mock("../FlipCard", () => (props) => require("react").createElement("flip-card", props));
jest.mock("../ChatAuditor", () => (props) => require("react").createElement("gym", props));
jest.mock("../SwipeCard", () => ({ children }) => children);
jest.mock("../useStudyKeyboard", () => () => null);
jest.mock("../useSyncRefresh", () => ({ useSyncRefresh: () => {} }));
jest.mock("../ui", () => ({ Screen: ({ children }) => children, Button: () => null, EmptyState: () => null, Pill: () => null }));
jest.mock("../../lib/notifications", () => ({ syncReviewReminder: jest.fn().mockResolvedValue(null) }));
jest.mock("../../db/cards", () => ({
  getCard: jest.fn(), setCardStarred: jest.fn(), snapshotFsrs: () => ({}), undoReview: jest.fn(),
  listCardsByDeck: jest.fn().mockResolvedValue([{ id: 1 }, { id: 2 }]),
  reviewCard: jest.fn().mockResolvedValue({ logId: 10 }),
}));
jest.mock("../../db/progress", () => ({ listDeckCardsNotReviewedToday: jest.fn().mockResolvedValue([
  { id: 1, deck_id: 7, front: "Uno", back: "A" }, { id: 2, deck_id: 7, front: "Dos", back: "B" },
]) }));
jest.mock("../../db/stats", () => ({ listWeakCards: jest.fn() }));

test("el rayo del estudio por mazo abre el gimnasio tras calificar una sola vez y se apaga para la siguiente", async () => {
  Object.defineProperty(globalThis, "fetch", { configurable: true, writable: true, value: jest.fn() });
  let screen;
  try {
    await act(async () => { screen = create(<Estudiar />); });
    await act(async () => screen.root.findByType("flip-card").props.onToggleGym());
    expect(screen.root.findByType("flip-card").props.gymArmed).toBe(true);
    await act(async () => screen.root.findAllByType("Pressable").find((node) => node.props.accessibilityLabel === "La recordé").props.onPress());
    expect(reviewCard).toHaveBeenCalledTimes(1);
    expect(screen.root.findByType("gym").props.card.id).toBe(1);
    await act(async () => screen.root.findByType("gym").props.onDone());
    const next = screen.root.findByType("flip-card");
    expect(next.props.cardId).toBe(2);
    expect(next.props.gymArmed).toBe(false);
    expect(reviewCard).toHaveBeenCalledTimes(1);
  } finally { await act(async () => screen?.unmount()); }
});
