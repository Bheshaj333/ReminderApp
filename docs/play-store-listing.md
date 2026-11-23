# Play Store listing & launch checklist

Copy-paste text for Play Console, plus the answers for the forms Google asks.

---

## 1. Store listing

**App name** (max 30): `Talking Reminder: Voice Alarm`
(Under the app icon the phone shows the short name `Talking Reminder`.)

**Short description** (max 80):
`Reminders that speak out loud: birthdays, bills, tasks and more.`

**Full description** (max 4000):

```
Never miss what matters. Talking Reminder reads your reminders out loud, like an alarm that tells you exactly what to do.

"It's Mom's birthday, call her." "Pay the electricity bill." "Leave for the airport."
Your phone says it, at the exact minute, even when it's locked.

★ SPEAKS YOUR REMINDER
Type what you want to hear. When it's time, your phone says it out loud, so you know what it's about without even picking it up.

★ WORKS LIKE AN ALARM
A full-screen alarm appears over your lock screen with three simple choices:
• Done: finished, stop the remaining rings
• Snooze: remind me again in a few minutes
• Dismiss: stop for now

★ RING AGAIN UNTIL YOU ACT
Need a nudge? Make it repeat 2, 3, or up to 11 times, a minute or more apart.

★ ANY SCHEDULE
• Once, every day, or weekends
• Every few minutes or hours ("every 3 hours")
• Every few days, weeks (pick the days), months ("every 3 months"), or years
Monthly reminders on the 31st land on the last day of shorter months. Nothing drifts.

★ CHOOSE THE VOICE
Pick from the voices on your phone in many languages, set the speed and pitch, and hear a preview before you save.

★ MADE FOR REAL LIFE
Birthdays 🎂, bills 💳, work 💼, calls 📞, home 🏠, health 💧, medicine 💊. Categories make your day easy to scan.

★ PRIVATE BY DESIGN
No account. No ads. No tracking. Your reminders never leave your phone.

Perfect for birthdays, bills and renewals, daily routines, and anyone who ignores silent notifications.
```

**App category:** Productivity
**Tags:** Reminders, Alarm clock, Productivity
**Contact email:** `support.matilabs@gmail.com` (shown publicly on the listing; also used in the privacy policy via `PRIVACY_CONTACT` in `src/content/privacyPolicy.js`)
**Developer name:** `Mati Labs` (suggested, to match the support email)
**Privacy policy URL:** *(link to your hosted `docs/privacy-policy.html`, see section 4)*

### Graphics you need to make
| Asset | Size | Tip |
|---|---|---|
| App icon | 512×512 PNG | Use `assets/icon.png` resized to 512 |
| Feature graphic | 1024×500 PNG | Logo + "Reminders that speak" on the dark teal gradient |
| Phone screenshots | 2–8, 9:16 (e.g. 1080×1920) | Today screen, lock-screen alarm, Edit screen with summary, Voice screen, onboarding |

The **lock-screen alarm** is the most striking screenshot. Use it first.

---

## 2. App content forms

**Data safety**
- Does your app collect or share any of the required user data types? → **No**
- Is all user data encrypted in transit? → Not applicable (no data transmitted)
- Do you provide a way for users to request data deletion? → Data stays on device; deleted by deleting reminders or uninstalling.

**Ads:** No, the app does not contain ads.

**Content rating questionnaire:** Category *Utility, Productivity, Communication, or Other*. Answer **No** to every content question (violence, sexuality, gambling, user interaction, location sharing, purchases) → rated *Everyone / PEGI 3*.

**Target audience:** 18+ (or 13+). Do not select under-13 age groups (avoids Families policy requirements).

**News app:** No. **Government app:** No. **Financial features:** None. **Health features:** "My app does not have any health features" (general-purpose reminders; no medical advice or health data).

---

## 3. Permission declarations (Play Console → App content)

**Exact alarms (`USE_EXACT_ALARM`)**
> Core functionality is a user-set alarm: at the exact time the user chooses, the app rings, shows a full-screen alarm and reads the reminder aloud. Inexact timing would make the alarm ring late.

*If Google rejects this declaration:* remove `USE_EXACT_ALARM` and drop `android:maxSdkVersion="32"` from `SCHEDULE_EXACT_ALARM` in `AndroidManifest.xml`. The onboarding screen already asks the user to allow exact alarms.

**Full-screen intent (`USE_FULL_SCREEN_INTENT`)**
> Alarm clock functionality: when a user-scheduled reminder alarm rings while the phone is locked, a full-screen alarm UI with Done / Snooze / Dismiss is shown, just like a clock app's alarm.

**Foreground service (`FOREGROUND_SERVICE_MEDIA_PLAYBACK`)**
> While a user-scheduled reminder rings, a short foreground service plays the text-to-speech audio of the reminder through the alarm audio stream. It stops as soon as the reminder has been spoken (a few seconds) or the user taps Done / Snooze / Dismiss.
> *Google asks for a short video:* screen-record a reminder ringing on the lock screen and being spoken.

**Display over other apps (`SYSTEM_ALERT_WINDOW`)** and **battery optimization (`REQUEST_IGNORE_BATTERY_OPTIMIZATIONS`)**: both optional, requested from the onboarding screen with an explanation, used only so the alarm opens and rings on time. If a reviewer objects, remove them. The app still works through the full-screen alarm and notification.

---

## 4. Host the privacy policy (free, ~2 minutes)

`docs/privacy-policy.html` is generated from the in-app policy (`node scripts/build-privacy-page.js`).

**Option A: Google Sites** (no code): sites.google.com → Blank → paste the policy text → Publish → copy the URL.

**Option B: GitHub Pages:** create a public repo (e.g. `reminderapp-privacy`), upload `privacy-policy.html` as `index.html`, then Settings → Pages → Deploy from branch `main`. The URL is `https://<username>.github.io/reminderapp-privacy/`.

---

## 5. Launch steps

1. Create a Play Console developer account (one-time $25).
2. **Create app** → name, default language, App, Free.
3. Fill in sections 1–3 above, add the privacy policy URL.
4. **Testing → Closed testing** → create a track → upload `app-release.aab` → add testers' emails.
   *New personal accounts must run a closed test with at least 12 testers for 14 days before applying for production.*
5. Keep **Play App Signing** on (default). Google keeps the final signing key; your `upload-keystore.jks` is the upload key.
6. After 14 days → **Apply for production** → roll out.

## 6. Every future update
1. Bump `versionCode` (+1) and `versionName` in `android/app/build.gradle`.
2. `cd android && ./gradlew bundleRelease`
3. Upload `android/app/build/outputs/bundle/release/app-release.aab` to a new release.
