import React, { createContext, useContext, useReducer, useEffect, useRef, useCallback } from 'react';
import { AppState } from 'react-native';
import { loadReminders, saveReminders, loadSettings, saveSettings, defaultSettings } from '../utils/storage';
import { onceFinishedAt, nextOccurrence } from '../utils/schedule';
import {
  scheduleNativeAlarm as scheduleReminder,
  cancelNativeAlarm as cancelReminder,
  cancelAllNativeAlarms as cancelAllReminders,
  stopNativeAlarm,
  snoozeNativeAlarm,
  dismissNativeAlarm,
  getTriggeredAlarm,
  isNativeAlarmSupported,
  addAlarmTriggerListener,
  addAlarmStoppedListener,
  setNativeAlarmSettings,
  isNativeAlarmScheduled,
} from '../utils/nativeAlarm';

const AppContext = createContext(null);

const initialState = {
  reminders: [],
  settings: defaultSettings(),
  activeReminder: null,
  loading: true,
};

/** One-time reminders whose last ring is over are shown as paused, not "active". */
function expireFinishedOnce(reminders, now = Date.now()) {
  let changed = false;
  const next = reminders.map(r => {
    if (r.active && r.repeatType === 'once' && onceFinishedAt(r) < now - 30 * 1000) {
      changed = true;
      return { ...r, active: false };
    }
    return r;
  });
  return changed ? next : reminders;
}

function reducer(state, action) {
  switch (action.type) {
    case 'HYDRATE':
      return { ...state, ...action.payload, loading: false };
    case 'ADD_REMINDER':
      return { ...state, reminders: [action.payload, ...state.reminders] };
    case 'UPDATE_REMINDER':
      return {
        ...state,
        reminders: state.reminders.map(r => (r.id === action.payload.id ? { ...r, ...action.payload } : r)),
      };
    case 'DELETE_REMINDER':
      return { ...state, reminders: state.reminders.filter(r => r.id !== action.payload) };
    case 'PAUSE_ALL':
      return { ...state, reminders: state.reminders.map(r => ({ ...r, active: false })) };
    case 'EXPIRE_ONCE': {
      const reminders = expireFinishedOnce(state.reminders);
      return reminders === state.reminders ? state : { ...state, reminders };
    }
    case 'UPDATE_SETTINGS':
      return { ...state, settings: { ...state.settings, ...action.payload } };
    case 'SET_ACTIVE_REMINDER':
      return { ...state, activeReminder: action.payload };
    case 'CLEAR_ACTIVE_IF':
      return state.activeReminder?.id === action.payload ? { ...state, activeReminder: null } : state;
    default:
      return state;
  }
}

/**
 * Re-register active reminders Android no longer knows about (app restored on a new phone,
 * reinstalled, or force-stopped). Reminders that are already pending are left untouched.
 */
async function resyncAlarms(reminders) {
  if (!isNativeAlarmSupported) return;
  const now = Date.now();
  for (const r of reminders) {
    if (!r.active || !nextOccurrence(r, now)) continue;
    if (r.repeatType === 'once' && r.scheduledTime <= now + 5000) continue;
    if (!(await isNativeAlarmScheduled(r.id))) {
      await scheduleReminder(r);
    }
  }
}

