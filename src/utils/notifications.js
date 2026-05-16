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
  
  // Verify permissions before scheduling
  const hasPermission = await requestPermissions();
  if (!hasPermission) {
    console.warn('[Notification] Cannot schedule: Permissions not granted.');
    return null;
  }

  const count = repeatCount || 1;
  const burst = burstInterval || 1; // minutes

  // Cancel existing
  await cancelReminder(id);

  const scheduleOne = async (identifier, trigger, index) => {
    try {
      return await Notifications.scheduleNotificationAsync({
        identifier,
        content: {
          title: 'interrupt',
          body: text,
          data: { reminderId: id, escalation: escalationEnabled, burstIndex: index },
          sound: true,
          categoryIdentifier: 'reminder',
          // Max priority for heads-up notification and breaking through idle
          priority: Platform.OS === 'android' ? Notifications.AndroidNotificationPriority.MAX : undefined,
          ...(Platform.OS === 'android' ? { channelId: 'reminders' } : {}),
        },
        trigger,
      });
    } catch (err) {
      console.error(`[Notification] Failed to schedule ${identifier}:`, err);
      return null;
    }
  };

  if (repeatType === 'once' && scheduledTime) {
    let lastId = null;
    const now = Date.now();
    console.log(`[Notification] Scheduling 'once' reminder for: ${new Date(scheduledTime).toLocaleTimeString()} (Current: ${new Date(now).toLocaleTimeString()})`);
    
    for (let i = 0; i < count; i++) {
      const time = scheduledTime + (i * burst * 60 * 1000);
      const finalTime = (i === 0 && time < now) ? now + 2000 : time;
      
      if (finalTime < now) {
         console.log(`[Notification] Skipping burst ${i} because ${new Date(finalTime).toLocaleTimeString()} is in the past.`);
         continue;
      }
      
      console.log(`[Notification] Triggering burst ${i} at: ${new Date(finalTime).toLocaleTimeString()}`);
      // lastId = await scheduleOne(`${id}_${i}`, finalTime, i);
      lastId = await scheduleOne(
        `${id}_${i}`,
        {
          type: 'date',
          date: new Date(finalTime),
          channelId: 'reminders',
        },
        i
      );
    }
    return lastId;
  }

  if (repeatType === 'daily' && scheduledTime) {
    const baseDate = new Date(scheduledTime);
    console.log(`[Notification] Scheduling 'daily' reminder for: ${baseDate.toLocaleTimeString()}`);
    let lastId = null;
    for (let i = 0; i < count; i++) {
      const time = new Date(baseDate.getTime() + (i * burst * 60 * 1000));
      lastId = await scheduleOne(`${id}_${i}`, {
        type: 'calendar',
        hour: time.getHours(),
        minute: time.getMinutes(),
        repeats: true,
      }, i);
    }
    return lastId;
  }

  if (repeatType === 'weekend' && scheduledTime) {
    const baseDate = new Date(scheduledTime);
    console.log(`[Notification] Scheduling 'weekend' reminder for: ${baseDate.toLocaleTimeString()}`);
    let lastId = null;
    for (let i = 0; i < count; i++) {
      const time = new Date(baseDate.getTime() + (i * burst * 60 * 1000));
      // Schedule for Saturday (7)
      await scheduleOne(`${id}_sat_${i}`, { 
        type: 'calendar',
        weekday: 7, 
        hour: time.getHours(), 
        minute: time.getMinutes(), 
        repeats: true 
      }, i);
      // Schedule for Sunday (1)
      lastId = await scheduleOne(`${id}_sun_${i}`, { 
        type: 'calendar',
        weekday: 1, 
        hour: time.getHours(), 
        minute: time.getMinutes(), 
        repeats: true 
      }, i);
    }
    return lastId;
  }

  if (repeatType === 'custom' && repeatInterval && scheduledTime) {
    const now = Date.now();
    const baseDate = new Date(scheduledTime);
    const promises = [];
    
    console.log(`[Notification] Scheduling 'custom' reminder every ${repeatInterval} ${repeatUnit}`);

    if (repeatUnit === 'weeks' || repeatUnit === 'months' || repeatUnit === 'years') {
      // For weeks, months, and years, we calculate future dates manually
      for (let i = 0; i < 10; i++) { // Schedule next 10 occurrences
        let occurrenceDate = new Date(baseDate);
        
        if (repeatUnit === 'weeks') {
          const days = reminder.daysOfWeek && reminder.daysOfWeek.length > 0 ? reminder.daysOfWeek : [baseDate.getDay() + 1];
          const weekStart = new Date(baseDate);
          weekStart.setDate(baseDate.getDate() + (i * repeatInterval * 7));
          
          for (const day of days) {
            const d = new Date(weekStart);
            const diff = (day - 1) - d.getDay();
            d.setDate(d.getDate() + diff);
            
            for (let j = 0; j < count; j++) {
              const time = new Date(d.getTime() + (j * burst * 60 * 1000));
              if (time.getTime() < now) continue;
              
              promises.push(scheduleOne(`${id}_${i}_${day}_${j}`, {
                type: 'date',
                date: time,
                channelId: 'reminders',
              }, j));
            }
          }
        } else if (repeatUnit === 'months') {
          occurrenceDate.setMonth(baseDate.getMonth() + (i * repeatInterval));
          for (let j = 0; j < count; j++) {
            const time = new Date(occurrenceDate.getTime() + (j * burst * 60 * 1000));
            if (time.getTime() < now) continue;
            
            promises.push(scheduleOne(`${id}_${i}_${j}`, {
              type: 'date',
              date: time,
              channelId: 'reminders',
            }, j));
          }
        } else if (repeatUnit === 'years') {
          occurrenceDate.setFullYear(baseDate.getFullYear() + (i * repeatInterval));
          for (let j = 0; j < count; j++) {
            const time = new Date(occurrenceDate.getTime() + (j * burst * 60 * 1000));
            if (time.getTime() < now) continue;
            
            promises.push(scheduleOne(`${id}_${i}_${j}`, {
              type: 'date',
              date: time,
              channelId: 'reminders',
            }, j));
          }
        }
      }
    } else {
      // Original logic for minutes, hours, days
      let intervalSeconds = repeatInterval;
      if (repeatUnit === 'minutes') intervalSeconds *= 60;
      else if (repeatUnit === 'days') intervalSeconds *= 86400;
      else intervalSeconds *= 3600; // default hours

      for (let i = 0; i < 20; i++) {
        const baseTime = scheduledTime + (i * intervalSeconds * 1000);
        for (let j = 0; j < count; j++) {
          const time = baseTime + (j * burst * 60 * 1000);
          if (time < now) continue;
          promises.push(
            scheduleOne(`${id}_${i}_${j}`, {
              type: 'date',
              date: new Date(time),
              channelId: 'reminders',
            }, j)
          );
        }
      }
    }
    const results = await Promise.all(promises);
    return results.length > 0 ? results[results.length - 1] : null;
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
      priority: Platform.OS === 'android' ? Notifications.AndroidNotificationPriority.MAX : undefined,
    },
    trigger: { 
      type: 'timeInterval',
      seconds: delays[step] + 1,
      channelId: 'reminders',
    },
  });
}

export function addNotificationResponseListener(handler) {
  return Notifications.addNotificationResponseReceivedListener(handler);
}

export function addNotificationReceivedListener(handler) {
  return Notifications.addNotificationReceivedListener(handler);
}
