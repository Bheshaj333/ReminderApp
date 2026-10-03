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

    private fun computeNextTriggerTime(alarm: JSONObject, isCreation: Boolean = false): Long {
        val now = System.currentTimeMillis()
        val scheduledTime = alarm.optLong("scheduledTime", 0L)
        val repeatType = alarm.optString("repeatType", "once")

        if (repeatType == "once") {
            return if (scheduledTime > now) {
                scheduledTime
            } else if (isCreation) {
                // If the user just created a reminder with time slightly in the past (e.g. within 60s), trigger in 3s
                if (now - scheduledTime < 60 * 1000) now + 3000L else -1L
            } else {
                -1L // Do not reschedule past one-time alarms
            }
        }

        val cal = Calendar.getInstance().apply {
            timeInMillis = if (scheduledTime > 0) scheduledTime else now
        }
        val targetHour = cal.get(Calendar.HOUR_OF_DAY)
        val targetMinute = cal.get(Calendar.MINUTE)
        val targetSecond = 0

        val nextCal = Calendar.getInstance().apply {
            set(Calendar.HOUR_OF_DAY, targetHour)
            set(Calendar.MINUTE, targetMinute)
            set(Calendar.SECOND, targetSecond)
            set(Calendar.MILLISECOND, 0)
        }

        if (repeatType == "daily") {
            if (nextCal.timeInMillis <= now) {
                nextCal.add(Calendar.DAY_OF_YEAR, 1)
            }
            return nextCal.timeInMillis
        }

        if (repeatType == "weekend") {
            while (nextCal.timeInMillis <= now ||
                   (nextCal.get(Calendar.DAY_OF_WEEK) != Calendar.SATURDAY &&
                    nextCal.get(Calendar.DAY_OF_WEEK) != Calendar.SUNDAY)) {
                nextCal.add(Calendar.DAY_OF_YEAR, 1)
            }
            return nextCal.timeInMillis
        }

        if (repeatType == "custom") {
            val repeatInterval = Math.max(1, alarm.optInt("repeatInterval", 1))
            val repeatUnit = alarm.optString("repeatUnit", "hours")
            val daysArray = alarm.optJSONArray("daysOfWeek")
            val daysList = mutableListOf<Int>()
            if (daysArray != null) {
                for (i in 0 until daysArray.length()) {
                    daysList.add(daysArray.optInt(i))
                }
            }

            val customCal = Calendar.getInstance().apply {
                timeInMillis = if (scheduledTime > 0) scheduledTime else now
            }

            // If scheduledTime is in future:
            if (customCal.timeInMillis > now) {
                if (repeatUnit == "weeks" && daysList.isNotEmpty()) {
                    while (customCal.timeInMillis <= now || !daysList.contains(customCal.get(Calendar.DAY_OF_WEEK))) {
                        customCal.add(Calendar.DAY_OF_YEAR, 1)
                    }
                }
                return customCal.timeInMillis
            }

            // scheduledTime is in the past: advance forward by repeatInterval until in the future
            when (repeatUnit) {
                "minutes" -> {
                    val stepMs = repeatInterval * 60 * 1000L
                    val diff = now - customCal.timeInMillis
                    val steps = (diff / stepMs) + 1
                    return customCal.timeInMillis + (steps * stepMs)
                }
                "hours" -> {
                    val stepMs = repeatInterval * 60 * 60 * 1000L
                    val diff = now - customCal.timeInMillis
                    val steps = (diff / stepMs) + 1
                    return customCal.timeInMillis + (steps * stepMs)
                }
                "days" -> {
                    while (customCal.timeInMillis <= now) {
                        customCal.add(Calendar.DAY_OF_YEAR, repeatInterval)
                    }
                    return customCal.timeInMillis
                }
                "weeks" -> {
                    if (daysList.isNotEmpty()) {
                        while (customCal.timeInMillis <= now || !daysList.contains(customCal.get(Calendar.DAY_OF_WEEK))) {
                            customCal.add(Calendar.DAY_OF_YEAR, 1)
                        }
                    } else {
                        while (customCal.timeInMillis <= now) {
                            customCal.add(Calendar.WEEK_OF_YEAR, repeatInterval)
                        }
                    }
                    return customCal.timeInMillis
                }
                "months" -> {
                    while (customCal.timeInMillis <= now) {
                        customCal.add(Calendar.MONTH, repeatInterval)
                    }
                    return customCal.timeInMillis
                }
                "years" -> {
                    while (customCal.timeInMillis <= now) {
                        customCal.add(Calendar.YEAR, repeatInterval)
                    }
                    return customCal.timeInMillis
                }
                else -> {
                    while (customCal.timeInMillis <= now) {
                        customCal.add(Calendar.DAY_OF_YEAR, repeatInterval)
                    }
                    return customCal.timeInMillis
                }
            }
        }

        if (nextCal.timeInMillis <= now) {
            nextCal.add(Calendar.DAY_OF_YEAR, 1)
        }
        return nextCal.timeInMillis
    }
}
