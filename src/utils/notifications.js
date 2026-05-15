import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

export async function requestPermissions() {
  if (!Device.isDevice) return false;
  const { status: existing } = await Notifications.getPermissionsAsync();
  if (existing === 'granted') return true;
  const { status } = await Notifications.requestPermissionsAsync();
  if (status !== 'granted') return false;
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('reminders', {
      name: 'Reminders',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#78BDAF',
    });
  }
  return true;
}

export async function scheduleReminder(reminder) {
  const { id, text, scheduledTime, repeatInterval, escalationEnabled } = reminder;

  // Cancel existing
  await cancelReminder(id);

  const trigger = scheduledTime
    ? { date: new Date(scheduledTime) }
    : repeatInterval
    ? { seconds: repeatInterval * 60, repeats: true }
    : null;

  if (!trigger) return null;

  const notifId = await Notifications.scheduleNotificationAsync({
    identifier: id,
    content: {
      title: 'interrupt',
      body: text,
      data: { reminderId: id, escalation: escalationEnabled },
      sound: true,
      categoryIdentifier: 'reminder',
    },
    trigger,
  });

  return notifId;
}

export async function cancelReminder(id) {
  try {
    await Notifications.cancelScheduledNotificationAsync(id);
  } catch (_) {}
}

export async function cancelAllReminders() {
  await Notifications.cancelAllScheduledNotificationsAsync();
}

export async function scheduleEscalatingReminder(reminder, escalationStep = 0) {
  const delays = [0, 30, 60, 90, 120]; // seconds
  const step = Math.min(escalationStep, delays.length - 1);
  if (step >= delays.length) return;

  await Notifications.scheduleNotificationAsync({
    identifier: `${reminder.id}_esc_${step}`,
    content: {
      title: step >= 3 ? '⚠️ interrupt' : 'interrupt',
      body: reminder.text,
      data: { reminderId: reminder.id, escalationStep: step, isEscalation: true },
      sound: true,
      priority: step >= 3 ? 'max' : 'high',
    },
    trigger: { seconds: delays[step] + 1 },
  });
}

export function addNotificationResponseListener(handler) {
  return Notifications.addNotificationResponseReceivedListener(handler);
}

export function addNotificationReceivedListener(handler) {
  return Notifications.addNotificationReceivedListener(handler);
}
