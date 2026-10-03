package com.bheshaj.ReminderApp

import android.app.AlarmManager
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.PowerManager
import android.provider.Settings
import android.util.Log
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.ReadableMap
import com.facebook.react.modules.core.DeviceEventManagerModule
import org.json.JSONArray
import org.json.JSONObject

class AlarmModule(private val reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {

    companion object {
        const val NAME = "AlarmModule"
        const val TAG = "AlarmModule"
        private var instance: AlarmModule? = null

        fun emitAlarmTriggered(id: String, text: String, burstIndex: Int, burstCount: Int) {
            try {
                val inst = instance ?: return
                val map = Arguments.createMap().apply {
                    putString("id", id)
                    putString("text", text)
                    putInt("burstIndex", burstIndex)
                    putInt("burstCount", burstCount)
                    putBoolean("isRunning", true)
                }
                if (inst.reactContext.hasActiveReactInstance()) {
                    inst.reactContext
                        .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
                        .emit("onAlarmTriggered", map)
                    Log.d(TAG, "Emitted onAlarmTriggered for $id (burst $burstIndex/$burstCount)")
                }
            } catch (e: Exception) {
                Log.e(TAG, "Error emitting onAlarmTriggered", e)
            }
        }

        fun emitAlarmStopped(id: String) {
            try {
                val inst = instance ?: return
                val map = Arguments.createMap().apply {
                    putString("id", id)
                }
                if (inst.reactContext.hasActiveReactInstance()) {
                    inst.reactContext
                        .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
                        .emit("onAlarmStopped", map)
                }
            } catch (e: Exception) {
                Log.e(TAG, "Error emitting onAlarmStopped", e)
            }
        }
    }

    init {
        instance = this
    }

    override fun getName(): String = NAME

    @ReactMethod
    fun addListener(eventName: String) {
        // Required for React Native NativeEventEmitter
    }

    @ReactMethod
    fun removeListeners(count: Int) {
        // Required for React Native NativeEventEmitter
    }

    @ReactMethod
    fun scheduleAlarm(alarmMap: ReadableMap, promise: Promise) {
        try {
            val jsonObject = JSONObject()
            val iterator = alarmMap.keySetIterator()
            while (iterator.hasNextKey()) {
                val key = iterator.nextKey()
                when (alarmMap.getType(key)) {
                    com.facebook.react.bridge.ReadableType.Boolean -> jsonObject.put(key, alarmMap.getBoolean(key))
                    com.facebook.react.bridge.ReadableType.Number -> jsonObject.put(key, alarmMap.getDouble(key).toLong())
                    com.facebook.react.bridge.ReadableType.String -> jsonObject.put(key, alarmMap.getString(key))
                    com.facebook.react.bridge.ReadableType.Array -> {
                        val readableArray = alarmMap.getArray(key)
                        if (readableArray != null) {
                            val jsonArray = JSONArray()
                            for (i in 0 until readableArray.size()) {
                                when (readableArray.getType(i)) {
                                    com.facebook.react.bridge.ReadableType.Number -> jsonArray.put(readableArray.getInt(i))
                                    com.facebook.react.bridge.ReadableType.String -> jsonArray.put(readableArray.getString(i))
                                    com.facebook.react.bridge.ReadableType.Boolean -> jsonArray.put(readableArray.getBoolean(i))
                                    else -> {}
                                }
                            }
                            jsonObject.put(key, jsonArray)
                        }
                    }
                    else -> {}
                }
            }

            AlarmScheduler.scheduleAlarm(reactContext, jsonObject, isCreation = true)
            promise.resolve(true)
        } catch (e: Exception) {
            Log.e(TAG, "Error scheduling alarm", e)
            promise.reject("SCHEDULE_ERROR", e.message, e)
        }
    }

    @ReactMethod
    fun cancelAlarm(id: String, promise: Promise) {
        try {
            AlarmScheduler.cancelAlarm(reactContext, id)
            promise.resolve(true)
        } catch (e: Exception) {
            Log.e(TAG, "Error canceling alarm", e)
            promise.reject("CANCEL_ERROR", e.message, e)
        }
    }

    @ReactMethod
    fun cancelAllAlarms(promise: Promise) {
        try {
            AlarmScheduler.cancelAll(reactContext)
            promise.resolve(true)
        } catch (e: Exception) {
            Log.e(TAG, "Error canceling all alarms", e)
            promise.reject("CANCEL_ALL_ERROR", e.message, e)
        }
    }

    @ReactMethod
    fun stopAlarm(promise: Promise) {
        try {
            val serviceIntent = Intent(reactContext, AlarmService::class.java).apply {
                action = AlarmService.ACTION_STOP
            }
            reactContext.stopService(serviceIntent)
            AlarmReceiver.releaseWakeLock()
            promise.resolve(true)
        } catch (e: Exception) {
            Log.e(TAG, "Error stopping alarm service", e)
            promise.reject("STOP_ERROR", e.message, e)
        }
    }

    @ReactMethod
    fun dismissAlarm(id: String, promise: Promise) {
        try {
            // Stop current ringing, drop the remaining bursts, queue the next cycle if repeating
            val serviceIntent = Intent(reactContext, AlarmService::class.java).apply {
                action = AlarmService.ACTION_STOP
            }
            reactContext.stopService(serviceIntent)
            AlarmReceiver.releaseWakeLock()

            AlarmScheduler.dismissOccurrence(reactContext, id)
            promise.resolve(true)
        } catch (e: Exception) {
            Log.e(TAG, "Error dismissing alarm", e)
            promise.reject("DISMISS_ERROR", e.message, e)
        }
    }

    @ReactMethod
    fun snoozeAlarm(id: String, minutes: Int, promise: Promise) {
        try {
            // Stop current ringing
            val serviceIntent = Intent(reactContext, AlarmService::class.java).apply {
                action = AlarmService.ACTION_STOP
            }
            reactContext.stopService(serviceIntent)
            AlarmReceiver.releaseWakeLock()

            // Schedule snooze
            AlarmScheduler.snoozeAlarm(reactContext, id, if (minutes > 0) minutes else 5)
            promise.resolve(true)
        } catch (e: Exception) {
            Log.e(TAG, "Error snoozing alarm", e)
            promise.reject("SNOOZE_ERROR", e.message, e)
        }
    }

    @ReactMethod
    fun isAlarmRunning(promise: Promise) {
        promise.resolve(AlarmService.isRunning)
    }

    @ReactMethod
    fun getTriggeredAlarm(promise: Promise) {
        try {
            if (AlarmService.isRunning && AlarmService.currentAlarmId != null) {
                val map = Arguments.createMap().apply {
                    putString("id", AlarmService.currentAlarmId)
                    putString("text", AlarmService.currentAlarmText)
                    putBoolean("isRunning", true)
                }
                promise.resolve(map)
            } else {
                promise.resolve(null)
            }
        } catch (e: Exception) {
            promise.reject("GET_TRIGGERED_ERROR", e.message, e)
        }
    }

    @ReactMethod
    fun canScheduleExactAlarms(promise: Promise) {
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                val alarmManager = reactContext.getSystemService(Context.ALARM_SERVICE) as? AlarmManager
                promise.resolve(alarmManager?.canScheduleExactAlarms() ?: true)
            } else {
                promise.resolve(true)
            }
        } catch (e: Exception) {
            promise.resolve(true)
        }
    }

    @ReactMethod
    fun requestExactAlarmPermission(promise: Promise) {
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                val intent = Intent(Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM).apply {
                    data = Uri.parse("package:${reactContext.packageName}")
                    flags = Intent.FLAG_ACTIVITY_NEW_TASK
                }
                reactContext.startActivity(intent)
                promise.resolve(true)
            } else {
                promise.resolve(true)
            }
        } catch (e: Exception) {
            promise.reject("EXACT_ALARM_SETTINGS_ERROR", e.message, e)
        }
    }

    @ReactMethod
    fun isIgnoringBatteryOptimizations(promise: Promise) {
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                val powerManager = reactContext.getSystemService(Context.POWER_SERVICE) as? PowerManager
                val isIgnoring = powerManager?.isIgnoringBatteryOptimizations(reactContext.packageName) ?: false
                promise.resolve(isIgnoring)
            } else {
                promise.resolve(true)
            }
        } catch (e: Exception) {
            promise.resolve(true)
        }
    }

    @ReactMethod
    fun requestIgnoreBatteryOptimizations(promise: Promise) {
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                val intent = Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS).apply {
                    data = Uri.parse("package:${reactContext.packageName}")
                    flags = Intent.FLAG_ACTIVITY_NEW_TASK
                }
                reactContext.startActivity(intent)
                promise.resolve(true)
            } else {
                promise.resolve(true)
            }
        } catch (e: Exception) {
            promise.reject("BATTERY_OPT_ERROR", e.message, e)
        }
    }
}
