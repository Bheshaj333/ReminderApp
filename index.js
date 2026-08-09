import { registerRootComponent } from 'expo';
import notifee, { EventType } from '@notifee/react-native';
import './src/utils/notifications';

import App from './App';

// Register Notifee background event handler
notifee.onBackgroundEvent(async ({ type, detail }) => {
  const { notification, pressAction } = detail;

  console.log('[Notifee] Background Event:', type);

  if (type === EventType.ACTION_PRESS && pressAction?.id === 'stop') {
    // Remove the notification if the user pressed the stop button
    await notifee.cancelNotification(notification.id);
  }
});

registerRootComponent(App);
