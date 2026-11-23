import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import Animated, { useAnimatedStyle, withTiming, withSpring, useSharedValue } from 'react-native-reanimated';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator, CardStyleInterpolators } from '@react-navigation/stack';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';

import { Colors } from '../utils/theme';
import HomeScreen from '../screens/HomeScreen';
import RemindersScreen from '../screens/RemindersScreen';
import VoiceScreen from '../screens/VoiceScreen';
import SettingsScreen from '../screens/SettingsScreen';
import ReminderEditScreen from '../screens/ReminderEditScreen';
import OnboardingScreen from '../screens/OnboardingScreen';
import PrivacyScreen from '../screens/PrivacyScreen';
import FullscreenReminder from '../components/FullscreenReminder';
import { useApp } from '../store/AppContext';

const Tab = createBottomTabNavigator();
const Stack = createStackNavigator();

const TABS = {
  Home: { icon: 'sun', label: 'Today' },
  Reminders: { icon: 'bell', label: 'Reminders' },
  Voice: { icon: 'mic', label: 'Voice' },
  Settings: { icon: 'sliders', label: 'Settings' },
};

function TabItem({ route, focused, onPress }) {
  const tab = TABS[route.name];
  const scale = useSharedValue(1);
  const pill = useAnimatedStyle(() => ({
    opacity: withTiming(focused ? 1 : 0, { duration: 180 }),
    transform: [{ scaleX: withSpring(focused ? 1 : 0.6, { damping: 16, stiffness: 220 }) }],
  }));
  const icon = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <Pressable
      onPress={onPress}
      onPressIn={() => { scale.value = withSpring(0.88, { damping: 14 }); }}
      onPressOut={() => { scale.value = withSpring(1, { damping: 12 }); }}
      style={styles.tabItem}
    >
      <View style={styles.iconWrap}>
        <Animated.View style={[styles.pill, pill]} />
        <Animated.View style={icon}>
          <Feather name={tab.icon} size={20} color={focused ? Colors.deeper : Colors.soft} />
        </Animated.View>
      </View>
      <Text style={[styles.tabLabel, focused && styles.tabLabelActive]}>{tab.label}</Text>
    </Pressable>
  );
}

function TabBar({ state, navigation }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.tabBar, { paddingBottom: Math.max(insets.bottom, 10) }]}>
      {state.routes.map((route, index) => {
        const focused = state.index === index;
        const onPress = () => {
          const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
          if (!focused && !event.defaultPrevented) {
            Haptics.selectionAsync();
            navigation.navigate(route.name);
          }
        };
        return <TabItem key={route.key} route={route} focused={focused} onPress={onPress} />;
      })}
    </View>
  );
}

function MainTabs() {
  return (
    <Tab.Navigator tabBar={props => <TabBar {...props} />} screenOptions={{ headerShown: false, lazy: true }}>
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="Reminders" component={RemindersScreen} />
      <Tab.Screen name="Voice" component={VoiceScreen} />
      <Tab.Screen name="Settings" component={SettingsScreen} />
    </Tab.Navigator>
  );
}

export default function AppNavigator() {
  const { state, dismissReminder, snoozeReminder, ignoreReminder } = useApp();
  const { activeReminder, settings, loading } = state;

  if (loading) return null; // native splash stays up until saved data is loaded

  return (
    <>
      <Stack.Navigator screenOptions={{ headerShown: false, cardStyle: { backgroundColor: Colors.mist } }}>
        {!settings.onboarded ? (
          <Stack.Screen name="Onboarding" component={OnboardingScreen} options={{ animationTypeForReplace: 'pop' }} />
        ) : (
          <Stack.Screen name="Main" component={MainTabs} />
        )}
        <Stack.Screen
          name="ReminderEdit"
          component={ReminderEditScreen}
          options={{
            gestureEnabled: true,
            cardStyleInterpolator: CardStyleInterpolators.forHorizontalIOS,
            transitionSpec: {
              open: { animation: 'spring', config: { stiffness: 900, damping: 90, mass: 2.4, overshootClamping: true } },
              close: { animation: 'spring', config: { stiffness: 900, damping: 90, mass: 2.4, overshootClamping: true } },
            },
          }}
        />
        <Stack.Screen
          name="Privacy"
          component={PrivacyScreen}
          options={{ cardStyleInterpolator: CardStyleInterpolators.forHorizontalIOS }}
        />
      </Stack.Navigator>

      <FullscreenReminder
        visible={!!activeReminder}
        reminder={activeReminder}
        settings={settings}
        onDone={() => dismissReminder(activeReminder)}
        onSnooze={() => snoozeReminder(activeReminder)}
        onIgnore={() => ignoreReminder(activeReminder)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    flexDirection: 'row',
    backgroundColor: Colors.white,
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
    paddingTop: 8,
    paddingHorizontal: 8,
  },
  tabItem: { flex: 1, alignItems: 'center', gap: 3 },
  iconWrap: { width: 60, height: 32, alignItems: 'center', justifyContent: 'center' },
  pill: { ...StyleSheet.absoluteFillObject, borderRadius: 16, backgroundColor: Colors.sea2 },
  tabLabel: { fontSize: 11, color: Colors.soft, fontWeight: '500' },
  tabLabelActive: { color: Colors.deeper, fontWeight: '700' },
});
