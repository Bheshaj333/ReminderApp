package com.matilabs.talkingreminder

import android.content.Context

/**
 * Global alarm preferences pushed from the React Native Voice / Settings screens.
 * Read by AlarmService at ring time, so changes apply to every existing reminder.
 */
object AlarmSettings {
    private const val PREFS_NAME = "ReminderApp_Settings"

    data class Values(
        val voiceId: String?,
        val rate: Float,
        val pitch: Float,
        val announcePrefix: Boolean,
        val vibrate: Boolean,
        val snoozeMinutes: Int
    )

    fun get(context: Context): Values {
        val p = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        return Values(
            voiceId = p.getString("voiceId", null)?.takeIf { it.isNotEmpty() },
            rate = p.getFloat("rate", 0.95f),
            pitch = p.getFloat("pitch", 1.0f),
            announcePrefix = p.getBoolean("announcePrefix", false),
            vibrate = p.getBoolean("vibrate", true),
            snoozeMinutes = p.getInt("snoozeMinutes", 5).coerceIn(1, 60)
        )
    }

    fun save(context: Context, values: Values) {
        context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE).edit()
            .putString("voiceId", values.voiceId ?: "")
            .putFloat("rate", values.rate)
            .putFloat("pitch", values.pitch)
            .putBoolean("announcePrefix", values.announcePrefix)
            .putBoolean("vibrate", values.vibrate)
            .putInt("snoozeMinutes", values.snoozeMinutes)
            .apply()
    }
}
