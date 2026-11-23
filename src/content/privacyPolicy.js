// Single source for the privacy policy: shown in-app (PrivacyScreen) and exported to
// docs/privacy-policy.html (`node scripts/build-privacy-page.js`) for the Play Console URL.

export const PRIVACY_UPDATED = '3 October 2026';
// Dedicated support address (never a personal one); null hides the email button.
export const PRIVACY_CONTACT = 'support.matilabs@gmail.com';

export const PRIVACY_SECTIONS = [
  {
    title: 'The short version',
    body: [
      'Talking Reminder does not collect, sell or share your personal data. There are no accounts, no ads and no analytics. Your reminders stay on your phone.',
    ],
  },
  {
    title: 'What is stored, and where',
    body: [
      'The reminders you create (their text, times, repeat settings and category) and your app settings (voice, speed, pitch, snooze length, vibration) are stored only on your device, inside the app\'s private storage.',
      'We do not have servers and never receive this information.',
    ],
  },
  {
    title: 'Text-to-speech',
    body: [
      'Reminders are read aloud by the text-to-speech engine installed on your phone (for example, Speech Services by Google).',
      'Voices marked "Works offline" run entirely on your device. If you choose a voice marked "Needs internet", the reminder text is sent to the provider of that speech engine to generate the audio, under that provider\'s own privacy policy.',
    ],
  },
  {
    title: 'Backups',
    body: [
      'If Android backup is turned on for your Google account, Android may include this app\'s data in your device backup so your reminders can be restored on a new phone. This is controlled by you in your phone\'s settings and handled by Google, not by us.',
    ],
  },
  {
    title: 'Permissions and why they are needed',
    body: [
      'Notifications: to show the reminder with Done, Snooze and Dismiss.',
      'Exact alarms: so reminders ring at the exact minute you set.',
      'Full-screen alarm: to show the alarm screen over the lock screen.',
      'Display over other apps (optional): so the alarm screen can open by itself when the phone is locked.',
      'Ignore battery optimization (optional): so Android does not delay your reminders.',
      'Run at startup: to restore your reminders after the phone restarts.',
      'Foreground service and wake lock: to keep the phone awake while a reminder is being spoken.',
      'Vibration: to vibrate while a reminder rings (can be turned off in Settings).',
      'None of these permissions are used to collect data.',
    ],
  },
  {
    title: 'Deleting your data',
    body: [
      'Delete any reminder inside the app, or remove everything by uninstalling the app or clearing its storage in Android settings.',
    ],
  },
  {
    title: 'Children',
    body: [
      'The app is not directed at children under 13 and does not knowingly collect information from anyone.',
    ],
  },
  {
    title: 'Changes to this policy',
    body: [
      'If this policy changes, the new version will be published at the same address and in the app, with a new "last updated" date.',
    ],
  },
  {
    title: 'Contact',
    body: [PRIVACY_CONTACT
      ? `Questions about this policy: ${PRIVACY_CONTACT}`
      : "Questions about this policy: use the developer contact on the app's Google Play listing."],
  },
];
