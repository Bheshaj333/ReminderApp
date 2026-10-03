package com.bheshaj.ReminderApp

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.os.PowerManager
import android.util.Log
import androidx.core.content.ContextCompat

class AlarmReceiver : BroadcastReceiver() {
    companion object {
        const val TAG = "AlarmReceiver"
        const val ACTION_TRIGGER_ALARM = "com.bheshaj.ReminderApp.ALARM_TRIGGER"
        const val ACTION_DONE = "com.bheshaj.ReminderApp.ACTION_DONE"
        const val ACTION_DISMISS = "com.bheshaj.ReminderApp.ACTION_DISMISS"
        const val ACTION_SNOOZE = "com.bheshaj.ReminderApp.ACTION_SNOOZE"

        const val EXTRA_ALARM_ID = "extra_alarm_id"
        const val EXTRA_ALARM_TEXT = "extra_alarm_text"
        const val EXTRA_BURST_INDEX = "extra_burst_index"
        const val EXTRA_BURST_COUNT = "extra_burst_count"
        const val EXTRA_BURST_INTERVAL = "extra_burst_interval"
        const val EXTRA_VOICE_STYLE = "extra_voice_style"
        const val EXTRA_ESCALATION = "extra_escalation"
        const val EXTRA_IS_SNOOZE = "extra_is_snooze"

        private var wakeLock: PowerManager.WakeLock? = null

        @Synchronized
        fun acquireWakeLock(context: Context) {
            if (wakeLock == null) {
                val powerManager = context.getSystemService(Context.POWER_SERVICE) as PowerManager
                wakeLock = powerManager.newWakeLock(
                    PowerManager.PARTIAL_WAKE_LOCK,
                    "ReminderApp:AlarmWakeLock"
                ).apply {
                    setReferenceCounted(false)
                }
            }
            wakeLock?.acquire(3 * 60 * 1000L) // 3 minutes timeout safety
        }

        /**
         * Single place that applies the user's choice from any surface (notification button,
         * lock-screen AlarmActivity, or the React Native UI).
         *  - Done:    stop now, cancel remaining bursts + snooze, queue next cycle if repeating
         *  - Snooze:  stop now, cancel remaining bursts, ring once more in [snoozeMinutes] (user setting)
         *  - Dismiss: stop now only; remaining bursts / next cycle stay scheduled
         */
        fun handleUserAction(context: Context, action: String, id: String, snoozeMinutes: Int = AlarmSettings.get(context).snoozeMinutes) {
            context.stopService(Intent(context, AlarmService::class.java))
            releaseWakeLock()
            if (id.isEmpty()) return

            AlarmNotifier.cancelPending(context, id)
            AlarmActivity.closeFor(id)

            when (action) {
                ACTION_DONE -> AlarmScheduler.dismissOccurrence(context, id)
                ACTION_SNOOZE -> AlarmScheduler.snoozeAlarm(context, id, snoozeMinutes)
                ACTION_DISMISS -> Log.d(TAG, "Dismissed current ring of $id; remaining schedule kept")
            }
        }

        @Synchronized
        fun releaseWakeLock() {
            try {
                if (wakeLock?.isHeld == true) {
                    wakeLock?.release()
                }
            } catch (e: Exception) {
                Log.e(TAG, "Error releasing wake lock", e)
            }
        }
    }

    override fun onReceive(context: Context, intent: Intent) {
        val action = intent.action
        Log.d(TAG, "Received broadcast action: $action")

        when (action) {
            ACTION_TRIGGER_ALARM -> {
                acquireWakeLock(context)

                val id = intent.getStringExtra(EXTRA_ALARM_ID) ?: ""
                val burstIndex = intent.getIntExtra(EXTRA_BURST_INDEX, 0)
                val burstCount = intent.getIntExtra(EXTRA_BURST_COUNT, 0)

                // AlarmService emits onAlarmTriggered to React Native once it is running

                val serviceIntent = Intent(context, AlarmService::class.java).apply {
                    putExtras(intent)
                }

                try {
                    ContextCompat.startForegroundService(context, serviceIntent)
                    Log.d(TAG, "Started AlarmService in foreground")
                } catch (e: Exception) {
                    Log.e(TAG, "Failed to start AlarmService", e)
                    releaseWakeLock()
                }

                // If this is the last burst (or only ring) of a repeating reminder, schedule the next cycle
                if (burstIndex >= burstCount && id.isNotEmpty()) {
                    val alarmObj = AlarmStorage.getAlarm(context, id)
                    if (alarmObj != null) {
                        val repeatType = alarmObj.optString("repeatType", "once")
                        if (repeatType != "once") {
                            AlarmScheduler.scheduleAlarm(context, alarmObj, isCreation = false)
                        }
                    }
                }
            }

            ACTION_DONE, ACTION_SNOOZE, ACTION_DISMISS -> {
                val id = intent.getStringExtra(EXTRA_ALARM_ID) ?: ""
                Log.d(TAG, "User action $action for alarm $id")
                handleUserAction(context, action!!, id)
            }

            Intent.ACTION_BOOT_COMPLETED,
            Intent.ACTION_LOCKED_BOOT_COMPLETED,
            Intent.ACTION_MY_PACKAGE_REPLACED,
            Intent.ACTION_TIMEZONE_CHANGED,
            Intent.ACTION_TIME_CHANGED,
            Intent.ACTION_DATE_CHANGED,
            "android.intent.action.QUICKBOOT_POWERON",
            "com.htc.intent.action.QUICKBOOT_POWERON" -> {
                Log.d(TAG, "Device rebooted, package replaced, or time/timezone changed. Rescheduling alarms...")
                AlarmScheduler.rescheduleAllAlarms(context)
            }
        }
    }
}
