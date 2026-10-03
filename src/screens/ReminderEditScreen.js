import React, { useState, useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TextInput, Pressable, StatusBar,
  KeyboardAvoidingView, Platform, Alert,
} from 'react-native';
import Animated, { FadeIn, FadeOut, LinearTransition } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import DateTimePicker from '@react-native-community/datetimepicker';
import uuid from 'react-native-uuid';

import { Colors, Radii, Shadows } from '../utils/theme';
import { useApp } from '../store/AppContext';
import { CATEGORIES } from '../utils/categories';
import { nextOccurrence, describeRepeat, formatWhen, DAY_LABELS } from '../utils/schedule';
import { speak, stopSpeech } from '../utils/speech';
import PressButton from '../components/PressButton';

const TYPES = [
  { id: 'once', label: 'Once' },
  { id: 'daily', label: 'Daily' },
  { id: 'weekend', label: 'Weekends' },
  { id: 'custom', label: 'Custom' },
];
const UNITS = ['minutes', 'hours', 'days', 'weeks', 'months', 'years'];
const DAY_ORDER = [2, 3, 4, 5, 6, 7, 1]; // Mon..Sun (values match java.util.Calendar)

/** Next 5-minute mark at least a couple of minutes away. */
function defaultTime() {
  const d = new Date(Date.now() + 2 * 60 * 1000);
  d.setSeconds(0, 0);
  d.setMinutes(Math.ceil(d.getMinutes() / 5) * 5);
  return d.getTime();
}

function Stepper({ value, onChange, min, max, format }) {
  const step = (delta) => {
    const v = Math.min(max, Math.max(min, value + delta));
    if (v !== value) { Haptics.selectionAsync(); onChange(v); }
  };
  return (
    <View style={styles.stepper}>
      <Pressable onPress={() => step(-1)} style={styles.stepBtn} hitSlop={6}>
        <Feather name="minus" size={16} color={value <= min ? Colors.border : Colors.deep} />
      </Pressable>
      <Text style={styles.stepVal}>{format ? format(value) : value}</Text>
      <Pressable onPress={() => step(1)} style={styles.stepBtn} hitSlop={6}>
        <Feather name="plus" size={16} color={value >= max ? Colors.border : Colors.deep} />
      </Pressable>
    </View>
  );
}

function Section({ title, children, style }) {
  return (
    <View style={[styles.section, style]}>
      {title && <Text style={styles.sectionTitle}>{title}</Text>}
      {children}
    </View>
  );
}

