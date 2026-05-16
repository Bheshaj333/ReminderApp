import 'react-native-gesture-handler';
import React, { useEffect } from 'react';
import { StyleSheet } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { StatusBar } from 'expo-status-bar';

import { AppProvider } from './src/store/AppContext';
import AppNavigator from './src/navigation/AppNavigator';
import { requestPermissions } from './src/utils/notifications';
import { Colors } from './src/utils/theme';

export default function App() {
  useEffect(() => {
    requestPermissions();
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
