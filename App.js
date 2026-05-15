import 'react-native-gesture-handler';
import React, { useEffect, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { StatusBar } from 'expo-status-bar';
import Animated, {
  useSharedValue, useAnimatedStyle, withTiming, withSpring,
} from 'react-native-reanimated';

import { AppProvider } from './src/store/AppContext';
import AppNavigator from './src/navigation/AppNavigator';
import { requestPermissions, addNotificationResponseListener, addNotificationReceivedListener } from './src/utils/notifications';
import { Colors } from './src/utils/theme';

export default function App() {
  const notifListener = useRef(null);
  const responseListener = useRef(null);

  useEffect(() => {
    requestPermissions();

    notifListener.current = addNotificationReceivedListener(notification => {
      // Handle received notification (app is in foreground)
      const data = notification.request.content.data;
      console.log('Notification received:', data);
    });

    responseListener.current = addNotificationResponseListener(response => {
      // User tapped on notification
      const data = response.notification.request.content.data;
      console.log('Notification response:', data);
    });

    return () => {
      notifListener.current?.remove();
      responseListener.current?.remove();
    };
  }, []);

  return (
      <GestureHandlerRootView style={styles.root}>
        <SafeAreaProvider>
          <AppProvider>
            <NavigationContainer
                theme={{
                  colors: {
                    background: Colors.mist,
                    primary: Colors.seafoam,
                    card: Colors.white,
                    text: Colors.ink,
                    border: Colors.border,
                    notification: Colors.seafoam,
                  },
                }}
            >
              <StatusBar style="dark" backgroundColor={Colors.mist} />
              <AppNavigator />
            </NavigationContainer>
          </AppProvider>
        </SafeAreaProvider>
      </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});