export default function ReminderEditScreen({ navigation, route }) {
  const { state, addReminder, updateReminder, deleteReminder } = useApp();
  const editing = route.params?.reminder;
  const needsNewTime = route.params?.needsNewTime;

  const [form, setForm] = useState(() => ({
    text: route.params?.text || '',
    category: 'general',
    repeatType: 'once',
    repeatInterval: 1,
    repeatUnit: 'days',
    daysOfWeek: [],
    repeatCount: 0,
    burstInterval: 1,
    ...(editing || {}),
    scheduledTime: needsNewTime || !editing?.scheduledTime ? defaultTime() : editing.scheduledTime,
  }));
  const [picker, setPicker] = useState(null); // 'date' | 'time' | null
  const [speaking, setSpeaking] = useState(false);

  const set = (patch) => setForm(f => ({ ...f, ...patch }));
  const showDate = form.repeatType === 'once' || form.repeatType === 'custom';
  const isPast = form.repeatType === 'once' && form.scheduledTime <= Date.now();
  const weeklyNoDays = form.repeatType === 'custom' && form.repeatUnit === 'weeks' && form.daysOfWeek.length === 0;

  const summary = useMemo(() => {
    const next = nextOccurrence({ ...form, burstInterval: Math.max(1, form.burstInterval) });
    if (!next) return null;
    const rings = form.repeatCount > 0
      ? `Speaks ${form.repeatCount + 1} times, ${Math.max(1, form.burstInterval)} min apart.`
      : 'Speaks once.';
    const repeat = form.repeatType === 'once' ? 'One time only.' : `Then ${describeRepeat(form).toLowerCase()}.`;
    return { next: formatWhen(next), repeat, rings };
  }, [form]);

  const canSave = form.text.trim().length > 0 && !isPast;

  const save = () => {
    if (!canSave) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    stopSpeech();
    const reminder = {
      ...form,
      text: form.text.trim(),
      repeatInterval: Math.max(1, Number(form.repeatInterval) || 1),
      burstInterval: form.repeatCount > 0 ? Math.max(1, form.burstInterval) : 0,
      active: true, // saving a reminder means you want it to ring
    };
    navigation.goBack();
    if (editing) updateReminder(reminder);
    else addReminder({ ...reminder, id: uuid.v4(), createdAt: Date.now() });
  };

  const remove = () => {
    Alert.alert('Delete reminder?', form.text, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: () => { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning); navigation.goBack(); deleteReminder(editing.id); },
      },
    ]);
  };

  const preview = () => {
    if (speaking) { stopSpeech(); setSpeaking(false); return; }
    if (!form.text.trim()) return;
    setSpeaking(true);
    speak(form.text.trim(), state.settings, { onDone: () => setSpeaking(false) });
  };

  const toggleDay = (d) => {
    Haptics.selectionAsync();
    set({ daysOfWeek: form.daysOfWeek.includes(d) ? form.daysOfWeek.filter(x => x !== d) : [...form.daysOfWeek, d].sort() });
  };

  const onPicked = (e, date) => {
    const mode = picker;
    setPicker(null);
    if (!date || e.type === 'dismissed') return;
    const d = new Date(form.scheduledTime);
    if (mode === 'time') d.setHours(date.getHours(), date.getMinutes(), 0, 0);
    else d.setFullYear(date.getFullYear(), date.getMonth(), date.getDate());
    set({ scheduledTime: d.getTime() });
  };

  const when = new Date(form.scheduledTime);

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <StatusBar barStyle="dark-content" backgroundColor={Colors.mist} />
      <View style={styles.header}>
        <Pressable onPress={() => { stopSpeech(); navigation.goBack(); }} style={styles.iconBtn} hitSlop={8}>
          <Feather name="x" size={22} color={Colors.ink} />
        </Pressable>
        <Text style={styles.headerTitle}>{editing ? 'Edit reminder' : 'New reminder'}</Text>
        {editing ? (
          <Pressable onPress={remove} style={styles.iconBtn} hitSlop={8}>
            <Feather name="trash-2" size={19} color={Colors.coralDeep} />
          </Pressable>
        ) : <View style={styles.iconBtn} />}
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          {needsNewTime && (
            <View style={styles.banner}>
              <Feather name="info" size={15} color={Colors.deep} />
              <Text style={styles.bannerText}>That time has passed. Pick a new time to turn it back on.</Text>
            </View>
          )}

          {/* What */}
          <View style={[styles.textCard, Shadows.sm]}>
            <TextInput
              style={styles.textInput}
              placeholder="What should I say? e.g. Take your vitamin D"
              placeholderTextColor={Colors.soft}
              value={form.text}
              onChangeText={t => set({ text: t })}
              multiline
              autoFocus={!editing && !route.params?.text}
            />
            <Pressable onPress={preview} disabled={!form.text.trim()} style={[styles.hearBtn, !form.text.trim() && { opacity: 0.4 }]}>
              <Feather name={speaking ? 'square' : 'play'} size={13} color={Colors.deep} />
              <Text style={styles.hearText}>{speaking ? 'Stop' : 'Hear it'}</Text>
            </Pressable>
          </View>

          <Section title="Category">
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.catRow}>
              {CATEGORIES.map(c => {
                const sel = form.category === c.id;
                return (
                  <Pressable
                    key={c.id}
                    onPress={() => { Haptics.selectionAsync(); set({ category: c.id }); }}
                    style={[styles.cat, sel && { backgroundColor: c.color + '1C', borderColor: c.color }]}
                  >
                    <Text style={styles.catEmoji}>{c.emoji}</Text>
                    <Text style={[styles.catText, sel && { color: Colors.deeper }]}>{c.label}</Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </Section>

          <Section title="Repeat">
            <View style={styles.segment}>
              {TYPES.map(t => {
                const sel = form.repeatType === t.id;
                return (
                  <Pressable key={t.id} onPress={() => { Haptics.selectionAsync(); set({ repeatType: t.id }); }} style={[styles.seg, sel && styles.segSel]}>
                    <Text style={[styles.segText, sel && styles.segTextSel]}>{t.label}</Text>
                  </Pressable>
                );
              })}
            </View>

            <View style={styles.fieldRow}>
              {showDate && (
                <Pressable style={[styles.field, isPast && styles.fieldError]} onPress={() => setPicker('date')}>
                  <Feather name="calendar" size={16} color={Colors.seafoamDeep} />
                  <View>
                    <Text style={styles.fieldLabel}>{form.repeatType === 'custom' ? 'Starts' : 'Date'}</Text>
                    <Text style={styles.fieldValue}>{when.toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'short', year: when.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined })}</Text>
                  </View>
                </Pressable>
              )}
              <Pressable style={[styles.field, isPast && styles.fieldError]} onPress={() => setPicker('time')}>
                <Feather name="clock" size={16} color={Colors.seafoamDeep} />
                <View>
                  <Text style={styles.fieldLabel}>Time</Text>
                  <Text style={styles.fieldValue}>{when.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</Text>
                </View>
              </Pressable>
            </View>
            {isPast && <Text style={styles.error}>This time has already passed.</Text>}

            {form.repeatType === 'custom' && (
              <Animated.View entering={FadeIn.duration(200)} exiting={FadeOut.duration(150)} layout={LinearTransition.duration(200)} style={styles.customBox}>
                <View style={styles.everyRow}>
                  <Text style={styles.everyLabel}>Every</Text>
                  <Stepper value={form.repeatInterval} onChange={v => set({ repeatInterval: v })} min={1} max={99} />
                </View>
                <View style={styles.unitRow}>
                  {UNITS.map(u => {
                    const sel = form.repeatUnit === u;
                    return (
                      <Pressable key={u} onPress={() => { Haptics.selectionAsync(); set({ repeatUnit: u }); }} style={[styles.unit, sel && styles.unitSel]}>
                        <Text style={[styles.unitText, sel && styles.unitTextSel]}>{u}</Text>
                      </Pressable>
                    );
                  })}
                </View>
                {form.repeatUnit === 'weeks' && (
                  <View style={styles.daysRow}>
                    {DAY_ORDER.map(d => {
                      const sel = form.daysOfWeek.includes(d);
                      return (
                        <Pressable key={d} onPress={() => toggleDay(d)} style={[styles.day, sel && styles.daySel]}>
                          <Text style={[styles.dayText, sel && styles.dayTextSel]}>{DAY_LABELS[d - 1].slice(0, 2)}</Text>
                        </Pressable>
                      );
                    })}
                  </View>
                )}
                {weeklyNoDays && <Text style={styles.helper}>No days picked: repeats on the start day.</Text>}
              </Animated.View>
            )}
          </Section>

          <Section title="Ring again">
            <View style={[styles.card, Shadows.sm]}>
              <View style={styles.ringRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.ringTitle}>Extra rings</Text>
                  <Text style={styles.ringDesc}>Say it again if you need a nudge</Text>
                </View>
                <Stepper value={form.repeatCount} onChange={v => set({ repeatCount: v })} min={0} max={10} format={v => (v ? `${v}×` : 'Off')} />
              </View>
              {form.repeatCount > 0 && (
                <Animated.View entering={FadeIn.duration(200)} style={[styles.ringRow, styles.ringBorder]}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.ringTitle}>Gap</Text>
                    <Text style={styles.ringDesc}>Time between rings</Text>
                  </View>
                  <Stepper value={Math.max(1, form.burstInterval)} onChange={v => set({ burstInterval: v })} min={1} max={60} format={v => `${v} min`} />
                </Animated.View>
              )}
            </View>
          </Section>

          {summary && !isPast && (
            <View style={styles.summary}>
              <Feather name="volume-2" size={16} color={Colors.deep} style={{ marginTop: 2 }} />
              <Text style={styles.summaryText}>
                <Text style={{ fontWeight: '700' }}>First ring {summary.next}.</Text> {summary.repeat} {summary.rings}
              </Text>
            </View>
          )}
          <View style={{ height: 24 }} />
        </ScrollView>

        <View style={styles.footer}>
          <PressButton label={editing ? 'Save changes' : 'Create reminder'} onPress={save} size="lg" disabled={!canSave} />
        </View>
      </KeyboardAvoidingView>

      {picker && (
        <DateTimePicker value={when} mode={picker} display="default" onChange={onPicked} minimumDate={picker === 'date' && form.repeatType === 'once' ? new Date() : undefined} />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.mist },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, height: 56 },
  iconBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 22 },
  headerTitle: { fontFamily: 'Georgia', fontSize: 19, fontWeight: '600', color: Colors.deeper },
  content: { paddingHorizontal: 20, paddingTop: 4 },
  banner: {
    flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14, marginBottom: 14,
    backgroundColor: Colors.sea, borderRadius: Radii.lg, borderWidth: 1, borderColor: Colors.sea2,
  },
  bannerText: { flex: 1, fontSize: 13, color: Colors.deeper, lineHeight: 18 },

  textCard: { backgroundColor: Colors.white, borderRadius: 22, padding: 16, borderWidth: 1, borderColor: Colors.borderLight },
  textInput: { fontSize: 20, lineHeight: 27, color: Colors.ink, minHeight: 84, textAlignVertical: 'top', padding: 0 },
  hearBtn: {
    alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10,
    height: 32, paddingHorizontal: 12, borderRadius: Radii.full, backgroundColor: Colors.sea,
  },
  hearText: { fontSize: 13, color: Colors.deep, fontWeight: '600' },

  section: { marginTop: 24 },
  sectionTitle: { fontSize: 12, letterSpacing: 1.5, textTransform: 'uppercase', color: Colors.mid, fontWeight: '700', marginBottom: 10 },
  catRow: { gap: 8, paddingRight: 20 },
  cat: {
    flexDirection: 'row', alignItems: 'center', gap: 6, height: 40, paddingHorizontal: 14,
    borderRadius: Radii.full, backgroundColor: Colors.white, borderWidth: 1, borderColor: Colors.borderLight,
  },
  catEmoji: { fontSize: 16 },
  catText: { fontSize: 13, color: Colors.mid, fontWeight: '600' },

  segment: { flexDirection: 'row', padding: 4, backgroundColor: Colors.sea, borderRadius: Radii.full },
  seg: { flex: 1, height: 38, borderRadius: Radii.full, alignItems: 'center', justifyContent: 'center' },
  segSel: { backgroundColor: Colors.white, ...Shadows.sm },
  segText: { fontSize: 13, color: Colors.mid, fontWeight: '600' },
  segTextSel: { color: Colors.deeper },

  fieldRow: { flexDirection: 'row', gap: 10, marginTop: 12 },
  field: {
    flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14,
    backgroundColor: Colors.white, borderRadius: 18, borderWidth: 1, borderColor: Colors.borderLight,
  },
  fieldError: { borderColor: Colors.coral },
  fieldLabel: { fontSize: 11, color: Colors.soft, fontWeight: '600' },
  fieldValue: { fontSize: 15, color: Colors.ink, fontWeight: '600', marginTop: 1 },
  error: { color: Colors.coralDeep, fontSize: 13, marginTop: 8, marginLeft: 4 },

  customBox: { marginTop: 12, backgroundColor: Colors.white, borderRadius: 20, padding: 16, borderWidth: 1, borderColor: Colors.borderLight },
  everyRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  everyLabel: { fontSize: 15, fontWeight: '600', color: Colors.ink },
  unitRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 14 },
  unit: { height: 34, paddingHorizontal: 14, borderRadius: Radii.full, backgroundColor: Colors.sea, justifyContent: 'center' },
  unitSel: { backgroundColor: Colors.deep },
  unitText: { fontSize: 13, color: Colors.mid, fontWeight: '600' },
  unitTextSel: { color: Colors.white },
  daysRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 16 },
  day: { width: 38, height: 38, borderRadius: 19, backgroundColor: Colors.sea, alignItems: 'center', justifyContent: 'center' },
  daySel: { backgroundColor: Colors.seafoamDeep },
  dayText: { fontSize: 12, color: Colors.mid, fontWeight: '600' },
  dayTextSel: { color: Colors.white },
  helper: { fontSize: 12, color: Colors.soft, marginTop: 10 },

  card: { backgroundColor: Colors.white, borderRadius: 20, borderWidth: 1, borderColor: Colors.borderLight },
  ringRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16 },
  ringBorder: { borderTopWidth: 1, borderTopColor: Colors.borderLight },
  ringTitle: { fontSize: 15, fontWeight: '600', color: Colors.ink },
  ringDesc: { fontSize: 12, color: Colors.soft, marginTop: 2 },
  stepper: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.sea, borderRadius: Radii.full, height: 40 },
  stepBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  stepVal: { minWidth: 52, textAlign: 'center', fontSize: 15, fontWeight: '700', color: Colors.deeper },

  summary: {
    flexDirection: 'row', gap: 10, marginTop: 20, padding: 16,
    backgroundColor: Colors.sea, borderRadius: 18,
  },
  summaryText: { flex: 1, fontSize: 14, lineHeight: 20, color: Colors.deeper },
  footer: { paddingHorizontal: 20, paddingTop: 10, paddingBottom: 12, backgroundColor: Colors.mist },
});
