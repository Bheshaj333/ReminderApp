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
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

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

  return finalStatus === 'granted';
}

export async function scheduleReminder(reminder) {
  const { id, text, scheduledTime, repeatType, repeatInterval, repeatUnit, escalationEnabled, repeatCount, burstInterval, daysOfWeek } = reminder;
  
  const hasPermission = await requestPermissions();
  if (!hasPermission) {
    console.warn('[Notification] No permission to schedule notifications');
    return null;
  }

  const count = repeatCount || 1;
  const burst = burstInterval || 1; 

  await cancelReminder(id);

  const scheduleOne = async (identifier, trigger, index, baseOccTime) => {
    try {
      // EXPO-NOTIFICATIONS MANDATE: Trigger must be correctly formatted.
      // It MUST contain a 'type' OR 'channelId' entry.
      
      let finalTrigger = {};
      
      if (trigger instanceof Date) {
        finalTrigger = { type: 'date', date: trigger.getTime() };
      } else {
        finalTrigger = { ...trigger };
        // Map common properties to types if missing
        if (!finalTrigger.type) {
          if (finalTrigger.seconds !== undefined) {
            finalTrigger.type = 'timeInterval';
          } else if (finalTrigger.hour !== undefined) {
            if (Platform.OS === 'android') {
              finalTrigger.type = finalTrigger.weekday !== undefined ? 'weekly' : 'daily';
            } else {
              finalTrigger.type = 'calendar';
            }
          } else if (finalTrigger.date !== undefined) {
            finalTrigger.type = 'date';
          }
        }
      }

      const content = {
        title: 'interrupt',
        body: text,
        data: { 
          reminderId: id, 
          escalation: escalationEnabled, 
          burstIndex: index,
          occurrenceTime: baseOccTime
        },
        sound: true,
        vibrate: true,
        categoryIdentifier: 'reminder',
        priority: Notifications.AndroidNotificationPriority.MAX,
      };

      if (Platform.OS === 'android') {
        content.channelId = 'reminders';
        finalTrigger.channelId = 'reminders';
        
        // Android specific type mapping for calendar triggers
        if (finalTrigger.type === 'calendar') {
          finalTrigger.type = finalTrigger.weekday !== undefined ? 'weekly' : 'daily';
        }
      }

      return await Notifications.scheduleNotificationAsync({
        identifier,
        content,
        trigger: finalTrigger,
      });
    } catch (err) {
      console.error(`[Notification] Failed to schedule ${identifier}:`, err);
      return null;
    }
  };

  const now = Date.now();
  
  const ensureFuture = (date) => {
    let d = new Date(date);
    if (d.getTime() <= now) {
      return new Date(now + 5000); // 5 seconds from now
    }
    return d;
  };

  if (repeatType === 'once' && scheduledTime) {
    let lastId = null;
    const baseDate = ensureFuture(scheduledTime);
    const baseOccTime = `once_${baseDate.getTime()}`;
    
    for (let i = 0; i < count; i++) {
      const time = new Date(baseDate.getTime() + (i * burst * 60 * 1000));
      lastId = await scheduleOne(`${id}_${i}`, { type: 'date', date: time.getTime() }, i, baseOccTime);
    }
    return lastId;
  }

  if (repeatType === 'daily' && scheduledTime) {
    const baseDate = new Date(scheduledTime);
    const hour = baseDate.getHours();
    const minute = baseDate.getMinutes();
    const baseOccTime = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
    
    let lastId = null;
    for (let i = 0; i < count; i++) {
      const burstTime = new Date(baseDate.getTime() + (i * burst * 60 * 1000));
      lastId = await scheduleOne(`${id}_${i}`, {
        type: 'calendar',
        hour: burstTime.getHours(),
        minute: burstTime.getMinutes(),
        repeats: true,
      }, i, baseOccTime);
    }
    return lastId;
  }

  if (repeatType === 'weekend' && scheduledTime) {
    const baseDate = new Date(scheduledTime);
    const hour = baseDate.getHours();
    const minute = baseDate.getMinutes();
    const baseOccTime = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
    
    let lastId = null;
    for (let i = 0; i < count; i++) {
      const burstTime = new Date(baseDate.getTime() + (i * burst * 60 * 1000));
      const bHour = burstTime.getHours();
      const bMin = burstTime.getMinutes();

      // Saturday (7 in expo-notifications)
      await scheduleOne(`${id}_sat_${i}`, { type: 'calendar', weekday: 7, hour: bHour, minute: bMin, repeats: true }, i, baseOccTime);
      // Sunday (1 in expo-notifications)
      lastId = await scheduleOne(`${id}_sun_${i}`, { type: 'calendar', weekday: 1, hour: bHour, minute: bMin, repeats: true }, i, baseOccTime);
    }
    return lastId;
  }

  if (repeatType === 'custom' && repeatInterval && scheduledTime) {
    const baseDate = new Date(scheduledTime);
    
    if (repeatUnit === 'weeks') {
      const days = daysOfWeek && daysOfWeek.length > 0 ? daysOfWeek : [baseDate.getDay() + 1];
      let lastId = null;
      for (const day of days) {
        const baseOccTime = `custom_w_${day}`;
        for (let i = 0; i < count; i++) {
          const burstTime = new Date(baseDate.getTime() + (i * burst * 60 * 1000));
          // Expo weekday: 1 (Sun) to 7 (Sat)
          lastId = await scheduleOne(`${id}_w${day}_${i}`, { 
            type: 'calendar',
            weekday: day, 
            hour: burstTime.getHours(), 
            minute: burstTime.getMinutes(), 
            repeats: repeatInterval === 1 
          }, i, baseOccTime);
        }
      }
      return lastId;
    } 
    
    let intervalSeconds = repeatInterval;
    if (repeatUnit === 'minutes') intervalSeconds *= 60;
    else if (repeatUnit === 'hours') intervalSeconds *= 3600;
    else if (repeatUnit === 'days') intervalSeconds *= 86400;
    else {
      const time = ensureFuture(scheduledTime);
      return await scheduleOne(`${id}_0`, { type: 'date', date: time.getTime() }, 0, `custom_${time.getTime()}`);
    }

    let lastId = null;
    for (let i = 0; i < count; i++) {
      const delayFromStart = (i * burst * 60);
      const time = ensureFuture(scheduledTime + (delayFromStart * 1000));
      const secondsUntilFirst = Math.max(1, Math.floor((time.getTime() - now) / 1000));
      
      lastId = await scheduleOne(`${id}_${i}`, {
        type: 'timeInterval',
        seconds: secondsUntilFirst,
        repeats: false, 
      }, i, `custom_${time.getTime()}`);
    }
    return lastId;
  }
  return null;
}

export async function cancelReminder(id) {
  try {
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    const toCancel = scheduled.filter(notif => {
      const { reminderId } = notif.content.data;
      return reminderId === id || notif.identifier.startsWith(`${id}_`);
    });
    
    await Promise.all(toCancel.map(notif => 
      Notifications.cancelScheduledNotificationAsync(notif.identifier).catch(() => {})
    ));
  } catch (err) {
    console.error('[Notification] Error canceling:', err);
  }
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
      vibrate: true,
      priority: Notifications.AndroidNotificationPriority.MAX,
    },
    trigger: { 
      type: 'timeInterval',
      seconds: delays[step] + 1,
      channelId: 'reminders',
      precise: true,
    },
  });
}

export function addNotificationResponseListener(handler) {
  return Notifications.addNotificationResponseReceivedListener(handler);
}

export function addNotificationReceivedListener(handler) {
  return Notifications.addNotificationReceivedListener(handler);
}
