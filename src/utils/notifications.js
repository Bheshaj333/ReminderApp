import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    priority: Notifications.AndroidImportance.MAX,
  }),
});

export async function requestPermissions() {
  if (!Device.isDevice) return false;
  const { status: existing } = await Notifications.getPermissionsAsync();
  
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('reminders', {
      name: 'Reminders',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#78BDAF',
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
      bypassDnd: true,
      showBadge: true,
    });
  }

  if (existing === 'granted') return true;
  const { status } = await Notifications.requestPermissionsAsync();
  return status === 'granted';
}

export async function scheduleReminder(reminder) {
  const { id, text, scheduledTime, repeatType, repeatInterval, repeatUnit, escalationEnabled, repeatCount, burstInterval } = reminder;
  const count = repeatCount || 1;
  const burst = burstInterval || 1; // minutes

  // Cancel existing
  await cancelReminder(id);

  const scheduleOne = async (identifier, trigger, index) => {
    return await Notifications.scheduleNotificationAsync({
      identifier,
      content: {
        title: 'interrupt',
        body: text,
        data: { reminderId: id, escalation: escalationEnabled, burstIndex: index },
        sound: true,
        categoryIdentifier: 'reminder',
        priority: Notifications.AndroidImportance.MAX,
      },
      trigger,
    });
  };

  if (repeatType === 'once' && scheduledTime) {
    let lastId = null;
    for (let i = 0; i < count; i++) {
      const time = scheduledTime + (i * burst * 60 * 1000);
      if (time < Date.now()) continue;
      lastId = await scheduleOne(`${id}_${i}`, { date: new Date(time) }, i);
    }
    return lastId;
  }

  if (repeatType === 'daily' && scheduledTime) {
    const baseDate = new Date(scheduledTime);
    let lastId = null;
    for (let i = 0; i < count; i++) {
      const time = new Date(baseDate.getTime() + (i * burst * 60 * 1000));
      lastId = await scheduleOne(`${id}_${i}`, {
        hour: time.getHours(),
        minute: time.getMinutes(),
        repeats: true,
      }, i);
    }
    return lastId;
  }

  if (repeatType === 'weekend' && scheduledTime) {
    const baseDate = new Date(scheduledTime);
    let lastId = null;
    for (let i = 0; i < count; i++) {
      const time = new Date(baseDate.getTime() + (i * burst * 60 * 1000));
      // Schedule for Saturday (7)
      await scheduleOne(`${id}_sat_${i}`, { 
        weekday: 7, 
        hour: time.getHours(), 
        minute: time.getMinutes(), 
        repeats: true 
      }, i);
      // Schedule for Sunday (1)
      lastId = await scheduleOne(`${id}_sun_${i}`, { 
        weekday: 1, 
        hour: time.getHours(), 
        minute: time.getMinutes(), 
        repeats: true 
      }, i);
    }
    return lastId;
  }

  if (repeatType === 'custom' && repeatInterval && scheduledTime) {
    let intervalSeconds = repeatInterval;
    if (repeatUnit === 'minutes') intervalSeconds *= 60;
    else if (repeatUnit === 'days') intervalSeconds *= 86400;
    else intervalSeconds *= 3600; // default hours

    let lastId = null;
    const now = Date.now();
    // Schedule up to 20 occurrences to cover a decent amount of time
    for (let i = 0; i < 20; i++) {
      const baseTime = scheduledTime + (i * intervalSeconds * 1000);
      for (let j = 0; j < count; j++) {
        const time = baseTime + (j * burst * 60 * 1000);
        if (time < now) continue;
        lastId = await scheduleOne(`${id}_${i}_${j}`, { date: new Date(time) }, j);
      }
    }
    return lastId;
  }

  return null;
}

export async function cancelReminder(id) {
  try {
    // Cancel all potential notifications (bursts and intervals)
    for (let i = 0; i < 20; i++) {
      for (let j = 0; j < 10; j++) {
        await Notifications.cancelScheduledNotificationAsync(`${id}_${i}_${j}`);
      }
      await Notifications.cancelScheduledNotificationAsync(`${id}_${i}`);
      await Notifications.cancelScheduledNotificationAsync(`${id}_sat_${i}`);
      await Notifications.cancelScheduledNotificationAsync(`${id}_sun_${i}`);
      await Notifications.cancelScheduledNotificationAsync(`${id}_snooze_${i}`);
    }
    // Backward compatibility
    await Notifications.cancelScheduledNotificationAsync(id);
    await Notifications.cancelScheduledNotificationAsync(`${id}_sat`);
    await Notifications.cancelScheduledNotificationAsync(`${id}_sun`);
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
