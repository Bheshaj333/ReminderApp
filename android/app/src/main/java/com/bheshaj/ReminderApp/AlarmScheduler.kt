package com.bheshaj.ReminderApp

import android.app.AlarmManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Build
import android.util.Log
import org.json.JSONObject
import java.util.Calendar

object AlarmScheduler {
    private const val TAG = "AlarmScheduler"

    fun scheduleAlarm(context: Context, alarm: JSONObject, isCreation: Boolean = false) {
        val id = alarm.optString("id")
        val text = alarm.optString("text")
        val burstCount = alarm.optInt("repeatCount", 0) // Default 0 extra repeats
        val burstInterval = alarm.optInt("burstInterval", 0) // minutes
        val voiceStyle = alarm.optString("voiceStyle", "default")
        val escalation = alarm.optBoolean("escalation", true)

        if (id.isEmpty() || text.isEmpty()) {
            Log.e(TAG, "Cannot schedule alarm with missing ID or text")
            return
        }

        // Cancel previous instances of this alarm
        cancelBurstsOnly(context, id)

        // Save to native storage
        AlarmStorage.saveAlarm(context, alarm)

        val triggerTime = computeNextTriggerTime(alarm, isCreation)
        if (triggerTime <= 0) {
            Log.d(TAG, "Trigger time has passed for one-time reminder $id, skipping scheduling")
            return
        }

        // Schedule primary exact alarm (burstIndex = 0)
        scheduleExactAlarm(context, id, text, triggerTime, 0, burstCount, burstInterval, voiceStyle, escalation)

        // If repeatCount > 0, schedule burst repeats (burstIndex = 1..burstCount)
        if (burstCount > 0) {
            val intervalMinutes = if (burstInterval > 0) burstInterval else 1
            for (burstIdx in 1..burstCount) {
                val burstTime = triggerTime + (burstIdx * intervalMinutes * 60 * 1000L)
                scheduleExactAlarm(context, id, text, burstTime, burstIdx, burstCount, intervalMinutes, voiceStyle, escalation)
            }
        }
    }

    fun scheduleExactAlarm(
        context: Context,
        id: String,
        text: String,
        triggerTimeMillis: Long,
        burstIndex: Int,
        burstCount: Int,
        burstIntervalMinutes: Int,
        voiceStyle: String,
        escalation: Boolean
    ) {
        val alarmManager = context.getSystemService(Context.ALARM_SERVICE) as? AlarmManager ?: return

        val intent = Intent(context, AlarmReceiver::class.java).apply {
            action = AlarmReceiver.ACTION_TRIGGER_ALARM
            putExtra(AlarmReceiver.EXTRA_ALARM_ID, id)
            putExtra(AlarmReceiver.EXTRA_ALARM_TEXT, text)
            putExtra(AlarmReceiver.EXTRA_BURST_INDEX, burstIndex)
            putExtra(AlarmReceiver.EXTRA_BURST_COUNT, burstCount)
            putExtra(AlarmReceiver.EXTRA_BURST_INTERVAL, burstIntervalMinutes)
            putExtra(AlarmReceiver.EXTRA_VOICE_STYLE, voiceStyle)
            putExtra(AlarmReceiver.EXTRA_ESCALATION, escalation)
        }

        val requestCode = (id + "_" + burstIndex).hashCode()
        val flags = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        } else {
            PendingIntent.FLAG_UPDATE_CURRENT
        }

        val pendingIntent = PendingIntent.getBroadcast(context, requestCode, intent, flags)

