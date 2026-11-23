package com.matilabs.talkingreminder

import android.app.KeyguardManager
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.media.AudioAttributes
import android.media.AudioFocusRequest
import android.media.AudioManager
import android.os.Build
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import android.os.PowerManager
import android.os.VibrationEffect
import android.os.Vibrator
import android.os.VibratorManager
import android.speech.tts.TextToSpeech
import android.speech.tts.UtteranceProgressListener
import android.util.Log
import androidx.core.app.NotificationCompat
import java.util.Locale

import android.media.Ringtone
import android.media.RingtoneManager

class AlarmService : Service(), TextToSpeech.OnInitListener {

    companion object {
        const val TAG = "AlarmService"
        const val CHANNEL_ID = "spoken_alarm_channel"
        const val NOTIFICATION_ID = 99991
        const val ACTION_STOP = "com.matilabs.talkingreminder.ACTION_STOP_SERVICE"

        var isRunning = false
            private set
        var currentAlarmId: String? = null
            private set
        var currentAlarmText: String? = null
            private set
    }

    private var tts: TextToSpeech? = null
    private var isTtsReady = false
    private var fallbackRingtone: Ringtone? = null
    private var reminderText: String = ""
    private var reminderId: String = ""
    private var voiceStyle: String = "default"
    private var escalation: Boolean = true
    private var burstIndex: Int = 0
    private var burstCount: Int = 1
    private var burstInterval: Int = 1

    private var vibrator: Vibrator? = null
    private var audioManager: AudioManager? = null
    private var focusRequest: AudioFocusRequest? = null

    private val handler = Handler(Looper.getMainLooper())
    private var speechRepeatCount = 0
    private val maxSpeechRepeats = 1 // Speak reminder once per alarm trigger
    private val safetyTimeoutMs = 180 * 1000L // 3 minutes safety timeout while waiting for speech

    // True when the ring ends on its own (no Done/Snooze/Dismiss), so options are kept in the shade
    private var finishedUnanswered = false

    private val stopRunnable = Runnable {
        Log.d(TAG, "Alarm reached auto-dismiss timeout (5s after message finished speaking)")
        finishedUnanswered = true
        stopSelf()
    }

    private val safetyTimeoutRunnable = Runnable {
        Log.d(TAG, "Alarm reached safety timeout (180s)")
        finishedUnanswered = true
        stopSelf()
    }

    override fun onCreate() {
        super.onCreate()
        Log.d(TAG, "AlarmService created")
        isRunning = true
        createNotificationChannel()
        initAudioAndVibration()
        initTts()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        if (intent == null || intent.action == ACTION_STOP) {
            Log.d(TAG, "AlarmService received stop action")
            stopSelf()
            return START_NOT_STICKY
        }

        reminderId = intent.getStringExtra(AlarmReceiver.EXTRA_ALARM_ID) ?: ""
        reminderText = intent.getStringExtra(AlarmReceiver.EXTRA_ALARM_TEXT) ?: "Reminder"
        voiceStyle = intent.getStringExtra(AlarmReceiver.EXTRA_VOICE_STYLE) ?: "default"
        escalation = intent.getBooleanExtra(AlarmReceiver.EXTRA_ESCALATION, true)
        burstIndex = intent.getIntExtra(AlarmReceiver.EXTRA_BURST_INDEX, 0)
        burstCount = intent.getIntExtra(AlarmReceiver.EXTRA_BURST_COUNT, 0)
        burstInterval = intent.getIntExtra(AlarmReceiver.EXTRA_BURST_INTERVAL, 0)

        currentAlarmId = reminderId
        currentAlarmText = reminderText

        Log.d(TAG, "Starting alarm service for '$reminderText' (ID: $reminderId, burst: $burstIndex/$burstCount)")

        // Notify React Native UI if app is open
        AlarmModule.emitAlarmTriggered(reminderId, reminderText, burstIndex, burstCount)

        // A new ring replaces any unanswered notification left by the previous one
        finishedUnanswered = false
        AlarmNotifier.cancelPending(this, reminderId)

        // Build and display ongoing high-priority notification immediately
        val notification = buildAlarmNotification(reminderId, reminderText)
        startForeground(NOTIFICATION_ID, notification)

        // Like a clock alarm: pop the alarm screen by itself when the phone is locked or asleep.
        // The notification's full-screen intent alone is often downgraded to a heads-up by OEMs.
        launchAlarmScreenIfLocked()

        // Request Audio Focus
        requestAlarmAudioFocus()

        // Start Vibration
        startVibration()

        // Reset speech count & set safety timeout
        speechRepeatCount = 0
        handler.removeCallbacks(stopRunnable)
        handler.removeCallbacks(safetyTimeoutRunnable)
        handler.postDelayed(safetyTimeoutRunnable, safetyTimeoutMs)

        // If TTS is already initialized, start speaking
        if (isTtsReady) {
            speakReminder()
        }

        return START_STICKY
    }

