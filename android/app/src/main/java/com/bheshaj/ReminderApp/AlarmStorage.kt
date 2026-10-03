package com.bheshaj.ReminderApp

import android.content.Context
import android.content.SharedPreferences
import org.json.JSONArray
import org.json.JSONObject

object AlarmStorage {
    private const val PREFS_NAME = "ReminderApp_Alarms"
    private const val KEY_ALARMS = "active_alarms"

    private fun getPrefs(context: Context): SharedPreferences {
        return context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
    }

    @Synchronized
    fun saveAlarm(context: Context, alarm: JSONObject) {
        val alarms = getAllAlarms(context)
        val id = alarm.optString("id")
        val updated = mutableListOf<JSONObject>()
        
        for (a in alarms) {
            if (a.optString("id") != id) {
                updated.add(a)
            }
        }
        updated.add(alarm)
        saveAllAlarms(context, updated)
    }

    @Synchronized
    fun getAlarm(context: Context, id: String): JSONObject? {
        val alarms = getAllAlarms(context)
        return alarms.find { it.optString("id") == id }
    }

    @Synchronized
    fun removeAlarm(context: Context, id: String) {
        val alarms = getAllAlarms(context)
        val updated = alarms.filter { it.optString("id") != id }
        saveAllAlarms(context, updated)
    }

    @Synchronized
    fun getAllAlarms(context: Context): List<JSONObject> {
        val jsonStr = getPrefs(context).getString(KEY_ALARMS, null) ?: return emptyList()
        val list = mutableListOf<JSONObject>()
        try {
            val jsonArray = JSONArray(jsonStr)
            for (i in 0 until jsonArray.length()) {
                list.add(jsonArray.getJSONObject(i))
            }
        } catch (e: Exception) {
            e.printStackTrace()
        }
        return list
    }

    @Synchronized
    fun clearAll(context: Context) {
        getPrefs(context).edit().remove(KEY_ALARMS).apply()
    }

    private fun saveAllAlarms(context: Context, alarms: List<JSONObject>) {
        val jsonArray = JSONArray()
        for (a in alarms) {
            jsonArray.put(a)
        }
        getPrefs(context).edit().putString(KEY_ALARMS, jsonArray.toString()).apply()
    }
}
