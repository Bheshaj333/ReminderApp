package com.bheshaj.ReminderApp

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Build
import android.util.Log
import androidx.core.app.NotificationCompat

/**
 * Builds the pieces shared by the ringing notification, the lingering "pending" notification
 * and the lock-screen AlarmActivity: action buttons (Done / Snooze / Dismiss) and the UI intent.
 */
object AlarmNotifier {
    private const val TAG = "AlarmNotifier"
    private const val PENDING_CHANNEL_ID = "reminder_pending_channel"

    private val immutableUpdateFlags: Int
        get() = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        } else {
            PendingIntent.FLAG_UPDATE_CURRENT
        }

    fun actionIntent(context: Context, action: String, id: String): PendingIntent {
        val intent = Intent(context, AlarmReceiver::class.java).apply {
            this.action = action
            putExtra(AlarmReceiver.EXTRA_ALARM_ID, id)
        }
        return PendingIntent.getBroadcast(context, (id + "_" + action).hashCode(), intent, immutableUpdateFlags)
    }

    fun alarmScreenIntent(
        context: Context,
        id: String,
        text: String,
        burstIndex: Int,
        burstCount: Int,
        burstInterval: Int
    ): PendingIntent {
        val intent = alarmScreenLaunchIntent(context, id, text, burstIndex, burstCount, burstInterval)
        return PendingIntent.getActivity(context, (id + "_ui").hashCode(), intent, immutableUpdateFlags)
    }

    fun alarmScreenLaunchIntent(
        context: Context,
        id: String,
        text: String,
        burstIndex: Int,
        burstCount: Int,
        burstInterval: Int
    ): Intent {
        return Intent(context, AlarmActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_NO_USER_ACTION
            putExtra(AlarmReceiver.EXTRA_ALARM_ID, id)
            putExtra(AlarmReceiver.EXTRA_ALARM_TEXT, text)
            putExtra(AlarmReceiver.EXTRA_BURST_INDEX, burstIndex)
            putExtra(AlarmReceiver.EXTRA_BURST_COUNT, burstCount)
            putExtra(AlarmReceiver.EXTRA_BURST_INTERVAL, burstInterval)
        }
    }

    fun addActions(builder: NotificationCompat.Builder, context: Context, id: String): NotificationCompat.Builder {
        return builder
            .addAction(0, "Done", actionIntent(context, AlarmReceiver.ACTION_DONE, id))
            .addAction(0, "Snooze ${AlarmSettings.get(context).snoozeMinutes}m", actionIntent(context, AlarmReceiver.ACTION_SNOOZE, id))
            .addAction(0, "Dismiss", actionIntent(context, AlarmReceiver.ACTION_DISMISS, id))
    }

    private fun pendingNotificationId(id: String) = ("pending_" + id).hashCode()

    /**
     * Silent notification left in the shade after the alarm finished speaking without the user
     * choosing an option, so Done / Snooze / Dismiss stay reachable.
     */
    fun showPending(context: Context, id: String, text: String, burstIndex: Int, burstCount: Int, burstInterval: Int) {
        try {
            val nm = context.getSystemService(Context.NOTIFICATION_SERVICE) as? NotificationManager ?: return
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                val channel = NotificationChannel(
                    PENDING_CHANNEL_ID,
                    "Unanswered Reminders",
                    NotificationManager.IMPORTANCE_DEFAULT
                ).apply {
                    description = "Reminders that rang without a response"
                    setSound(null, null)
                    enableVibration(false)
                }
                nm.createNotificationChannel(channel)
            }

            val builder = NotificationCompat.Builder(context, PENDING_CHANNEL_ID)
                .setSmallIcon(R.drawable.ic_stat_reminder)
                .setColor(0xFF78BDAF.toInt())
                .setContentTitle("Reminder")
                .setContentText(text)
                .setStyle(NotificationCompat.BigTextStyle().bigText(text))
                .setCategory(NotificationCompat.CATEGORY_REMINDER)
                .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
                .setSilent(true)
                .setOnlyAlertOnce(true)
                .setAutoCancel(true)
                .setContentIntent(alarmScreenIntent(context, id, text, burstIndex, burstCount, burstInterval))
            addActions(builder, context, id)
            nm.notify(pendingNotificationId(id), builder.build())
        } catch (e: Exception) {
            Log.e(TAG, "Failed to post pending notification", e)
        }
    }

    fun cancelPending(context: Context, id: String) {
        val nm = context.getSystemService(Context.NOTIFICATION_SERVICE) as? NotificationManager ?: return
        nm.cancel(pendingNotificationId(id))
    }
}
