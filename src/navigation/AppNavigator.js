import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import Animated, {
  useSharedValue, useAnimatedStyle, withSpring,
} from 'react-native-reanimated';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Colors, Radii, Shadows } from '../utils/theme';
import HomeScreen from '../screens/HomeScreen';
import RemindersScreen from '../screens/RemindersScreen';
import FocusScreen from '../screens/FocusScreen';
import VoiceScreen from '../screens/VoiceScreen';
import SettingsScreen from '../screens/SettingsScreen';
import ReminderEditScreen from '../screens/ReminderEditScreen';
import FullscreenReminder from '../components/FullscreenReminder';
import { useApp } from '../store/AppContext';

const Tab = createBottomTabNavigator();
const Stack = createStackNavigator();

const TABS = [
  { name: 'Home', icon: 'home', label: 'Home' },
  { name: 'Reminders', icon: 'bell', label: 'Remind' },
  { name: 'Focus', icon: 'clock', label: 'Focus' },
  { name: 'Voice', icon: 'mic', label: 'Voice' },
];

function TabBar({ state, descriptors, navigation }) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.tabBar, { paddingBottom: insets.bottom + 8 }]}>
      {state.routes.map((route, index) => {
        const { options } = descriptors[route.key];
        const isFocused = state.index === index;
        const tab = TABS.find(t => t.name === route.name);

        const scale = useSharedValue(1);
        const dotOpacity = useSharedValue(isFocused ? 1 : 0);

        const handlePress = () => {
          scale.value = withSpring(0.88, { damping: 12 }, () => {
            scale.value = withSpring(1, { damping: 12 });
          });
          const event = navigation.emit({
            type: 'tabPress',
            target: route.key,
            canPreventDefault: true,
          });
          if (!isFocused && !event.defaultPrevented) {
            navigation.navigate(route.name);
          }
        };

        const iconStyle = useAnimatedStyle(() => ({
          transform: [{ scale: scale.value }],
        }));

        return (
          <Pressable key={route.key} onPress={handlePress} style={styles.tabItem}>
            <Animated.View style={[styles.tabIconWrap, isFocused && styles.tabIconActive, iconStyle]}>
              <Feather
                name={tab?.icon || 'circle'}
                size={18}
                color={isFocused ? Colors.seafoam : Colors.soft}
              />
            </Animated.View>
            <Text style={[styles.tabLabel, isFocused && styles.tabLabelActive]}>
              {tab?.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function MainTabs() {
  return (
    <Tab.Navigator
      tabBar={props => <TabBar {...props} />}
      screenOptions={{ headerShown: false }}
    >
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="Reminders" component={RemindersScreen} />
      <Tab.Screen name="Focus" component={FocusScreen} />
      <Tab.Screen name="Voice" component={VoiceScreen} />
    </Tab.Navigator>
  );
}

export default function AppNavigator() {
  const { state, dismissReminder, snoozeReminder, ignoreReminder } = useApp();
  const { activeReminder } = state;

  return (
    <>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="Main" component={MainTabs} />
        <Stack.Screen 
          name="ReminderEdit" 
          component={ReminderEditScreen} 
          options={{ presentation: 'card', gestureEnabled: true }}
        />
        <Stack.Screen
          name="Settings"
          component={SettingsScreen}
          options={{ presentation: 'modal', gestureEnabled: true }}
        />
      </Stack.Navigator>

      <FullscreenReminder
        visible={!!activeReminder}
        reminder={activeReminder}
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
    borderTopWidth: 0.5,
    borderTopColor: Colors.border,
    paddingTop: 10,
    paddingHorizontal: 8,
    ...Shadows.sm,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  tabIconWrap: {
    width: 40, height: 36,
    borderRadius: Radii.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabIconActive: {
    backgroundColor: Colors.sea,
  },
  tabLabel: {
    fontSize: 10,
    color: Colors.soft,
    letterSpacing: 0.3,
  },
  tabLabelActive: {
    color: Colors.seafoam,
    fontWeight: '500',
  },
});
