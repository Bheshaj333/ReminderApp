import { NativeModules, NativeEventEmitter, Platform } from 'react-native';

const { AlarmModule } = NativeModules;

export const isNativeAlarmSupported = Platform.OS === 'android' && !!AlarmModule;

const alarmEmitter = isNativeAlarmSupported ? new NativeEventEmitter(AlarmModule) : null;

/**
 * Add a listener for native alarm triggers.
 */
export function addAlarmTriggerListener(callback) {
  if (!alarmEmitter) return { remove: () => {} };
  const subscription = alarmEmitter.addListener('onAlarmTriggered', callback);
  return subscription;
}

/**
 * Schedule a native exact alarm with speech announcement.
 */
export async function scheduleNativeAlarm(reminder) {
  if (!isNativeAlarmSupported) return false;

  try {
    const payload = {
      id: String(reminder.id),
      text: String(reminder.text || 'Reminder'),
      scheduledTime: Number(reminder.scheduledTime || Date.now()),
      repeatType: String(reminder.repeatType || 'once'),
      repeatInterval: Number(reminder.repeatInterval || 1),
      repeatUnit: String(reminder.repeatUnit || 'hours'),
      daysOfWeek: Array.isArray(reminder.daysOfWeek) ? reminder.daysOfWeek : [],
      repeatCount: Number(reminder.repeatCount ?? 0),
      burstInterval: Number(reminder.burstInterval ?? 0),
      voiceStyle: String(reminder.voiceStyle || 'default'),
      escalation: Boolean(reminder.escalation ?? true),
      active: Boolean(reminder.active ?? true),
    };

    return await AlarmModule.scheduleAlarm(payload);
  } catch (error) {
    console.error('[NativeAlarm] scheduleAlarm error:', error);
    return false;
  }
}

/**
 * Cancel a scheduled native alarm by ID.
 */
export async function cancelNativeAlarm(id) {
  if (!isNativeAlarmSupported || !id) return false;
  try {
    return await AlarmModule.cancelAlarm(String(id));
  } catch (error) {
    console.error('[NativeAlarm] cancelAlarm error:', error);
    return false;
  }
}

/**
 * Cancel all scheduled native alarms.
 */
export async function cancelAllNativeAlarms() {
  if (!isNativeAlarmSupported) return false;
  try {
    return await AlarmModule.cancelAllAlarms();
  } catch (error) {
    console.error('[NativeAlarm] cancelAllAlarms error:', error);
    return false;
  }
}

/**
 * Stop currently ringing alarm and TTS speech immediately.
 */
export async function stopNativeAlarm() {
  if (!isNativeAlarmSupported) return false;
  try {
    return await AlarmModule.stopAlarm();
  } catch (error) {
    console.error('[NativeAlarm] stopAlarm error:', error);
    return false;
  }
}

/**
 * Snooze currently ringing alarm for N minutes.
 */
export async function snoozeNativeAlarm(id, minutes = 5) {
  if (!isNativeAlarmSupported || !id) return false;
  try {
    return await AlarmModule.snoozeAlarm(String(id), minutes);
  } catch (error) {
    console.error('[NativeAlarm] snoozeAlarm error:', error);
    return false;
  }
}

/**
 * Check if an alarm is currently actively ringing.
 */
export async function isNativeAlarmRunning() {
  if (!isNativeAlarmSupported) return false;
  try {
    return await AlarmModule.isAlarmRunning();
  } catch (error) {
    return false;
  }
}

/**
 * Retrieve the alarm info that triggered the app launch (if any).
 */
export async function getTriggeredAlarm() {
  if (!isNativeAlarmSupported) return null;
  try {
    return await AlarmModule.getTriggeredAlarm();
  } catch (error) {
    return null;
  }
}

/**
 * Check if the app has permission to schedule exact alarms (Android 12+).
 */
export async function canScheduleExactAlarms() {
  if (!isNativeAlarmSupported) return true;
  try {
    return await AlarmModule.canScheduleExactAlarms();
  } catch (error) {
    return true;
  }
}

/**
 * Open Android system settings to grant exact alarm permission.
 */
export async function requestExactAlarmPermission() {
  if (!isNativeAlarmSupported) return false;
  try {
    return await AlarmModule.requestExactAlarmPermission();
  } catch (error) {
    console.error('[NativeAlarm] requestExactAlarmPermission error:', error);
    return false;
  }
}

/**
 * Check if app is exempt from Android battery optimization / Doze throttling.
 */
export async function isIgnoringBatteryOptimizations() {
  if (!isNativeAlarmSupported) return true;
  try {
    return await AlarmModule.isIgnoringBatteryOptimizations();
  } catch (error) {
    return true;
  }
}

/**
 * Request exemption from battery optimizations.
 */
export async function requestIgnoreBatteryOptimizations() {
  if (!isNativeAlarmSupported) return false;
  try {
    return await AlarmModule.requestIgnoreBatteryOptimizations();
  } catch (error) {
    console.error('[NativeAlarm] requestIgnoreBatteryOptimizations error:', error);
    return false;
  }
}
