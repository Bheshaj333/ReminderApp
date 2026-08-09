import * as Notifications from 'expo-notifications';
import notifee, { 
  AndroidImportance, 
  AndroidVisibility, 
  TriggerType, 
  AndroidCategory,
  RepeatFrequency,
  EventType
} from '@notifee/react-native';
import * as Device from 'expo-device';
import * as TaskManager from 'expo-task-manager';
import { Platform, Linking } from 'react-native';
import { speak } from './speech';

// Existing Background Task for expo-notifications fallback
const BACKGROUND_NOTIFICATION_TASK = 'BACKGROUND_NOTIFICATION_TASK';

TaskManager.defineTask(BACKGROUND_NOTIFICATION_TASK, async ({ data, error, executionContext }) => {
   // Legacy task remains as a shell
});

export async function requestPermissions() {
  await notifee.requestPermission();
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (Platform.OS === 'android') {
    await notifee.createChannel({
      id: 'alarms',
      name: 'Reminders (Alarm)',
      importance: AndroidImportance.HIGH,
      vibration: true,
      vibrationPattern: [300, 500, 300, 500],
      lightColor: '#78BDAF',
      visibility: AndroidVisibility.PUBLIC,
      bypassDnd: true,
      sound: 'default',
    });
  }

  return finalStatus === 'granted';
}

export async function scheduleReminder(reminder) {
  const { id, text, scheduledTime, repeatType, repeatInterval, repeatUnit, escalationEnabled, repeatCount, burstInterval, daysOfWeek } = reminder;
  
  await requestPermissions();
  const count = repeatCount || 1;
  const burst = burstInterval || 1; 

  await cancelReminder(id);

  const scheduleOneNotifee = async (identifier, timestamp, index, baseOccTime, repeats = false) => {
    try {
      const trigger = {
        type: TriggerType.TIMESTAMP,
        timestamp: timestamp,
        alarmManager: true,
        repeatFrequency: repeats ? RepeatFrequency.DAILY : undefined,
      };

      await notifee.createTriggerNotification(
        {
          id: identifier,
          title: 'Reminder',
          body: text,
          data: { 
            reminderId: id, 
            burstIndex: index.toString(),
            occurrenceTime: baseOccTime
          },
          android: {
            channelId: 'alarms',
            category: AndroidCategory.ALARM,
            importance: AndroidImportance.HIGH,
            fullScreenAction: {
              id: 'default',
              launchActivity: 'default',
            },
            pressAction: {
              id: 'default',
              launchActivity: 'default',
            },
            actions: [
              { title: 'Done', pressAction: { id: 'done' } },
              { title: 'Snooze', pressAction: { id: 'snooze' } },
            ],
          },
        },
        trigger
      );
    } catch (err) {
      console.error(`[Notifee] Failed to schedule ${identifier}:`, err);
    }
  };

  const now = Date.now();
  const ensureFuture = (date) => {
    let d = new Date(date).getTime();
    return d <= now ? now + 5000 : d;
  };

  if (repeatType === 'once' && scheduledTime) {
    const baseDate = ensureFuture(scheduledTime);
    for (let i = 0; i < count; i++) {
      const time = baseDate + (i * burst * 60 * 1000);
      await scheduleOneNotifee(`${id}_${i}`, time, i, `once_${baseDate}`);
    }
  } else if (repeatType === 'daily' && scheduledTime) {
    const baseDate = new Date(scheduledTime);
    const hour = baseDate.getHours();
    const minute = baseDate.getMinutes();
    const baseOccTime = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
    
    for (let i = 0; i < count; i++) {
      let time = new Date();
      time.setHours(hour, minute + (i * burst), 0, 0);
      if (time.getTime() <= now) {
        time.setDate(time.getDate() + 1);
      }
      await scheduleOneNotifee(`${id}_${i}`, time.getTime(), i, baseOccTime, true);
    }
  } else if (repeatType === 'weekend' && scheduledTime) {
     // Notifee triggers are limited for complex weekly rules, we'll schedule for the next few occurrences
     const baseDate = new Date(scheduledTime);
     const hour = baseDate.getHours();
     const minute = baseDate.getMinutes();
     
     const scheduleForDay = async (dayOffset, prefix) => {
        let time = new Date();
        time.setHours(hour, minute, 0, 0);
        let currentDay = time.getDay(); // 0 is Sun, 6 is Sat
        let distance = (dayOffset - currentDay + 7) % 7;
        if (distance === 0 && time.getTime() <= now) distance = 7;
        time.setDate(time.getDate() + distance);

        for (let i = 0; i < count; i++) {
          const burstTime = new Date(time.getTime() + (i * burst * 60 * 1000));
          await scheduleOneNotifee(`${id}_${prefix}_${i}`, burstTime.getTime(), i, `weekend_${prefix}`, true);
        }
     };

     await scheduleForDay(6, 'sat');
     await scheduleForDay(0, 'sun');
  }

  return id;
}

export async function cancelReminder(id) {
  try {
    await notifee.cancelNotification(id);
    // Also cancel all with prefix
    const displayed = await notifee.getDisplayedNotifications();
    for (const d of displayed) {
      if (d.id.startsWith(`${id}_`)) await notifee.cancelNotification(d.id);
    }
    const triggerIds = await notifee.getTriggerNotificationIds();
    for (const tid of triggerIds) {
      if (tid.startsWith(`${id}_`)) await notifee.cancelNotification(tid);
    }
  } catch (err) {
    console.error('[Notifee] Error canceling:', err);
  }
}

export async function cancelAllReminders() {
  await notifee.cancelAllNotifications();
}

export function addNotificationResponseListener(handler) {
  // Map Notifee events to the handler format
  return notifee.onForegroundEvent(({ type, detail }) => {
    if (type === EventType.PRESS || type === EventType.ACTION_PRESS) {
      handler({
        notification: {
          request: {
            content: {
              data: detail.notification.data,
              body: detail.notification.body
            }
          }
        }
      });
    }
  });
}

export function addNotificationReceivedListener(handler) {
  // Notifee doesn't have a direct "received" listener in the same way, 
  // but we can use background events or foreground events.
  return { remove: () => {} };
}
