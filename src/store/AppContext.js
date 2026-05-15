import React, { createContext, useContext, useReducer, useEffect } from 'react';
import { loadReminders, saveReminders, loadSettings, saveSettings } from '../utils/storage';
import { scheduleReminder, cancelReminder } from '../utils/notifications';

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
    dispatch({ type: 'TOGGLE_REMINDER', payload: id });
    if (reminder.active) {
      await cancelReminder(id);
    } else {
      await scheduleReminder({ ...reminder, active: true });
    }
  };

  const updateSettings = (patch) => {
    dispatch({ type: 'UPDATE_SETTINGS', payload: patch });
  };

  return (
    <AppContext.Provider value={{ state, addReminder, updateReminder, deleteReminder, toggleReminder, updateSettings, dispatch }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  return useContext(AppContext);
}
