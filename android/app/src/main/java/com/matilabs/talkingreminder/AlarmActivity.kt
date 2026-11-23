package com.matilabs.talkingreminder

import android.animation.Animator
import android.animation.AnimatorSet
import android.animation.ObjectAnimator
import android.animation.ValueAnimator
import android.annotation.SuppressLint
import android.content.Intent
import android.graphics.Color
import android.os.Build
import android.os.Bundle
import android.view.HapticFeedbackConstants
import android.view.MotionEvent
import android.view.View
import android.view.WindowManager
import android.view.animation.AccelerateInterpolator
import android.view.animation.DecelerateInterpolator
import android.view.animation.OvershootInterpolator
import android.widget.TextView
import androidx.activity.OnBackPressedCallback
import androidx.appcompat.app.AppCompatActivity
import androidx.core.view.ViewCompat
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat
import java.lang.ref.WeakReference

/**
 * Full-screen alarm UI shown over the lock screen (via the notification's full-screen intent)
 * when a reminder rings while the phone is locked, the screen is off, or the app is closed.
 * Done / Snooze / Dismiss are applied natively, so this works without the React Native app running.
 */
class AlarmActivity : AppCompatActivity() {

    companion object {
        private var current: WeakReference<AlarmActivity>? = null

        /** Close the alarm screen if it is showing [id] (user answered from another surface). */
        fun closeFor(id: String) {
            val activity = current?.get() ?: return
            activity.runOnUiThread {
                if (activity.alarmId == id && !activity.isFinishing) {
                    activity.animateOutAndFinish()
                }
            }
        }

        // Keys match the reminder categories in src/utils/categories.js
        private val ICONS = mapOf(
            "general" to "🔔",
            "medicine" to "💊",
            "birthday" to "🎂",
            "bills" to "💳",
            "health" to "💧",
            "work" to "💼",
            "call" to "📞",
            "home" to "🏠"
        )
    }

    private var alarmId: String = ""
    private var answered = false
    private val loopingAnimators = mutableListOf<Animator>()

    private lateinit var content: View
    private lateinit var reminderText: TextView
    private lateinit var burstPill: TextView
    private lateinit var hint: TextView
    private lateinit var emoji: TextView

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        showOverLockScreen()
        WindowCompat.setDecorFitsSystemWindows(window, false)
        window.statusBarColor = Color.TRANSPARENT
        window.navigationBarColor = Color.TRANSPARENT
        setContentView(R.layout.activity_alarm)
        current = WeakReference(this)

        content = findViewById(R.id.content)
        reminderText = findViewById(R.id.reminderText)
        burstPill = findViewById(R.id.burstPill)
        hint = findViewById(R.id.hint)
        emoji = findViewById(R.id.emoji)

        ViewCompat.setOnApplyWindowInsetsListener(content) { v, insets ->
            val bars = insets.getInsets(WindowInsetsCompat.Type.systemBars())
            v.setPadding(v.paddingLeft, bars.top, v.paddingRight, bars.bottom)
            insets
        }

        setupButton(R.id.btnDone) { answer(AlarmReceiver.ACTION_DONE) }
        findViewById<TextView>(R.id.btnSnooze).text = "Snooze · ${AlarmSettings.get(this).snoozeMinutes} min"
        setupButton(R.id.btnSnooze) { answer(AlarmReceiver.ACTION_SNOOZE) }
        setupButton(R.id.btnDismiss) { answer(AlarmReceiver.ACTION_DISMISS) }

        onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
            override fun handleOnBackPressed() = answer(AlarmReceiver.ACTION_DISMISS)
        })

        bind(intent)
        playEntrance()
        startAmbientAnimations()
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        // Next burst of the same (or another) reminder while the screen is still up
        answered = false
        bind(intent)
        content.animate().cancel()
        content.alpha = 1f
        content.scaleX = 1f
        content.scaleY = 1f
        emoji.animate().cancel()
        emoji.scaleX = 0.6f
        emoji.scaleY = 0.6f
        emoji.animate().scaleX(1f).scaleY(1f).setDuration(600)
            .setInterpolator(OvershootInterpolator(3f)).start()
    }

    override fun onDestroy() {
        loopingAnimators.forEach { it.cancel() }
        loopingAnimators.clear()
        if (current?.get() === this) current = null
        super.onDestroy()
    }

    private fun showOverLockScreen() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
            setShowWhenLocked(true)
            setTurnScreenOn(true)
        } else {
            @Suppress("DEPRECATION")
            window.addFlags(
                WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED or
                    WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON
            )
        }
        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
    }

    private fun bind(intent: Intent) {
        alarmId = intent.getStringExtra(AlarmReceiver.EXTRA_ALARM_ID) ?: ""
        val stored = if (alarmId.isNotEmpty()) AlarmStorage.getAlarm(this, alarmId) else null
        val text = intent.getStringExtra(AlarmReceiver.EXTRA_ALARM_TEXT)
            ?: stored?.optString("text")
            ?: "Reminder"
        val burstIndex = intent.getIntExtra(AlarmReceiver.EXTRA_BURST_INDEX, 0)
        val burstCount = intent.getIntExtra(AlarmReceiver.EXTRA_BURST_COUNT, 0)
        val burstInterval = intent.getIntExtra(AlarmReceiver.EXTRA_BURST_INTERVAL, 0)
        val repeating = (stored?.optString("repeatType", "once") ?: "once") != "once"

        reminderText.text = text
        emoji.text = ICONS[stored?.optString("icon")] ?: "🔔"

        if (burstCount > 0) {
            val total = burstCount + 1
            val ring = (burstIndex + 1).coerceAtMost(total)
            val interval = if (burstInterval > 0) burstInterval else 1
            burstPill.text = if (ring < total) {
                "Ring $ring of $total  ·  next in $interval min"
            } else {
                "Final ring  ·  $total of $total"
            }
            burstPill.visibility = View.VISIBLE
        } else {
            burstPill.visibility = View.GONE
        }

        val pendingRepeats = burstCount > 0 && burstIndex < burstCount
        hint.text = when {
            pendingRepeats -> "Done stops the remaining rings  ·  Dismiss keeps them"
            repeating -> "Your next scheduled reminder stays on"
            else -> "Snooze to hear it again in ${AlarmSettings.get(this).snoozeMinutes} minutes"
        }
    }

    private fun answer(action: String) {
        if (answered) return
        answered = true
        AlarmReceiver.handleUserAction(applicationContext, action, alarmId)
        animateOutAndFinish()
    }

    @SuppressLint("ClickableViewAccessibility")
    private fun setupButton(id: Int, onClick: () -> Unit) {
        val button = findViewById<View>(id)
        button.setOnTouchListener { v, event ->
            when (event.actionMasked) {
                MotionEvent.ACTION_DOWN -> v.animate().scaleX(0.95f).scaleY(0.95f)
                    .setDuration(110).setInterpolator(DecelerateInterpolator()).start()
                MotionEvent.ACTION_UP, MotionEvent.ACTION_CANCEL -> v.animate().scaleX(1f).scaleY(1f)
                    .setDuration(260).setInterpolator(OvershootInterpolator(2.5f)).start()
            }
            false
        }
        button.setOnClickListener { v ->
            v.performHapticFeedback(HapticFeedbackConstants.CONFIRM.takeIf { Build.VERSION.SDK_INT >= 30 }
                ?: HapticFeedbackConstants.VIRTUAL_KEY)
            onClick()
        }
    }

    private fun playEntrance() {
        val staggered = listOf(
            R.id.clock, R.id.date, R.id.label, R.id.reminderText, R.id.burstPill, R.id.actions
        ).map { findViewById<View>(it) }
        val rise = 36f * resources.displayMetrics.density

        staggered.forEachIndexed { i, v ->
            v.alpha = 0f
            v.translationY = rise
            v.animate().alpha(1f).translationY(0f)
                .setStartDelay(120L + i * 70L)
                .setDuration(650)
                .setInterpolator(DecelerateInterpolator(2.2f))
                .start()
        }

        val icon = findViewById<View>(R.id.iconCircle)
        icon.alpha = 0f
        icon.scaleX = 0.5f
        icon.scaleY = 0.5f
        icon.animate().alpha(1f).scaleX(1f).scaleY(1f)
            .setStartDelay(200)
            .setDuration(750)
            .setInterpolator(OvershootInterpolator(1.8f))
            .start()
    }

    private fun startAmbientAnimations() {
        // Sonar-style rings expanding out of the icon
        listOf(R.id.ring1, R.id.ring2, R.id.ring3).forEachIndexed { i, ringId ->
            val ring = findViewById<View>(ringId)
            val scaleX = ObjectAnimator.ofFloat(ring, View.SCALE_X, 1f, 1.8f)
            val scaleY = ObjectAnimator.ofFloat(ring, View.SCALE_Y, 1f, 1.8f)
            val alpha = ObjectAnimator.ofFloat(ring, View.ALPHA, 0.9f, 0f)
            listOf(scaleX, scaleY, alpha).forEach {
                it.repeatCount = ValueAnimator.INFINITE
                it.duration = 2700
                it.startDelay = 600L + i * 900L
                it.interpolator = DecelerateInterpolator(1.4f)
            }
            AnimatorSet().apply { playTogether(scaleX, scaleY, alpha); start() }
                .also { loopingAnimators.add(it) }
        }

        // Gentle breathing of the icon
        val icon = findViewById<View>(R.id.iconCircle)
        listOf(View.SCALE_X, View.SCALE_Y).forEach { prop ->
            ObjectAnimator.ofFloat(icon, prop, 1f, 1.06f).apply {
                duration = 1400
                startDelay = 950
                repeatCount = ValueAnimator.INFINITE
                repeatMode = ValueAnimator.REVERSE
                interpolator = DecelerateInterpolator()
                start()
            }.also { loopingAnimators.add(it) }
        }

        // Slow aurora drift
        val d = resources.displayMetrics.density
        drift(findViewById(R.id.glowTop), 40f * d, 60f * d, 9000)
        drift(findViewById(R.id.glowBottom), -50f * d, -40f * d, 11000)
    }

    private fun drift(view: View, dx: Float, dy: Float, durationMs: Long) {
        listOf(
            ObjectAnimator.ofFloat(view, View.TRANSLATION_X, 0f, dx),
            ObjectAnimator.ofFloat(view, View.TRANSLATION_Y, 0f, dy)
        ).forEach {
            it.duration = durationMs
            it.repeatCount = ValueAnimator.INFINITE
            it.repeatMode = ValueAnimator.REVERSE
            it.interpolator = DecelerateInterpolator(0.8f)
            it.start()
            loopingAnimators.add(it)
        }
    }

    fun animateOutAndFinish() {
        if (isFinishing) return
        content.animate()
            .alpha(0f)
            .scaleX(0.94f)
            .scaleY(0.94f)
            .setDuration(260)
            .setInterpolator(AccelerateInterpolator())
            .withEndAction {
                finish()
                @Suppress("DEPRECATION")
                overridePendingTransition(0, android.R.anim.fade_out)
            }
            .start()
    }
}
