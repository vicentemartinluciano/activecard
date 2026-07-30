import { Platform } from "react-native";

import { getDailyReviewStats } from "../../db/reviewQueue";
import { getSetting, setSetting } from "../../db/settings";
import {
  getReminderTarget,
  parseReminderTime,
  REVIEW_CHANNEL_ID,
  subscribeToReminderPress,
  syncReviewReminder,
  updateReviewReminderEnabled,
} from "../notifications";
import * as Notifications from "expo-notifications";

jest.mock("../../db/reviewQueue", () => ({
  getDailyReviewStats: jest.fn(),
}));

jest.mock("../../db/settings", () => ({
  getSetting: jest.fn(),
  setSetting: jest.fn(),
}));

jest.mock("expo-notifications", () => ({
  AndroidImportance: { DEFAULT: 3 },
  SchedulableTriggerInputTypes: { DATE: "date" },
  addNotificationResponseReceivedListener: jest.fn(),
  cancelScheduledNotificationAsync: jest.fn(),
  clearLastNotificationResponse: jest.fn(),
  getLastNotificationResponseAsync: jest.fn(),
  getPermissionsAsync: jest.fn(),
  requestPermissionsAsync: jest.fn(),
  scheduleNotificationAsync: jest.fn(),
  setNotificationChannelAsync: jest.fn(),
}));

const originalPlatformOS = Object.getOwnPropertyDescriptor(Platform, "OS");

function usePlatform(os) {
  Object.defineProperty(Platform, "OS", {
    configurable: true,
    value: os,
  });
}

describe("hora del recordatorio", () => {
  test.each([
    ["20:30", { hour: 20, minute: 30, formatted: "20:30" }],
    ["8:05", { hour: 8, minute: 5, formatted: "08:05" }],
    ["24:00", null],
    ["20:70", null],
    ["texto", null],
  ])("interpreta %s", (value, expected) => {
    expect(parseReminderTime(value)).toEqual(expected);
  });

  test("usa hoy si la hora todavía no pasó", () => {
    const now = new Date(2026, 6, 29, 10, 0);
    expect(getReminderTarget(now, "20:30")).toEqual(new Date(2026, 6, 29, 20, 30));
  });

  test("pasa a mañana si la hora ya pasó o se fuerza", () => {
    const now = new Date(2026, 6, 29, 21, 0);
    expect(getReminderTarget(now, "20:30")).toEqual(new Date(2026, 6, 30, 20, 30));
    expect(getReminderTarget(now, "22:00", true)).toEqual(new Date(2026, 6, 30, 22, 0));
  });
});

describe("recordatorio nativo", () => {
  let settings;

  beforeEach(() => {
    jest.clearAllMocks();
    usePlatform("android");
    settings = {
      reviewReminder: { enabled: true, time: "20:30" },
      reviewReminderScheduled: null,
    };
    getSetting.mockImplementation(async (key, fallback) =>
      Object.prototype.hasOwnProperty.call(settings, key) ? settings[key] : fallback
    );
    setSetting.mockImplementation(async (key, value) => {
      settings[key] = value;
    });
    getDailyReviewStats.mockResolvedValue({ remaining: 3 });
    Notifications.getPermissionsAsync.mockResolvedValue({ status: "granted" });
    Notifications.requestPermissionsAsync.mockResolvedValue({ status: "granted" });
    Notifications.setNotificationChannelAsync.mockResolvedValue();
    Notifications.cancelScheduledNotificationAsync.mockResolvedValue();
    Notifications.scheduleNotificationAsync.mockResolvedValue("notification-2");
    Notifications.getLastNotificationResponseAsync.mockResolvedValue(null);
    Notifications.addNotificationResponseReceivedListener.mockReturnValue({
      remove: jest.fn(),
    });
  });

  afterAll(() => {
    Object.defineProperty(Platform, "OS", originalPlatformOS);
  });

  test("crea el canal antes de solicitar permiso y programa con pendientes", async () => {
    const order = [];
    Notifications.setNotificationChannelAsync.mockImplementation(async () => {
      order.push("channel");
    });
    Notifications.getPermissionsAsync.mockImplementation(async () => {
      order.push("read-permission");
      return { status: "undetermined" };
    });
    Notifications.requestPermissionsAsync.mockImplementation(async () => {
      order.push("request-permission");
      return { status: "granted" };
    });

    const now = new Date(2026, 6, 29, 10, 0);
    const result = await syncReviewReminder({
      now,
      requestPermission: true,
      notificationsModule: Notifications,
    });

    expect(order.indexOf("channel")).toBeLessThan(order.indexOf("request-permission"));
    expect(Notifications.setNotificationChannelAsync).toHaveBeenCalledWith(
      REVIEW_CHANNEL_ID,
      expect.objectContaining({ name: "Repaso diario", sound: "default" })
    );
    expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledWith({
      content: expect.objectContaining({
        data: { route: "/repaso" },
        body: "Te quedan 3 tarjetas para cerrar el día.",
      }),
      trigger: {
        type: "date",
        date: new Date(2026, 6, 29, 20, 30),
        channelId: REVIEW_CHANNEL_ID,
      },
    });
    expect(result).toMatchObject({
      status: "scheduled",
      id: "notification-2",
      remaining: 3,
    });
    expect(settings.reviewReminderScheduled.id).toBe("notification-2");
  });

  test("un rechazo revierte la preferencia y deja el switch apagado", async () => {
    Notifications.getPermissionsAsync.mockResolvedValue({ status: "undetermined" });
    Notifications.requestPermissionsAsync.mockResolvedValue({ status: "denied" });

    const { prefs, result } = await updateReviewReminderEnabled(true, "20:30", {
      notificationsModule: Notifications,
    });

    expect(result.status).toBe("permission-denied");
    expect(prefs.enabled).toBe(false);
    expect(settings.reviewReminder.enabled).toBe(false);
    expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
  });

  test("cancela el aviso anterior al completar todo", async () => {
    settings.reviewReminderScheduled = { id: "notification-1" };
    getDailyReviewStats.mockResolvedValue({ remaining: 0 });

    const result = await syncReviewReminder({
      now: new Date(2026, 6, 29, 10, 0),
      notificationsModule: Notifications,
    });

    expect(Notifications.cancelScheduledNotificationAsync).toHaveBeenCalledWith(
      "notification-1"
    );
    expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
    expect(settings.reviewReminderScheduled).toBeNull();
    expect(result.status).toBe("no-pending");
  });

  test("al tocar el aviso abre la ruta de repaso", async () => {
    const remove = jest.fn();
    let listener;
    Notifications.getLastNotificationResponseAsync.mockResolvedValue({
      notification: { request: { content: { data: { route: "/repaso" } } } },
    });
    Notifications.addNotificationResponseReceivedListener.mockImplementation((callback) => {
      listener = callback;
      return { remove };
    });
    const onRoute = jest.fn();

    const unsubscribe = await subscribeToReminderPress(onRoute, {
      notificationsModule: Notifications,
    });
    listener({
      notification: { request: { content: { data: { route: "/repaso" } } } },
    });
    unsubscribe();

    expect(onRoute).toHaveBeenNthCalledWith(1, "/repaso");
    expect(onRoute).toHaveBeenNthCalledWith(2, "/repaso");
    expect(Notifications.clearLastNotificationResponse).toHaveBeenCalled();
    expect(remove).toHaveBeenCalled();
  });
});