    private fun launchAlarmScreenIfLocked() {
        try {
            val keyguard = getSystemService(Context.KEYGUARD_SERVICE) as? KeyguardManager
            val power = getSystemService(Context.POWER_SERVICE) as? PowerManager
            val locked = keyguard?.isKeyguardLocked == true
            val screenOff = power?.isInteractive == false
            if (!locked && !screenOff) return

            startActivity(
                AlarmNotifier.alarmScreenLaunchIntent(this, reminderId, reminderText, burstIndex, burstCount, burstInterval)
            )
            Log.d(TAG, "Launched AlarmActivity directly (locked=$locked, screenOff=$screenOff)")
        } catch (e: Exception) {
            // Background activity start blocked; the full-screen intent remains the fallback
            Log.w(TAG, "Direct AlarmActivity launch blocked", e)
        }
    }

    override fun onInit(status: Int) {
        if (status == TextToSpeech.SUCCESS) {
            Log.d(TAG, "TTS initialized successfully")
            isTtsReady = true
            setupTtsParameters()
            speakReminder()
        } else {
            Log.e(TAG, "TTS initialization failed with status: $status, playing fallback alarm tone")
            playFallbackAlarm()
        }
    }

    private fun playFallbackAlarm() {
        try {
            val alertUri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM)
                ?: RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION)
            fallbackRingtone = RingtoneManager.getRingtone(applicationContext, alertUri)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
                val audioAttributes = AudioAttributes.Builder()
                    .setUsage(AudioAttributes.USAGE_ALARM)
                    .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                    .build()
                fallbackRingtone?.audioAttributes = audioAttributes
            }
            fallbackRingtone?.play()
            handler.removeCallbacks(safetyTimeoutRunnable)
            handler.postDelayed(stopRunnable, 10000L) // 10s fallback ringtone
        } catch (e: Exception) {
            Log.e(TAG, "Failed to play fallback ringtone", e)
            handler.postDelayed(stopRunnable, 5000L)
        }
    }

    private fun initTts() {
        try {
            tts = TextToSpeech(applicationContext, this)
            tts?.setOnUtteranceProgressListener(object : UtteranceProgressListener() {
                override fun onStart(utteranceId: String?) {
                    Log.d(TAG, "TTS started speaking: $utteranceId")
                }

                override fun onDone(utteranceId: String?) {
                    Log.d(TAG, "TTS finished speaking: $utteranceId")
                    speechRepeatCount++
                    // Message read once. Now wait 5 seconds for user action before auto-dismissing
                    handler.removeCallbacks(safetyTimeoutRunnable)
                    handler.removeCallbacks(stopRunnable)
                    Log.d(TAG, "TTS complete. Starting 5s action window...")
                    handler.postDelayed(stopRunnable, 5000L)
                }

                override fun onError(utteranceId: String?) {
                    Log.e(TAG, "TTS error on utterance: $utteranceId")
                    handler.removeCallbacks(safetyTimeoutRunnable)
                    handler.postDelayed(stopRunnable, 5000L)
                }
            })
        } catch (e: Exception) {
            Log.e(TAG, "Failed to initialize TTS", e)
        }
    }

    private fun setupTtsParameters() {
        val ttsInstance = tts ?: return
        try {
            val prefs = AlarmSettings.get(this)
            // Voice chosen on the Voice screen (falls back to the device language)
            val chosen = prefs.voiceId?.let { id -> ttsInstance.voices?.firstOrNull { it.name == id } }
            if (chosen != null) {
                ttsInstance.voice = chosen
            } else {
                ttsInstance.language = Locale.getDefault()
            }
            ttsInstance.setPitch(prefs.pitch)
            ttsInstance.setSpeechRate(prefs.rate)

            // Route audio explicitly through ALARM stream
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
                val audioAttributes = AudioAttributes.Builder()
                    .setUsage(AudioAttributes.USAGE_ALARM)
                    .setContentType(AudioAttributes.CONTENT_TYPE_SPEECH)
                    .build()
                ttsInstance.setAudioAttributes(audioAttributes)
            }
        } catch (e: Exception) {
            Log.e(TAG, "Error setting up TTS parameters", e)
        }
    }

    private fun speakReminder() {
        val ttsInstance = tts ?: return
        if (!isTtsReady || reminderText.isEmpty()) return

        try {
            val params = HashMap<String, String>()
            params[TextToSpeech.Engine.KEY_PARAM_STREAM] = AudioManager.STREAM_ALARM.toString()
            params[TextToSpeech.Engine.KEY_PARAM_UTTERANCE_ID] = "Reminder_Utterance_$speechRepeatCount"

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
                val utteranceId = "Reminder_Utterance_$speechRepeatCount"
                ttsInstance.speak(spokenText(), TextToSpeech.QUEUE_FLUSH, null, utteranceId)
            } else {
                @Suppress("DEPRECATION")
                ttsInstance.speak(spokenText(), TextToSpeech.QUEUE_FLUSH, params)
            }
            Log.d(TAG, "Spoke reminder: '$reminderText' (repetition $speechRepeatCount)")
        } catch (e: Exception) {
            Log.e(TAG, "Error speaking text", e)
        }
    }

    private fun spokenText(): String =
        if (AlarmSettings.get(this).announcePrefix) "Reminder. $reminderText" else reminderText

    private fun initAudioAndVibration() {
        audioManager = getSystemService(Context.AUDIO_SERVICE) as? AudioManager
        vibrator = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            val vibratorManager = getSystemService(Context.VIBRATOR_MANAGER_SERVICE) as? VibratorManager
            vibratorManager?.defaultVibrator
        } else {
            @Suppress("DEPRECATION")
            getSystemService(Context.VIBRATOR_SERVICE) as? Vibrator
        }
    }

    private fun requestAlarmAudioFocus() {
        val am = audioManager ?: return
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                val playbackAttributes = AudioAttributes.Builder()
                    .setUsage(AudioAttributes.USAGE_ALARM)
                    .setContentType(AudioAttributes.CONTENT_TYPE_SPEECH)
                    .build()

                focusRequest = AudioFocusRequest.Builder(AudioManager.AUDIOFOCUS_GAIN_TRANSIENT_MAY_DUCK)
                    .setAudioAttributes(playbackAttributes)
                    .setAcceptsDelayedFocusGain(true)
                    .setOnAudioFocusChangeListener { focusChange ->
                        Log.d(TAG, "Audio focus changed: $focusChange")
                    }
                    .build()

                focusRequest?.let { am.requestAudioFocus(it) }
            } else {
                @Suppress("DEPRECATION")
                am.requestAudioFocus(
                    null,
                    AudioManager.STREAM_ALARM,
                    AudioManager.AUDIOFOCUS_GAIN_TRANSIENT_MAY_DUCK
                )
            }
        } catch (e: Exception) {
            Log.e(TAG, "Error requesting audio focus", e)
        }
    }

    private fun abandonAlarmAudioFocus() {
        val am = audioManager ?: return
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                focusRequest?.let { am.abandonAudioFocusRequest(it) }
            } else {
                @Suppress("DEPRECATION")
                am.abandonAudioFocus(null)
            }
        } catch (e: Exception) {
            Log.e(TAG, "Error abandoning audio focus", e)
        }
    }

    private fun startVibration() {
        if (!AlarmSettings.get(this).vibrate) return
        val vib = vibrator ?: return
        try {
            val pattern = longArrayOf(0, 600, 400, 600, 400, 600, 1000)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                val effect = VibrationEffect.createWaveform(pattern, 0) // Repeat from 0
                val audioAttributes = AudioAttributes.Builder()
                    .setUsage(AudioAttributes.USAGE_ALARM)
                    .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                    .build()
                vib.vibrate(effect, audioAttributes)
            } else {
                @Suppress("DEPRECATION")
                vib.vibrate(pattern, 0)
            }
        } catch (e: Exception) {
            Log.e(TAG, "Error starting vibration", e)
        }
    }

    private fun stopVibration() {
        try {
            vibrator?.cancel()
        } catch (e: Exception) {
            Log.e(TAG, "Error stopping vibration", e)
        }
    }

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val notificationManager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            val channel = NotificationChannel(
                CHANNEL_ID,
                "Alarm Reminders",
                NotificationManager.IMPORTANCE_HIGH
            ).apply {
                description = "High priority full-screen alarms with voice announcement"
                enableLights(true)
                enableVibration(true)
                vibrationPattern = longArrayOf(0, 500, 300, 500)
                lockscreenVisibility = Notification.VISIBILITY_PUBLIC
                setBypassDnd(true)
                val audioAttributes = AudioAttributes.Builder()
                    .setUsage(AudioAttributes.USAGE_ALARM)
                    .setContentType(AudioAttributes.CONTENT_TYPE_SPEECH)
                    .build()
                setSound(null, audioAttributes) // Sound handled directly by native TTS
            }
            notificationManager.createNotificationChannel(channel)
        }
    }

    private fun buildAlarmNotification(id: String, text: String): Notification {
        // Full-screen intent shows the lock-screen AlarmActivity when the device is locked/screen off;
        // while the phone is in use Android shows this as a heads-up panel with the action buttons.
        val screenIntent = AlarmNotifier.alarmScreenIntent(this, id, text, burstIndex, burstCount, burstInterval)

        val builder = NotificationCompat.Builder(this, CHANNEL_ID)
            .setSmallIcon(R.drawable.ic_stat_reminder)
            .setColor(0xFF78BDAF.toInt())
            .setContentTitle("Reminder")
            .setContentText(text)
            .setStyle(NotificationCompat.BigTextStyle().bigText(text))
            .setPriority(NotificationCompat.PRIORITY_MAX)
            .setCategory(NotificationCompat.CATEGORY_ALARM)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setContentIntent(screenIntent)
            .setFullScreenIntent(screenIntent, true)
            .setOngoing(true)
            .setAutoCancel(false)
        return AlarmNotifier.addActions(builder, this, id).build()
    }

    override fun onDestroy() {
        super.onDestroy()
        Log.d(TAG, "AlarmService destroying...")
        val finishedId = currentAlarmId
        val leavePending = finishedUnanswered
        isRunning = false
        currentAlarmId = null
        currentAlarmText = null

        handler.removeCallbacks(stopRunnable)
        handler.removeCallbacks(safetyTimeoutRunnable)

        // Stop TTS
        try {
            tts?.stop()
            tts?.shutdown()
            tts = null
        } catch (e: Exception) {
            Log.e(TAG, "Error shutting down TTS", e)
        }

        // Stop fallback ringtone if active
        try {
            fallbackRingtone?.stop()
            fallbackRingtone = null
        } catch (e: Exception) {
            Log.e(TAG, "Error stopping fallback ringtone", e)
        }

        // Stop vibration & audio focus
        stopVibration()
        abandonAlarmAudioFocus()

        // Release WakeLock
        AlarmReceiver.releaseWakeLock()

        // Cancel Notification
        val notificationManager = getSystemService(Context.NOTIFICATION_SERVICE) as? NotificationManager
        notificationManager?.cancel(NOTIFICATION_ID)

        // Let the React Native UI close its alarm screen now that speaking is over
        if (!finishedId.isNullOrEmpty()) {
            if (leavePending) {
                AlarmNotifier.showPending(this, finishedId, reminderText, burstIndex, burstCount, burstInterval)
            }
            AlarmModule.emitAlarmStopped(finishedId)
        }
    }

    override fun onBind(intent: Intent?): IBinder? = null
}