        val showIntent = Intent(context, MainActivity::class.java).apply {
            setFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP)
            putExtra("reminderId", id)
            putExtra("alarmText", text)
        }
        val showPendingIntent = PendingIntent.getActivity(
            context,
            requestCode,
            showIntent,
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE else PendingIntent.FLAG_UPDATE_CURRENT
        )

        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
                val alarmClockInfo = AlarmManager.AlarmClockInfo(triggerTimeMillis, showPendingIntent)
                alarmManager.setAlarmClock(alarmClockInfo, pendingIntent)
                Log.d(TAG, "Scheduled AlarmClock for $id at $triggerTimeMillis (burst: $burstIndex/$burstCount)")
            } else if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                alarmManager.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, triggerTimeMillis, pendingIntent)
                Log.d(TAG, "Scheduled ExactAndAllowWhileIdle for $id at $triggerTimeMillis (burst: $burstIndex/$burstCount)")
            } else {
                alarmManager.setExact(AlarmManager.RTC_WAKEUP, triggerTimeMillis, pendingIntent)
                Log.d(TAG, "Scheduled Exact for $id at $triggerTimeMillis (burst: $burstIndex/$burstCount)")
            }
        } catch (e: SecurityException) {
            Log.e(TAG, "Exact alarm permission missing or revoked on Android 12+", e)
            try {
                alarmManager.set(AlarmManager.RTC_WAKEUP, triggerTimeMillis, pendingIntent)
            } catch (ex: Exception) {
                Log.e(TAG, "Failed fallback alarm scheduling", ex)
            }
        }
    }

    fun cancelBurstsOnly(context: Context, id: String) {
        val alarmManager = context.getSystemService(Context.ALARM_SERVICE) as? AlarmManager ?: return
        val flags = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            PendingIntent.FLAG_NO_CREATE or PendingIntent.FLAG_IMMUTABLE
        } else {
            PendingIntent.FLAG_NO_CREATE
        }

        // Cancel primary and burst instances
        for (burstIdx in 0..10) {
            val intent = Intent(context, AlarmReceiver::class.java).apply {
                action = AlarmReceiver.ACTION_TRIGGER_ALARM
            }
            val requestCode = (id + "_" + burstIdx).hashCode()
            val pendingIntent = PendingIntent.getBroadcast(context, requestCode, intent, flags)
            if (pendingIntent != null) {
                alarmManager.cancel(pendingIntent)
                pendingIntent.cancel()
            }
        }
    }

    /**
     * User marked the current occurrence as done: drop its remaining bursts and any pending
     * snooze, then queue the next cycle for repeating reminders (or forget one-time ones).
     */
    fun dismissOccurrence(context: Context, id: String) {
        val alarmObj = AlarmStorage.getAlarm(context, id)
        cancelBurstsOnly(context, id)
        cancelSnooze(context, id)
        if (alarmObj == null) return
        if (alarmObj.optString("repeatType", "once") != "once") {
            scheduleAlarm(context, alarmObj, isCreation = false)
        } else {
            AlarmStorage.removeAlarm(context, id)
        }
    }

    private fun cancelSnooze(context: Context, id: String) {
        val alarmManager = context.getSystemService(Context.ALARM_SERVICE) as? AlarmManager ?: return
        val flags = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            PendingIntent.FLAG_NO_CREATE or PendingIntent.FLAG_IMMUTABLE
        } else {
            PendingIntent.FLAG_NO_CREATE
        }
        val snoozeIntent = Intent(context, AlarmReceiver::class.java).apply {
            action = AlarmReceiver.ACTION_TRIGGER_ALARM
        }
        val snoozePendingIntent = PendingIntent.getBroadcast(context, (id + "_snooze").hashCode(), snoozeIntent, flags)
        if (snoozePendingIntent != null) {
            alarmManager.cancel(snoozePendingIntent)
            snoozePendingIntent.cancel()
        }
    }

    fun cancelAlarm(context: Context, id: String) {
        cancelBurstsOnly(context, id)
        cancelSnooze(context, id)
        AlarmStorage.removeAlarm(context, id)
        Log.d(TAG, "Cancelled alarm $id")
    }

    fun cancelAll(context: Context) {
        val allAlarms = AlarmStorage.getAllAlarms(context)
        for (a in allAlarms) {
            val id = a.optString("id")
            if (id.isNotEmpty()) {
                cancelAlarm(context, id)
            }
        }
        AlarmStorage.clearAll(context)
    }

    fun rescheduleAllAlarms(context: Context) {
        Log.d(TAG, "Rescheduling all stored alarms on boot/package update")
        val allAlarms = AlarmStorage.getAllAlarms(context)
        for (alarm in allAlarms) {
            val active = alarm.optBoolean("active", true)
            if (active) {
                scheduleAlarm(context, alarm)
            }
        }
    }

    fun snoozeAlarm(context: Context, id: String, snoozeMinutes: Int = 5) {
        val alarm = AlarmStorage.getAlarm(context, id)
        val text = alarm?.optString("text") ?: "Reminder"
        val voiceStyle = alarm?.optString("voiceStyle", "default") ?: "default"
        val escalation = alarm?.optBoolean("escalation", true) ?: true

        // Cancel current bursts so snooze is sole pending alarm
        cancelBurstsOnly(context, id)

        val minutes = if (snoozeMinutes > 0) snoozeMinutes else 5
        val snoozeTime = System.currentTimeMillis() + (minutes * 60 * 1000L)
        val alarmManager = context.getSystemService(Context.ALARM_SERVICE) as? AlarmManager ?: return

        val intent = Intent(context, AlarmReceiver::class.java).apply {
            action = AlarmReceiver.ACTION_TRIGGER_ALARM
            putExtra(AlarmReceiver.EXTRA_ALARM_ID, id)
            putExtra(AlarmReceiver.EXTRA_ALARM_TEXT, text)
            putExtra(AlarmReceiver.EXTRA_BURST_INDEX, 0)
            putExtra(AlarmReceiver.EXTRA_BURST_COUNT, 0)
            putExtra(AlarmReceiver.EXTRA_BURST_INTERVAL, 0)
            putExtra(AlarmReceiver.EXTRA_VOICE_STYLE, voiceStyle)
            putExtra(AlarmReceiver.EXTRA_ESCALATION, escalation)
            putExtra(AlarmReceiver.EXTRA_IS_SNOOZE, true)
        }

        val requestCode = (id + "_snooze").hashCode()
        val flags = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        } else {
            PendingIntent.FLAG_UPDATE_CURRENT
        }

        val pendingIntent = PendingIntent.getBroadcast(context, requestCode, intent, flags)

        val showIntent = Intent(context, MainActivity::class.java).apply {
            setFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP)
            putExtra("reminderId", id)
            putExtra("alarmText", text)
        }
        val showPendingIntent = PendingIntent.getActivity(
            context,
            requestCode,
            showIntent,
            flags
        )

        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
                alarmManager.setAlarmClock(AlarmManager.AlarmClockInfo(snoozeTime, showPendingIntent), pendingIntent)
            } else if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                alarmManager.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, snoozeTime, pendingIntent)
            } else {
                alarmManager.setExact(AlarmManager.RTC_WAKEUP, snoozeTime, pendingIntent)
            }
            Log.d(TAG, "Snoozed alarm $id for $minutes minutes")
        } catch (e: Exception) {
            Log.e(TAG, "Failed to schedule snooze", e)
        }
    }

    /**
     * Next time this reminder should ring (strictly after now), or -1 if it never will again.
     * Mirrored in JS by src/utils/schedule.js for display - keep the two in sync.
     */
    fun computeNextTriggerTime(alarm: JSONObject, isCreation: Boolean = false): Long {
        val now = System.currentTimeMillis()
        val scheduledTime = alarm.optLong("scheduledTime", 0L)
        val repeatType = alarm.optString("repeatType", "once")

        if (repeatType == "once") {
            return when {
                scheduledTime > now -> scheduledTime
                // Just created with a time a few seconds in the past (e.g. "now"): ring right away
                isCreation && now - scheduledTime < 60 * 1000 -> now + 3000L
                else -> -1L
            }
        }

        val start = Calendar.getInstance().apply {
            timeInMillis = if (scheduledTime > 0) scheduledTime else now
            set(Calendar.SECOND, 0)
            set(Calendar.MILLISECOND, 0)
        }

        if (repeatType == "daily" || repeatType == "weekend") {
            val next = Calendar.getInstance().apply {
                set(Calendar.HOUR_OF_DAY, start.get(Calendar.HOUR_OF_DAY))
                set(Calendar.MINUTE, start.get(Calendar.MINUTE))
                set(Calendar.SECOND, 0)
                set(Calendar.MILLISECOND, 0)
            }
            while (next.timeInMillis <= now ||
                (repeatType == "weekend" &&
                    next.get(Calendar.DAY_OF_WEEK) != Calendar.SATURDAY &&
                    next.get(Calendar.DAY_OF_WEEK) != Calendar.SUNDAY)
            ) {
                next.add(Calendar.DAY_OF_YEAR, 1)
            }
            return next.timeInMillis
        }

        // custom: every N minutes / hours / days / weeks (optionally on chosen weekdays) / months / years
        val interval = Math.max(1, alarm.optInt("repeatInterval", 1))
        val unit = alarm.optString("repeatUnit", "hours")
        val days = mutableSetOf<Int>()
        alarm.optJSONArray("daysOfWeek")?.let { arr ->
            for (i in 0 until arr.length()) days.add(arr.optInt(i))
        }

        if (unit == "minutes" || unit == "hours") {
            if (start.timeInMillis > now) return start.timeInMillis
            val stepMs = interval * (if (unit == "minutes") 60_000L else 3_600_000L)
            val steps = (now - start.timeInMillis) / stepMs + 1
            return start.timeInMillis + steps * stepMs
        }

        if (unit == "weeks" && days.isNotEmpty()) {
            // Ring on each chosen weekday, in weeks that are a multiple of `interval` from the start week
            val startWeek = weekStart(start)
            val cand = Calendar.getInstance().apply {
                timeInMillis = Math.max(start.timeInMillis, now)
                set(Calendar.HOUR_OF_DAY, start.get(Calendar.HOUR_OF_DAY))
                set(Calendar.MINUTE, start.get(Calendar.MINUTE))
                set(Calendar.SECOND, 0)
                set(Calendar.MILLISECOND, 0)
            }
            repeat(7 * interval + 14) {
                val weeksFromStart = Math.round((weekStart(cand) - startWeek) / (7 * 86_400_000.0)).toInt()
                if (cand.timeInMillis > now && cand.timeInMillis >= start.timeInMillis &&
                    days.contains(cand.get(Calendar.DAY_OF_WEEK)) && weeksFromStart % interval == 0
                ) {
                    return cand.timeInMillis
                }
                cand.add(Calendar.DAY_OF_YEAR, 1)
            }
            return -1L
        }

        if (start.timeInMillis > now) return start.timeInMillis

        // Calendar units: always offset from the original start so month-ends / leap days don't drift
        val (field, perStep, maxStepMs) = when (unit) {
            "days" -> Triple(Calendar.DAY_OF_YEAR, interval, 25 * 3_600_000L)
            "weeks" -> Triple(Calendar.DAY_OF_YEAR, 7 * interval, 7 * 25 * 3_600_000L)
            "months" -> Triple(Calendar.MONTH, interval, 31 * 86_400_000L)
            "years" -> Triple(Calendar.YEAR, interval, 366 * 86_400_000L)
            else -> Triple(Calendar.DAY_OF_YEAR, interval, 25 * 3_600_000L)
        }
        // Lower-bound estimate of elapsed steps (maxStepMs is the longest a single unit can be), then walk forward
        var n = ((now - start.timeInMillis) / (maxStepMs * interval)).toInt()
        while (true) {
            val c = (start.clone() as Calendar).apply { add(field, n * perStep) }
            if (c.timeInMillis > now) return c.timeInMillis
            n++
        }
    }

    private fun weekStart(c: Calendar): Long {
        val w = (c.clone() as Calendar)
        w.set(Calendar.HOUR_OF_DAY, 0)
        w.set(Calendar.MINUTE, 0)
        w.set(Calendar.SECOND, 0)
        w.set(Calendar.MILLISECOND, 0)
        w.add(Calendar.DAY_OF_YEAR, Calendar.SUNDAY - w.get(Calendar.DAY_OF_WEEK))
        return w.timeInMillis
    }
}
