// Mirror of AlarmScheduler.computeNextTriggerTime (Kotlin) used for display only.
// Keep the two in sync: the native side is what actually rings.

const MIN = 60 * 1000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

export const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']; // index = daysOfWeek value - 1

function atTimeOf(base, source) {
  const d = new Date(base);
  d.setHours(source.getHours(), source.getMinutes(), 0, 0);
  return d;
}

function weekStart(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - d.getDay());
  return d.getTime();
}

function addUnits(start, unit, n) {
  const d = new Date(start);
  if (unit === 'months' || unit === 'years') {
    // Clamp to month end like java.util.Calendar (Jan 31 + 1 month = Feb 28, not Mar 3)
    const day = d.getDate();
    d.setDate(1);
    if (unit === 'months') d.setMonth(d.getMonth() + n);
    else d.setFullYear(d.getFullYear() + n);
    const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
    d.setDate(Math.min(day, lastDay));
    return d;
  }
  else if (unit === 'weeks') d.setDate(d.getDate() + 7 * n);
  else d.setDate(d.getDate() + n);
  return d;
}

/** Next time the reminder rings (ms), strictly after `now`, or null if never again. */
export function nextOccurrence(r, now = Date.now()) {
  if (!r) return null;
  const scheduled = r.scheduledTime || now;

  if (r.repeatType === 'once') return scheduled > now ? scheduled : null;

  const start = new Date(scheduled);
  start.setSeconds(0, 0);

  if (r.repeatType === 'daily' || r.repeatType === 'weekend') {
    const next = atTimeOf(now, start);
    const isWeekend = d => d.getDay() === 0 || d.getDay() === 6;
    while (next.getTime() <= now || (r.repeatType === 'weekend' && !isWeekend(next))) {
      next.setDate(next.getDate() + 1);
    }
    return next.getTime();
  }

  // custom
  const interval = Math.max(1, Number(r.repeatInterval) || 1);
  const unit = r.repeatUnit || 'hours';
  const days = r.daysOfWeek || [];

  if (unit === 'minutes' || unit === 'hours') {
    if (start.getTime() > now) return start.getTime();
    const step = interval * (unit === 'minutes' ? MIN : HOUR);
    const steps = Math.floor((now - start.getTime()) / step) + 1;
    return start.getTime() + steps * step;
  }

  if (unit === 'weeks' && days.length > 0) {
    const startWeek = weekStart(start);
    const cand = atTimeOf(Math.max(start.getTime(), now), start);
    for (let i = 0; i < 7 * interval + 14; i++) {
      const weeksFromStart = Math.round((weekStart(cand) - startWeek) / (7 * DAY));
      if (cand.getTime() > now && cand.getTime() >= start.getTime() &&
          days.includes(cand.getDay() + 1) && weeksFromStart % interval === 0) {
        return cand.getTime();
      }
      cand.setDate(cand.getDate() + 1);
    }
    return null;
  }

  if (start.getTime() > now) return start.getTime();

  const maxStep = { days: 25 * HOUR, weeks: 7 * 25 * HOUR, months: 31 * DAY, years: 366 * DAY }[unit] || 25 * HOUR;
  let n = Math.floor((now - start.getTime()) / (maxStep * interval));
  for (;;) {
    const c = addUnits(start, unit, n * interval);
    if (c.getTime() > now) return c.getTime();
    n++;
  }
}

/** When the last ring (including bursts) of a one-time reminder is over. */
export function onceFinishedAt(r) {
  const count = Number(r.repeatCount) || 0;
  const gap = Math.max(1, Number(r.burstInterval) || 1);
  return (r.scheduledTime || 0) + count * gap * MIN;
}

function plural(n, word) {
  return `${n} ${word}${n === 1 ? '' : 's'}`;
}

export function describeRepeat(r) {
  switch (r.repeatType) {
    case 'once': return 'One time';
    case 'daily': return 'Every day';
    case 'weekend': return 'Weekends';
    case 'custom': {
      const interval = Math.max(1, Number(r.repeatInterval) || 1);
      const unit = (r.repeatUnit || 'hours').replace(/s$/, '');
      let text = interval === 1 ? `Every ${unit}` : `Every ${plural(interval, unit)}`;
      if (r.repeatUnit === 'weeks' && r.daysOfWeek?.length) {
        text += ' on ' + r.daysOfWeek.map(d => DAY_LABELS[d - 1]).join(', ');
      }
      return text;
    }
    default: return 'One time';
  }
}

export function describeBurst(r) {
  const count = Number(r.repeatCount) || 0;
  if (count <= 0) return null;
  const gap = Math.max(1, Number(r.burstInterval) || 1);
  return `Rings ${count + 1}× · ${gap} min apart`;
}

export function formatTime(ts) {
  return new Date(ts).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

/** "Today 9:00 AM", "Tomorrow 9:00 AM", "Mon 9:00 AM", "12 Oct, 9:00 AM", "12 Oct 2027" */
export function formatWhen(ts, now = Date.now()) {
  const d = new Date(ts);
  const today = new Date(now); today.setHours(0, 0, 0, 0);
  const dayDiff = Math.round((new Date(d).setHours(0, 0, 0, 0) - today.getTime()) / DAY);
  const time = formatTime(ts);
  if (dayDiff === 0) return `Today ${time}`;
  if (dayDiff === 1) return `Tomorrow ${time}`;
  if (dayDiff > 1 && dayDiff < 7) return `${DAY_LABELS[d.getDay()]} ${time}`;
  const sameYear = d.getFullYear() === today.getFullYear();
  const date = d.toLocaleDateString([], { day: 'numeric', month: 'short', ...(sameYear ? {} : { year: 'numeric' }) });
  return sameYear ? `${date}, ${time}` : date;
}

/** "Today", "Tomorrow", "Mon", "12 Oct" */
export function formatDay(ts, now = Date.now()) {
  const d = new Date(ts);
  const today = new Date(now); today.setHours(0, 0, 0, 0);
  const dayDiff = Math.round((new Date(d).setHours(0, 0, 0, 0) - today.getTime()) / DAY);
  if (dayDiff === 0) return 'Today';
  if (dayDiff === 1) return 'Tomorrow';
  if (dayDiff > 1 && dayDiff < 7) return DAY_LABELS[d.getDay()];
  return d.toLocaleDateString([], { day: 'numeric', month: 'short' });
}

/** "in 5 min", "in 2 h 15 min", "in 3 days" */
export function formatCountdown(ts, now = Date.now()) {
  const diff = Math.max(0, ts - now);
  if (diff < MIN) return 'in less than a minute';
  if (diff < HOUR) return `in ${Math.round(diff / MIN)} min`;
  if (diff < DAY) {
    const h = Math.floor(diff / HOUR);
    const m = Math.round((diff % HOUR) / MIN);
    return m ? `in ${h} h ${m} min` : `in ${h} h`;
  }
  const days = Math.round(diff / DAY);
  return `in ${plural(days, 'day')}`;
}
