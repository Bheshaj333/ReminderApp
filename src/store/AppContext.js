import React, { createContext, useContext, useReducer, useEffect } from 'react';
import * as Notifications from 'expo-notifications';
import notifee from '@notifee/react-native';
import { loadReminders, saveReminders, loadSettings, saveSettings, loadDismissals, saveDismissals } from '../utils/storage';
import { scheduleReminder, cancelReminder, addNotificationReceivedListener, addNotificationResponseListener } from '../utils/notifications';
import { speak } from '../utils/speech';
import { 
  stopNativeAlarm, 
  snoozeNativeAlarm, 
  getTriggeredAlarm, 
  isNativeAlarmRunning, 
  isNativeAlarmSupported,
  addAlarmTriggerListener 
} from '../utils/nativeAlarm';

const AppContext = createContext(null);

const initialState = {
  reminders: [],
  settings: {
    voiceStyle: 'default',
    activeMode: 'Focus',
    escalationEnabled: true,
    soundEnabled: true,
    hapticsEnabled: true,
    untilDoneEnabled: true,
  },
  activeReminder: null,
  dismissedOccurrences: {}, // { "reminderId_occurrenceTime": "YYYY-MM-DD" }
  loading: true,
};

function reducer(state, action) {
  switch (action.type) {
    case 'HYDRATE':
      return { ...state, ...action.payload, loading: false };

    case 'ADD_REMINDER': {
      const reminders = [...state.reminders, action.payload];
      return { ...state, reminders };
    }
    case 'UPDATE_REMINDER': {
      const reminders = state.reminders.map(r =>
        r.id === action.payload.id ? { ...r, ...action.payload } : r
      );
      return { ...state, reminders };
    }
    case 'DELETE_REMINDER': {
      const reminders = state.reminders.filter(r => r.id !== action.payload);
      return { ...state, reminders };
    }
    case 'TOGGLE_REMINDER': {
      const reminders = state.reminders.map(r =>
        r.id === action.payload ? { ...r, active: !r.active } : r
      );
      return { ...state, reminders };
    }
    case 'UPDATE_SETTINGS':
      return { ...state, settings: { ...state.settings, ...action.payload } };

    case 'SET_ACTIVE_REMINDER':
      return { ...state, activeReminder: action.payload };

    case 'DISMISS_OCCURRENCE': {
      const { reminderId, occurrenceTime } = action.payload;
      const today = new Date().toISOString().split('T')[0];
      return {
        ...state,
        dismissedOccurrences: {
          ...state.dismissedOccurrences,
          [`${reminderId}_${occurrenceTime}`]: today,
        },
      };
    }

    default:
      return state;
  }
}

