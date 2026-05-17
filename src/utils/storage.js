import AsyncStorage from '@react-native-async-storage/async-storage';

const KEYS = {
  REMINDERS: '@interrupt/reminders',
  SETTINGS: '@interrupt/settings',
  SESSIONS: '@interrupt/sessions',
  DISMISSALS: '@interrupt/dismissals',
};

export async function saveReminders(reminders) {
  await AsyncStorage.setItem(KEYS.REMINDERS, JSON.stringify(reminders));
}

export async function loadReminders() {
  const raw = await AsyncStorage.getItem(KEYS.REMINDERS);
  return raw ? JSON.parse(raw) : [];
}

export async function saveDismissals(dismissals) {
  await AsyncStorage.setItem(KEYS.DISMISSALS, JSON.stringify(dismissals));
}

export async function loadDismissals() {
  const raw = await AsyncStorage.getItem(KEYS.DISMISSALS);
  return raw ? JSON.parse(raw) : {};
}

export async function saveSettings(settings) {
  await AsyncStorage.setItem(KEYS.SETTINGS, JSON.stringify(settings));
}

export async function loadSettings() {
  const raw = await AsyncStorage.getItem(KEYS.SETTINGS);
  return raw ? JSON.parse(raw) : defaultSettings();
}

export async function saveSessions(sessions) {
  await AsyncStorage.setItem(KEYS.SESSIONS, JSON.stringify(sessions));
}

export async function loadSessions() {
  const raw = await AsyncStorage.getItem(KEYS.SESSIONS);
  return raw ? JSON.parse(raw) : [];
}

function defaultSettings() {
  return {
    voiceStyle: 'default',
    activeMode: 'Focus',
    escalationEnabled: true,
    soundEnabled: true,
    hapticsEnabled: true,
    untilDoneEnabled: true,
  };
}
