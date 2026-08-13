# interrupt 🔔

**interrupt** is not just a reminder app. It is a high-compliance interruption system optimized for human attention. It is designed to break through "notification blindness" and ensure that your most important tasks are not just seen, but acted upon.

## 🚀 Key Features

- **Alarm-Like Behavior**: Reminders act like alarms, bypassing "Do Not Disturb" (when configured) and waking the device.
- **Background Voice Announcements**: The app uses Text-to-Speech (TTS) to read your reminders out loud, even if the app is closed or the phone is locked.
- **Escalating Intensity**: Notifications can be set to get louder and more urgent if they are ignored.
- **"Until Done" Logic**: Persistent reminders that continue to "interrupt" you until you explicitly confirm completion.
- **Smart Snoozing**: Easy 5-minute snooze or "Ignore" options for flexible focus management.
- **Voice-First Design**: Dedicated voice screen for quick reminder entry.
- **Modern UI/UX**: A clean, minimalist aesthetic built with React Native and Reanimated for fluid transitions.

## 🛠 Tech Stack

- **Framework**: Expo (React Native)
- **State Management**: React Context API
- **Animations**: React Native Reanimated
- **Notifications**: Expo Notifications + Expo Task Manager
- **Storage**: Async Storage
- **Speech**: Expo Speech (TTS)
- **Icons**: Expo Vector Icons (Feather)

## 📋 Prerequisites

- [Node.js](https://nodejs.org/) (LTS)
- [Expo Go](https://expo.dev/go) (for testing) or an Android/iOS Development Build
- [EAS CLI](https://docs.expo.dev/build/setup/) (for cloud builds)

## 🔧 Installation & Setup

1. **Clone the repository**:
   ```bash
   git clone <repository-url>
   cd ReminderApp
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Start the development server**:
   ```bash
   npx expo start
   ```

## ⚠️ Critical Android Permissions

For the "Alarm" and "Voice" features to work correctly in the background, you must manually enable these on your Android device:

1. **Display over other apps**: App Info > Advanced > Display over other apps > **Allow**.
2. **Battery Optimization**: Set to "Unrestricted" to ensure background tasks are not killed by the system.
3. **Notification Channel**: Ensure the "Reminders" channel is set to "High" or "Urgent" priority.

## ⌨️ Useful Commands

### Development
- `npx expo start`: Start the Expo dev server.
- `npx expo run:android`: Build and run the app locally on an Android emulator or device.
- `npx expo run:ios`: Build and run the app locally on an iOS simulator or device.

### Building
- `eas build --profile development --platform android`: Create a development build for Android.
- `eas build --profile production --platform android`: Create a production build for Android.

### Maintenance
- `npm install`: Install project dependencies.
- `npx expo install <package-name>`: Install an Expo-compatible package.

### My Commands

cd android
./gradlew clean
./gradlew assembleDebug     // This will generate the debug apk file under android/app/build/outputs/apk/debug
./gradlew assembleRelease 	// this will create the apk of app under android/app/build/outputs/apk/release
./gradlew bundleRelease     // this will create the aab file under android/app/build/outputs/bundle/release

---
Built with ❤️ by Bheshaj.
