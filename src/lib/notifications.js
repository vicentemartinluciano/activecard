import { Platform } from "react-native";

import { getDailyReviewStats } from "../db/reviewQueue";
import { getSetting, setSetting } from "../db/settings";

const PREFS_KEY = "reviewReminder";
const SCHEDULED_KEY = "reviewReminderScheduled";
const CHANNEL_ID = "repaso-diario";

export const DEFAULT_REMINDER = { enabled: false, time: "20:30" };

export function parseReminderTime(value) {
  const match = /^(\d{1,2}):(\d{2})$/.exec((value || "").trim());
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;
  return { hour, minute, formatted: `${String(hour).padStart(2, "0")}:${match[2]}` };
}

export function getReminderTarget(now, time, forceTomorrow = false) {
  const parsed = parseReminderTime(time);
  if (!parsed) return null;
  const target = new Date(now);
  target.setHours(parsed.hour, parsed.minute, 0, 0);
  if (forceTomorrow || target.getTime() <= now.getTime()) {
    target.setDate(target.getDate() + 1);
  }
  return target;
}

export async function getReminderPrefs() {
  const stored = await getSetting(PREFS_KEY, DEFAULT_REMINDER);
  const parsed = parseReminderTime(stored?.time);
  return {
    enabled: !!stored?.enabled,
    time: parsed?.formatted || DEFAULT_REMINDER.time,
  };
}

export async function setReminderPrefs(next) {
  const current = await getReminderPrefs();
  const merged = { ...current, ...next };
  const parsed = parseReminderTime(merged.time);
  if (!parsed) throw new Error("La hora debe tener formato HH:MM.");
  const prefs = { enabled: !!merged.enabled, time: parsed.formatted };
  await setSetting(PREFS_KEY, prefs);
  return prefs;
}

async function cancelPrevious(Notifications) {
  const scheduled = await getSetting(SCHEDULED_KEY, null);
  if (scheduled?.id) {
    try {
      await Notifications.cancelScheduledNotificationAsync(scheduled.id);
    } catch {
      // Si Android ya la entregó, el identificador deja de ser cancelable.
    }
  }
  await setSetting(SCHEDULED_KEY, null);
}

export async function configureNotificationHandler() {
  if (Platform.OS === "web") return;
  const Notifications = await import("expo-notifications");
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
}

export async function subscribeToReminderPress(onRoute) {
  if (Platform.OS === "web") return () => {};
  const Notifications = await import("expo-notifications");
  const open = (response) => {
    const route = response?.notification?.request?.content?.data?.route;
    if (typeof route === "string") onRoute(route);
  };
  const lastResponse = await Notifications.getLastNotificationResponseAsync();
  if (lastResponse) {
    open(lastResponse);
    Notifications.clearLastNotificationResponse();
  }
  const subscription = Notifications.addNotificationResponseReceivedListener(open);
  return () => subscription.remove();
}

export async function syncReviewReminder({
  now = new Date(),
  requestPermission = false,
} = {}) {
  if (Platform.OS === "web") return { status: "unsupported" };
  const Notifications = await import("expo-notifications");
  const prefs = await getReminderPrefs();
  await cancelPrevious(Notifications);
  if (!prefs.enabled) return { status: "disabled" };

  let permission = await Notifications.getPermissionsAsync();
  if (permission.status !== "granted" && requestPermission) {
    permission = await Notifications.requestPermissionsAsync();
  }
  if (permission.status !== "granted") return { status: "permission-denied" };

  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
      name: "Repaso diario",
      description: "Recordatorios cuando todavía quedan tarjetas pendientes.",
      importance: Notifications.AndroidImportance.DEFAULT,
      sound: "default",
    });
  }

  let target = getReminderTarget(now, prefs.time);
  let statsAtTarget = await getDailyReviewStats(
    target.toDateString() === now.toDateString() ? now : target
  );
  if (statsAtTarget.remaining === 0 && target.toDateString() === now.toDateString()) {
    target = getReminderTarget(now, prefs.time, true);
    statsAtTarget = await getDailyReviewStats(target);
  }
  if (statsAtTarget.remaining === 0) return { status: "no-pending", target };

  const id = await Notifications.scheduleNotificationAsync({
    content: {
      title: "Tu repaso está esperando",
      body: `Te quedan ${statsAtTarget.remaining} ${
        statsAtTarget.remaining === 1 ? "tarjeta" : "tarjetas"
      } para cerrar el día.`,
      data: { route: "/repaso" },
      sound: "default",
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: target,
      channelId: Platform.OS === "android" ? CHANNEL_ID : undefined,
    },
  });
  await setSetting(SCHEDULED_KEY, { id, target: target.toISOString() });
  return { status: "scheduled", id, target, remaining: statsAtTarget.remaining };
}
