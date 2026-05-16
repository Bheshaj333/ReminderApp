import React, { createContext, useContext, useReducer, useEffect } from 'react';
import { loadReminders, saveReminders, loadSettings, saveSettings } from '../utils/storage';
import { scheduleReminder, cancelReminder, addNotificationReceivedListener, addNotificationResponseListener } from '../utils/notifications';

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

    default:
      return state;
  }
}

export function AppProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, initialState);

  useEffect(() => {
    async function hydrate() {
      const [reminders, settings] = await Promise.all([
        loadReminders(),
        loadSettings(),
      ]);
      dispatch({ type: 'HYDRATE', payload: { reminders, settings } });
    }
    hydrate();
  }, []);

  useEffect(() => {
    const notifListener = addNotificationReceivedListener(notification => {
      const { reminderId } = notification.request.content.data;
      if (reminderId) {
        const reminder = state.reminders.find(r => r.id === reminderId);
        if (reminder) {
          dispatch({ type: 'SET_ACTIVE_REMINDER', payload: reminder });
        }
      }
    });

    const responseListener = addNotificationResponseListener(response => {
      const { reminderId } = response.notification.request.content.data;
      if (reminderId) {
        const reminder = state.reminders.find(r => r.id === reminderId);
        if (reminder) {
          dispatch({ type: 'SET_ACTIVE_REMINDER', payload: reminder });
        }
      }
    });

    return () => {
      notifListener.remove();
      responseListener.remove();
    };
  }, [state.reminders]);

  useEffect(() => {
    if (!state.loading) {
      saveReminders(state.reminders);
    }
  }, [state.reminders, state.loading]);

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
    dispatch({ type: 'SET_ACTIVE_REMINDER', payload: null });
    // Schedule a one-time reminder in 5 minutes
    const snoozeTime = Date.now() + 5 * 60 * 1000;
    await scheduleReminder({
      ...reminder,
      id: `${reminder.id}_snooze`,
      repeatType: 'once',
      scheduledTime: snoozeTime,
    });
  };

  const ignoreReminder = async (reminder) => {
    dispatch({ type: 'SET_ACTIVE_REMINDER', payload: null });
    // If it's a repeating reminder, it will trigger again anyway.
    // But if we want it to trigger "as per defined interval" immediately after being ignored?
    // Usually, ignore means "don't do anything, let the next scheduled one happen".
    // But user said: "igonre will make it repeat again as per the defined interval"
    // So we re-schedule it to trigger after its interval.
    if (reminder.repeatInterval) {
      await scheduleReminder(reminder);
    }
  };

  const updateSettings = (patch) => {
    dispatch({ type: 'UPDATE_SETTINGS', payload: patch });
  };

  return (
    <AppContext.Provider value={{ 
      state, addReminder, updateReminder, deleteReminder, 
      toggleReminder, updateSettings, snoozeReminder, ignoreReminder, dispatch 
    }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  return useContext(AppContext);
}
