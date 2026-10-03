import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, Pressable, StatusBar, Keyboard } from 'react-native';
import Animated, { FadeIn, FadeInDown, FadeOut, LinearTransition } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import uuid from 'react-native-uuid';

import { Colors, Radii, Shadows } from '../utils/theme';
import { useApp } from '../store/AppContext';
import { getCategory } from '../utils/categories';
import { nextOccurrence, describeRepeat, formatWhen, formatCountdown, formatTime, formatDay } from '../utils/schedule';
import Logo from '../components/Logo';
import { usePermissions } from '../utils/permissions';

function greeting(h) {
  if (h < 5) return 'Good night';
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

/** One-tap times for the quick add bar. */
function quickTimes(now) {
  const d = new Date(now);
  const at = (days, h, m = 0) => {
    const x = new Date(d); x.setDate(x.getDate() + days); x.setHours(h, m, 0, 0); return x.getTime();
  };
  const options = [
    { label: 'In 10 min', time: now + 10 * 60 * 1000 },
    { label: 'In 1 hour', time: now + 60 * 60 * 1000 },
  ];
  if (d.getHours() < 19) options.push({ label: 'Tonight 8 PM', time: at(0, 20) });
  options.push({ label: 'Tomorrow 9 AM', time: at(1, 9) });
  return options;
}

export default function HomeScreen({ navigation }) {
  const { state, addReminder, updateSettings } = useApp();
  const { reminders, settings } = state;
  const [now, setNow] = useState(Date.now());
  const [quickText, setQuickText] = useState('');
  const [added, setAdded] = useState(null);
  const { missing } = usePermissions();
  // Warn only about permissions the user hasn't already chosen to ignore
  const hidden = settings.dismissedPermissionWarnings || [];
  const warnAbout = missing.filter(p => !hidden.includes(p.key));
  const dismissWarning = () => {
    Haptics.selectionAsync();
    updateSettings({ dismissedPermissionWarnings: [...new Set([...hidden, ...warnAbout.map(p => p.key)])] });
  };

  // Keep countdowns fresh without re-rendering constantly
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30 * 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (!added) return;
    const t = setTimeout(() => setAdded(null), 2600);
    return () => clearTimeout(t);
  }, [added]);

  const upcoming = useMemo(() => reminders
    .filter(r => r.active)
    .map(r => ({ r, at: nextOccurrence(r, now) }))
    .filter(x => x.at)
    .sort((a, b) => a.at - b.at), [reminders, now]);

  const hero = upcoming[0];
  const rest = upcoming.slice(1, 6);
  const activeCount = reminders.filter(r => r.active).length;

  const quickAdd = (time) => {
    const text = quickText.trim();
    if (!text) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    addReminder({
      id: uuid.v4(),
      text,
      category: 'general',
      repeatType: 'once',
      scheduledTime: time,
      repeatInterval: 1,
      repeatUnit: 'hours',
      daysOfWeek: [],
      repeatCount: 0,
      burstInterval: 0,
      active: true,
      createdAt: Date.now(),
    });
    setQuickText('');
    Keyboard.dismiss();
    setAdded(formatWhen(time));
  };

  const openEditor = (params) => navigation.navigate('ReminderEdit', params);
  const today = new Date(now);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <StatusBar barStyle="dark-content" backgroundColor={Colors.mist} />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <Animated.View entering={FadeIn.duration(350)} style={styles.header}>
          <Logo size={46} tile />
          <View style={{ flex: 1 }}>
            <Text style={styles.greeting}>{greeting(today.getHours())}</Text>
            <Text style={styles.date}>
              {today.toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'long' })}
            </Text>
          </View>
          <View style={styles.countPill}>
            <View style={styles.countDot} />
            <Text style={styles.countText}>{activeCount} on</Text>
          </View>
        </Animated.View>

        {warnAbout.length > 0 && (
          <Animated.View entering={FadeInDown.duration(350)} exiting={FadeOut.duration(200)} style={styles.warn}>
            <Feather name="alert-triangle" size={16} color={Colors.coralDeep} />
            <Text style={styles.warnText}>
              {warnAbout.length === 1 ? `${warnAbout[0].title} is off` : `${warnAbout.length} permissions are off`}. Reminders may not ring.
            </Text>
            <Pressable onPress={() => navigation.navigate('Settings')} hitSlop={8}>
              <Text style={styles.warnFix}>Fix</Text>
            </Pressable>
            <Pressable onPress={dismissWarning} hitSlop={10} style={styles.warnClose}>
              <Feather name="x" size={16} color={Colors.mid} />
            </Pressable>
          </Animated.View>
        )}

        {/* Next up */}
        <Animated.View entering={FadeInDown.delay(60).duration(400)}>
          {hero ? (
            <Pressable onPress={() => openEditor({ reminder: hero.r })}>
              <LinearGradient colors={['#0B2421', '#1A4A40', '#2D6B5F']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.hero, Shadows.md]}>
                <View style={styles.heroTop}>
                  <Text style={styles.heroEyebrow}>NEXT UP</Text>
                  <View style={styles.heroBadge}>
                    <Feather name="volume-2" size={12} color="#A8F0DC" />
                    <Text style={styles.heroBadgeText}>{formatCountdown(hero.at, now)}</Text>
                  </View>
                </View>
                <View style={styles.heroBody}>
                  <Text style={styles.heroEmoji}>{getCategory(hero.r.category).emoji}</Text>
                  <Text style={styles.heroText} numberOfLines={3}>{hero.r.text}</Text>
                </View>
                <View style={styles.heroFoot}>
                  <Text style={styles.heroTime}>{formatWhen(hero.at, now)}</Text>
                  <Text style={styles.heroRepeat}>{describeRepeat(hero.r)}</Text>
                </View>
              </LinearGradient>
            </Pressable>
          ) : (
            <Pressable onPress={() => openEditor()} style={[styles.empty, Shadows.sm]}>
              <View style={styles.emptyIcon}><Feather name="plus" size={22} color={Colors.deep} /></View>
              <View style={{ flex: 1 }}>
                <Text style={styles.emptyTitle}>Nothing scheduled</Text>
                <Text style={styles.emptyText}>Create a reminder and it will be read out loud at the right time.</Text>
              </View>
            </Pressable>
          )}
        </Animated.View>

        {/* Quick add */}
        <Animated.View entering={FadeInDown.delay(120).duration(400)} layout={LinearTransition.duration(250)} style={[styles.quick, Shadows.sm]}>
          <View style={styles.quickRow}>
            <Feather name="mic" size={18} color={Colors.seafoamDeep} />
            <TextInput
              style={styles.quickInput}
              placeholder="Remind me to…"
              placeholderTextColor={Colors.soft}
              value={quickText}
              onChangeText={setQuickText}
              returnKeyType="done"
            />
          </View>
          {quickText.trim().length > 0 && (
            <Animated.View entering={FadeIn.duration(200)} exiting={FadeOut.duration(150)}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips} keyboardShouldPersistTaps="handled">
                {quickTimes(Date.now()).map(o => (
                  <Pressable key={o.label} onPress={() => quickAdd(o.time)} style={styles.chip}>
                    <Text style={styles.chipText}>{o.label}</Text>
                  </Pressable>
                ))}
                <Pressable
                  onPress={() => { const text = quickText.trim(); setQuickText(''); openEditor({ text }); }}
                  style={[styles.chip, styles.chipMore]}
                >
                  <Text style={[styles.chipText, { color: Colors.white }]}>More options</Text>
                  <Feather name="arrow-right" size={13} color={Colors.white} />
                </Pressable>
              </ScrollView>
            </Animated.View>
          )}
          {added && (
            <Animated.View entering={FadeIn.duration(200)} exiting={FadeOut.duration(200)} style={styles.addedRow}>
              <Feather name="check-circle" size={14} color={Colors.seafoamDeep} />
              <Text style={styles.addedText}>Added for {added}</Text>
            </Animated.View>
          )}
        </Animated.View>

        {/* Coming up */}
        {rest.length > 0 && (
          <Animated.View entering={FadeInDown.delay(180).duration(400)}>
            <View style={styles.sectionHeader}>
              <Text style={styles.section}>Coming up</Text>
              <Pressable onPress={() => navigation.navigate('Reminders')} hitSlop={10}>
                <Text style={styles.seeAll}>See all</Text>
              </Pressable>
            </View>
            <View style={[styles.list, Shadows.sm]}>
              {rest.map(({ r, at }, i) => (
                <Pressable
                  key={r.id}
                  onPress={() => openEditor({ reminder: r })}
                  style={({ pressed }) => [styles.item, i > 0 && styles.itemBorder, pressed && { backgroundColor: Colors.sea }]}
                >
                  <View style={styles.itemTime}>
                    <Text style={styles.itemClock}>{formatTime(at)}</Text>
                    <Text style={styles.itemDay} numberOfLines={1}>{formatDay(at, now)}</Text>
                  </View>
                  <View style={[styles.itemDot, { backgroundColor: getCategory(r.category).color }]} />
                  <Text style={styles.itemText} numberOfLines={1}>{r.text}</Text>
                  <Text style={styles.itemEmoji}>{getCategory(r.category).emoji}</Text>
                </Pressable>
              ))}
            </View>
          </Animated.View>
        )}

        <View style={{ height: 120 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.mist },
  content: { paddingHorizontal: 20, paddingTop: 12 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 22 },
  greeting: { fontFamily: 'Georgia', fontSize: 24, fontWeight: '600', color: Colors.deeper },
  date: { fontSize: 13, color: Colors.mid, marginTop: 2 },
  countPill: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: Colors.white, borderRadius: Radii.full, borderWidth: 1, borderColor: Colors.borderLight,
    paddingHorizontal: 12, height: 32,
  },
  countDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: Colors.seafoam },
  countText: { fontSize: 12, color: Colors.deep, fontWeight: '600' },

  warn: {
    flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14, marginBottom: 14,
    backgroundColor: '#FDF1ED', borderRadius: 18, borderWidth: 1, borderColor: '#F8D3C7',
  },
  warnText: { flex: 1, fontSize: 13, color: Colors.ink, lineHeight: 18 },
  warnFix: { fontSize: 13, fontWeight: '800', color: Colors.coralDeep },
  warnClose: { marginLeft: 2, padding: 2 },
  hero: { borderRadius: 26, padding: 22, marginBottom: 16, overflow: 'hidden' },
  heroTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  heroEyebrow: { fontSize: 11, letterSpacing: 3, color: 'rgba(168,240,220,0.8)', fontWeight: '700' },
  heroBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 999, paddingHorizontal: 10, height: 26,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)',
  },
  heroBadgeText: { color: '#E8FFF8', fontSize: 12, fontWeight: '600' },
  heroBody: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginTop: 18 },
  heroEmoji: { fontSize: 30, marginTop: 2 },
  heroText: { flex: 1, fontFamily: 'Georgia', fontSize: 25, lineHeight: 32, color: '#fff' },
  heroFoot: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginTop: 22, paddingTop: 14, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.12)',
  },
  heroTime: { color: '#fff', fontSize: 15, fontWeight: '600' },
  heroRepeat: { color: 'rgba(255,255,255,0.65)', fontSize: 13 },

  empty: {
    flexDirection: 'row', alignItems: 'center', gap: 16,
    backgroundColor: Colors.white, borderRadius: 24, padding: 20, marginBottom: 16,
    borderWidth: 1, borderColor: Colors.borderLight,
  },
  emptyIcon: { width: 48, height: 48, borderRadius: 16, backgroundColor: Colors.sea, alignItems: 'center', justifyContent: 'center' },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: Colors.deeper },
  emptyText: { fontSize: 13, color: Colors.mid, marginTop: 3, lineHeight: 18 },

  quick: {
    backgroundColor: Colors.white, borderRadius: 22, padding: 6, marginBottom: 26,
    borderWidth: 1, borderColor: Colors.borderLight,
  },
  quickRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12 },
  quickInput: { flex: 1, fontSize: 16, color: Colors.ink, paddingVertical: 12 },
  chips: { gap: 8, paddingHorizontal: 8, paddingBottom: 8, paddingTop: 2 },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    height: 36, paddingHorizontal: 14, borderRadius: 999,
    backgroundColor: Colors.sea, borderWidth: 1, borderColor: Colors.sea2,
  },
  chipMore: { backgroundColor: Colors.deep, borderColor: Colors.deep },
  chipText: { fontSize: 13, color: Colors.deeper, fontWeight: '600' },
  addedRow: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingBottom: 10 },
  addedText: { fontSize: 13, color: Colors.seafoamDeep, fontWeight: '500' },

  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  section: { fontSize: 12, letterSpacing: 1.5, textTransform: 'uppercase', color: Colors.mid, fontWeight: '700' },
  seeAll: { fontSize: 13, color: Colors.seafoamDeep, fontWeight: '600' },
  list: { backgroundColor: Colors.white, borderRadius: 22, borderWidth: 1, borderColor: Colors.borderLight, overflow: 'hidden' },
  item: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 14 },
  itemBorder: { borderTopWidth: 1, borderTopColor: Colors.borderLight },
  itemTime: { width: 70 },
  itemClock: { fontSize: 14, fontWeight: '700', color: Colors.deeper },
  itemDay: { fontSize: 11, color: Colors.soft, marginTop: 1 },
  itemDot: { width: 6, height: 6, borderRadius: 3 },
  itemText: { flex: 1, fontSize: 15, color: Colors.ink },
  itemEmoji: { fontSize: 16 },
});
