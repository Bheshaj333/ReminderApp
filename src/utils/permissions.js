import { useCallback, useEffect, useState } from 'react';
import { AppState, Linking, Platform, PermissionsAndroid } from 'react-native';
import {
  areNotificationsEnabled,
  canScheduleExactAlarms, requestExactAlarmPermission,
  canUseFullScreenIntent, requestFullScreenIntentPermission,
  canDrawOverlays, requestOverlayPermission,
  isIgnoringBatteryOptimizations, requestIgnoreBatteryOptimizations,
  isNativeAlarmSupported,
} from './nativeAlarm';

async function requestNotifications() {
  if (await areNotificationsEnabled()) return;
  // Android 13+ has a runtime prompt; once denied for good (or on older Android) only settings can fix it
  if (Platform.OS === 'android' && Platform.Version >= 33) {
    const result = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS);
    if (result !== PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN) return;
  }
  Linking.openSettings();
}

/** Everything the app needs to ring reliably, in the order it is asked for on first launch. */
export const PERMISSIONS = [
  {
    key: 'notifications', icon: 'bell', title: 'Notifications',
    ok: 'Reminders can alert you', need: 'Needed to show reminders at all',
    why: 'So reminders can appear with Done, Snooze and Dismiss.',
    check: areNotificationsEnabled, request: requestNotifications,
  },
  {
    key: 'exact', icon: 'clock', title: 'Exact alarms',
    ok: 'Rings at the exact minute', need: 'Needed to ring on time',
    why: 'So a 9:00 reminder rings at 9:00, not “around” 9.',
    check: canScheduleExactAlarms, request: requestExactAlarmPermission,
  },
  {
    key: 'fullscreen', icon: 'smartphone', title: 'Lock-screen alarm',
    ok: 'Shows over the lock screen', need: 'Needed to show Done / Snooze when locked',
    why: 'So the alarm screen shows over your lock screen.',
    check: canUseFullScreenIntent, request: requestFullScreenIntentPermission,
  },
  {
    key: 'overlay', icon: 'maximize', title: 'Auto-open alarm screen',
    ok: 'Pops up by itself like an alarm', need: 'Allow "Display over other apps"',
    why: 'So the alarm opens by itself, like your clock app.',
    check: canDrawOverlays, request: requestOverlayPermission,
  },
  {
    key: 'battery', icon: 'battery-charging', title: 'Battery optimization',
    ok: 'Android won\'t delay your alarms', need: 'Stop Android from delaying alarms',
    why: 'So Android never puts your reminders to sleep.',
    check: isIgnoringBatteryOptimizations, request: requestIgnoreBatteryOptimizations,
  },
].filter(p => isNativeAlarmSupported || p.key === 'notifications');

/** { key: boolean } for every permission. */
async function checkAllPermissions() {
  const entries = await Promise.all(PERMISSIONS.map(async p => {
    try {
      return [p.key, await p.check()];
    } catch (e) {
      return [p.key, true];
    }
  }));
  return Object.fromEntries(entries);
}

/** Live permission status; re-checked whenever the app comes back from the system settings. */
export function usePermissions() {
  const [perms, setPerms] = useState(null);
  const refresh = useCallback(() => checkAllPermissions().then(setPerms), []);
  useEffect(() => {
    refresh();
    const sub = AppState.addEventListener('change', s => s === 'active' && refresh());
    return () => sub.remove();
  }, [refresh]);
  const missing = perms ? PERMISSIONS.filter(p => perms[p.key] === false) : [];
  return { perms, missing, refresh };
}