export function AppProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, initialState);
  const stateRef = useRef(state);
  stateRef.current = state;

  // Load saved data, and pick up an alarm that is ringing right now (app opened from it)
  useEffect(() => {
    (async () => {
      const [reminders, settings] = await Promise.all([loadReminders(), loadSettings()]);
      let activeReminder = null;
      const ringing = await getTriggeredAlarm();
      if (ringing?.id) {
        const r = reminders.find(x => x.id === ringing.id);
        if (r) activeReminder = { ...r, ...ringing };
      }
      const hydrated = expireFinishedOnce(reminders);
      dispatch({
        type: 'HYDRATE',
        payload: { reminders: hydrated, settings, activeReminder },
      });
      resyncAlarms(hydrated);
    })();
  }, []);

  // Alarm events from the native engine
  useEffect(() => {
    const showReminder = (id, extra = {}) => {
      const reminder = stateRef.current.reminders.find(r => r.id === id);
      dispatch({ type: 'SET_ACTIVE_REMINDER', payload: { ...(reminder || {}), id, ...extra } });
    };

    const nativeTriggered = addAlarmTriggerListener(({ id, text, burstIndex, burstCount }) => {
      if (!id) return;
      showReminder(id, {
        text: text || undefined,
        burstIndex: burstIndex ?? 0,
        repeatCount: burstCount ?? 0,
      });
    });
    const nativeStopped = addAlarmStoppedListener(({ id }) => {
      if (id) dispatch({ type: 'CLEAR_ACTIVE_IF', payload: id });
      dispatch({ type: 'EXPIRE_ONCE' });
    });

    const appState = AppState.addEventListener('change', s => {
      if (s === 'active') dispatch({ type: 'EXPIRE_ONCE' });
    });

    return () => {
      nativeTriggered.remove();
      nativeStopped.remove();
      appState.remove();
    };
  }, []);

  useEffect(() => {
    if (!state.loading) saveReminders(state.reminders);
  }, [state.reminders, state.loading]);

  useEffect(() => {
    if (state.loading) return;
    saveSettings(state.settings);
    setNativeAlarmSettings(state.settings);
  }, [state.settings, state.loading]);

  const addReminder = useCallback(async (reminder) => {
    dispatch({ type: 'ADD_REMINDER', payload: reminder });
    if (reminder.active) await scheduleReminder(reminder);
  }, []);

  const updateReminder = useCallback(async (reminder) => {
    dispatch({ type: 'UPDATE_REMINDER', payload: reminder });
    await cancelReminder(reminder.id);
    if (reminder.active) await scheduleReminder(reminder);
  }, []);

  const deleteReminder = useCallback(async (id) => {
    dispatch({ type: 'DELETE_REMINDER', payload: id });
    await cancelReminder(id);
  }, []);

  const setReminderActive = useCallback(async (id, active) => {
    const reminder = stateRef.current.reminders.find(r => r.id === id);
    if (!reminder) return;
    dispatch({ type: 'UPDATE_REMINDER', payload: { id, active } });
    if (active) await scheduleReminder({ ...reminder, active: true });
    else await cancelReminder(id);
  }, []);

  const pauseAll = useCallback(async () => {
    dispatch({ type: 'PAUSE_ALL' });
    await cancelAllReminders();
  }, []);

  // ---- Answering a ringing reminder (same meaning everywhere) ----

  /** Done: stop, cancel remaining rings, next scheduled date stays. */
  const dismissReminder = useCallback(async (reminder) => {
    dispatch({ type: 'SET_ACTIVE_REMINDER', payload: null });
    if (reminder?.repeatType === 'once') {
      dispatch({ type: 'UPDATE_REMINDER', payload: { id: reminder.id, active: false } });
    }
    await dismissNativeAlarm(reminder.id);
  }, []);

  /** Snooze: ring once more after the snooze length. */
  const snoozeReminder = useCallback(async (reminder) => {
    dispatch({ type: 'SET_ACTIVE_REMINDER', payload: null });
    await snoozeNativeAlarm(reminder.id, stateRef.current.settings.snoozeMinutes || 5);
  }, []);

  /** Dismiss: stop this ring only; remaining rings / next date stay. */
  const ignoreReminder = useCallback(async () => {
    dispatch({ type: 'SET_ACTIVE_REMINDER', payload: null });
    await stopNativeAlarm();
  }, []);

  const updateSettings = useCallback((patch) => {
    dispatch({ type: 'UPDATE_SETTINGS', payload: patch });
  }, []);

  return (
    <AppContext.Provider value={{
      state, addReminder, updateReminder, deleteReminder, setReminderActive, pauseAll,
      updateSettings, ignoreReminder, dismissReminder, snoozeReminder,
    }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  return useContext(AppContext);
}