export function AppProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, initialState);

  useEffect(() => {
    async function hydrate() {
      const [reminders, settings, dismissedOccurrences] = await Promise.all([
        loadReminders(),
        loadSettings(),
        loadDismissals(),
      ]);
      
      let initialActive = null;

      // Check native triggered alarm first
      const nativeTriggered = await getTriggeredAlarm();
      if (nativeTriggered && nativeTriggered.id) {
        const reminder = reminders.find(r => r.id === nativeTriggered.id);
        if (reminder) {
          initialActive = { ...reminder, ...nativeTriggered };
        }
      }

      // Check for initial notification from Notifee (Full Screen Intent or Press)
      if (!initialActive) {
        const initialNotification = await notifee.getInitialNotification();
        if (initialNotification) {
          const data = initialNotification.notification.data;
          const reminder = reminders.find(r => r.id === data.reminderId);
          if (reminder) {
            initialActive = { ...reminder, ...data };
          }
        } else {
          // Fallback to expo-notifications
          const lastResponse = await Notifications.getLastNotificationResponseAsync();
          if (lastResponse) {
            const data = lastResponse.notification.request.content.data;
            const reminder = reminders.find(r => r.id === data.reminderId);
            if (reminder) {
              initialActive = { ...reminder, ...data };
            }
          }
        }
      }

      dispatch({ 
        type: 'HYDRATE', 
        payload: { 
          reminders, 
          settings, 
          dismissedOccurrences, 
          activeReminder: initialActive 
        } 
      });
    }
    hydrate();
  }, []);

  useEffect(() => {
    const handleNotification = (data, body) => {
      const { reminderId, occurrenceTime, burstIndex } = data;
      if (!reminderId) return;

      const reminder = state.reminders.find(r => r.id === reminderId);
      if (!reminder) return;

      // Check if this occurrence is dismissed for today
      const today = new Date().toISOString().split('T')[0];
      const dismissalKey = `${reminderId}_${occurrenceTime}`;
      if (state.dismissedOccurrences[dismissalKey] === today) {
        return;
      }

      if (body && !isNativeAlarmSupported) {
        speak(body, state.settings.voiceStyle);
      }

      dispatch({ type: 'SET_ACTIVE_REMINDER', payload: { ...reminder, burstIndex, occurrenceTime } });
    };

    const notifListener = addNotificationReceivedListener(notification => {
      if (notification?.request?.content?.data) {
        handleNotification(notification.request.content.data, notification.request.content.body);
      }
    });

    const responseListener = addNotificationResponseListener(response => {
      if (response?.notification?.request?.content?.data) {
        handleNotification(response.notification.request.content.data, response.notification.request.content.body);
      }
    });

    // Native alarm trigger listener
    const nativeAlarmSub = addAlarmTriggerListener((data) => {
      const { id, text, burstIndex, burstCount } = data;
      if (!id) return;
      const reminder = state.reminders.find(r => r.id === id);
      dispatch({ 
        type: 'SET_ACTIVE_REMINDER', 
        payload: { 
          ...(reminder || {}), 
          id, 
          text: text || reminder?.text, 
          burstIndex: burstIndex ?? 0,
          repeatCount: burstCount ?? reminder?.repeatCount ?? 0,
        } 
      });
    });

    return () => {
      if (notifListener && typeof notifListener.remove === 'function') {
        notifListener.remove();
      }
      if (responseListener && typeof responseListener.remove === 'function') {
        responseListener.remove();
      }
      if (nativeAlarmSub && typeof nativeAlarmSub.remove === 'function') {
        nativeAlarmSub.remove();
      }
    };
  }, [state.reminders, state.dismissedOccurrences, state.settings.voiceStyle]);

  useEffect(() => {
    if (!state.loading) {
      saveReminders(state.reminders);
      saveDismissals(state.dismissedOccurrences);
    }
  }, [state.reminders, state.dismissedOccurrences, state.loading]);

  useEffect(() => {
    if (!state.loading) {
      saveSettings(state.settings);
    }
  }, [state.settings, state.loading]);

  const addReminder = async (reminder) => {
    dispatch({ type: 'ADD_REMINDER', payload: reminder });
    if (reminder.active) {
      await scheduleReminder(reminder);
    }
  };

  const updateReminder = async (reminder) => {
    dispatch({ type: 'UPDATE_REMINDER', payload: reminder });
    await cancelReminder(reminder.id);
    if (reminder.active) {
      await scheduleReminder(reminder);
    }
  };

  const deleteReminder = async (id) => {
    dispatch({ type: 'DELETE_REMINDER', payload: id });
    await cancelReminder(id);
  };

  const toggleReminder = async (id) => {
    const reminder = state.reminders.find(r => r.id === id);
    if (!reminder) return;
    const newState = !reminder.active;
    dispatch({ type: 'UPDATE_REMINDER', payload: { id, active: newState } });
    if (newState) {
      await scheduleReminder({ ...reminder, active: true });
    } else {
      await cancelReminder(id);
    }
  };

  const snoozeReminder = async (reminder) => {
    const { occurrenceTime, id } = reminder; 
    if (occurrenceTime && occurrenceTime !== 'once') {
      dispatch({ type: 'DISMISS_OCCURRENCE', payload: { reminderId: id, occurrenceTime } });
    }
    dispatch({ type: 'SET_ACTIVE_REMINDER', payload: null });
    
    await snoozeNativeAlarm(id, 5);

    const snoozeTime = Date.now() + 5 * 60 * 1000;
    await scheduleReminder({
      ...reminder,
      id: `${id}_snooze`,
      repeatType: 'once',
      scheduledTime: snoozeTime,
    });
  };

  const ignoreReminder = async (reminder) => {
    await stopNativeAlarm();
    dispatch({ type: 'SET_ACTIVE_REMINDER', payload: null });
  };

  const dismissReminder = async (reminder) => {
    const { occurrenceTime, repeatCount, repeatType, id } = reminder;
    if (occurrenceTime && occurrenceTime !== 'once') {
      dispatch({ type: 'DISMISS_OCCURRENCE', payload: { reminderId: id, occurrenceTime } });
    }
    
    // If once reminder, mark inactive
    if (repeatType === 'once') {
      dispatch({ type: 'UPDATE_REMINDER', payload: { id, active: false } });
    }

    dispatch({ type: 'SET_ACTIVE_REMINDER', payload: null });
    
    // Stop native alarm ringing & TTS immediately
    await stopNativeAlarm();

    // Attempt to clear related notifications from the shade using Notifee and Expo
    try {
      await notifee.cancelNotification(id).catch(() => {});
      const count = repeatCount || 10;
      for (let i = 0; i < count; i++) {
        const identifier = `${id}_${i}`;
        await notifee.cancelNotification(identifier).catch(() => {});
        await Notifications.dismissNotificationAsync(identifier).catch(() => {});
      }
    } catch (err) {
      console.warn('[AppContext] Could not dismiss notifications:', err);
    }
  };

  const updateSettings = (patch) => {
    dispatch({ type: 'UPDATE_SETTINGS', payload: patch });
  };

  return (
    <AppContext.Provider value={{ 
      state, addReminder, updateReminder, deleteReminder, 
      toggleReminder, updateSettings, ignoreReminder, dismissReminder, snoozeReminder, dispatch 
    }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  return useContext(AppContext);
}
