import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Modal, TextInput,
  Pressable, Switch, StatusBar, KeyboardAvoidingView, Platform,
} from 'react-native';
import Animated, {
  FadeInDown, FadeIn, useSharedValue, useAnimatedStyle,
  withSpring, withTiming, SlideInUp, SlideOutDown,
} from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import DateTimePicker from '@react-native-community/datetimepicker';
import uuid from 'react-native-uuid';

import { Colors, Radii, Shadows, Typography } from '../utils/theme';
import { useApp } from '../store/AppContext';
import ReminderCard from '../components/ReminderCard';
import PressButton from '../components/PressButton';
import FullscreenReminder from '../components/FullscreenReminder';

const MODES = ['Focus', 'Health', 'Study', 'Sleep', 'Gym'];
const MODE_COLORS = {
  Focus: Colors.seafoam, Health: Colors.coral, Study: Colors.petalDeep,
  Sleep: Colors.deep, Gym: Colors.jasmineDark,
};

const defaultForm = () => ({
  text: '',
  repeatType: 'daily', // once | daily | weekend | custom
  repeatInterval: 1, 
  repeatUnit: 'hours', // minutes | hours | days
  repeatCount: 1, 
  burstInterval: 1, 
  mode: 'Focus',
  escalation: true,
  untilDone: true,
  scheduledTime: Date.now(),
  active: true,
});

export default function RemindersScreen({ navigation }) {
  const { state, addReminder, updateReminder, deleteReminder, toggleReminder } = useApp();
  const { reminders } = state;

  const [showModal, setShowModal] = useState(false);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState(defaultForm());
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [fsReminder, setFsReminder] = useState(null);

  const fabScale = useSharedValue(1);
  const fabStyle = useAnimatedStyle(() => ({ transform: [{ scale: fabScale.value }] }));

  const openAdd = () => {
    setEditId(null);
    setForm(defaultForm());
    setShowModal(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const openEdit = (reminder) => {
    setEditId(reminder.id);
    setForm({
      text: reminder.text,
      repeatType: reminder.repeatType || 'daily',
      repeatInterval: reminder.repeatInterval || 1,
      repeatUnit: reminder.repeatUnit || 'hours',
      repeatCount: reminder.repeatCount || 1,
      burstInterval: reminder.burstInterval || 1,
      mode: reminder.mode || 'Focus',
      escalation: reminder.escalation ?? true,
      untilDone: reminder.untilDone ?? true,
      scheduledTime: reminder.scheduledTime || Date.now(),
      active: reminder.active,
    });
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.text.trim()) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    if (editId) {
      await updateReminder({ id: editId, ...form });
    } else {
      await addReminder({ id: uuid.v4(), ...form, createdAt: Date.now() });
    }
    setShowModal(false);

    // Close the screen after saving
    setTimeout(() => {
      if (navigation && navigation.canGoBack()) {
        navigation.goBack();
      } else {
        navigation?.navigate('Home');
      }
    }, 100);
  };

  const handleDelete = async (id) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    await deleteReminder(id);
  };

  const activeReminders = reminders.filter(r => r.active);
  const inactiveReminders = reminders.filter(r => !r.active);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <StatusBar barStyle="dark-content" />

      <Animated.View entering={FadeIn.duration(300)} style={styles.headerRow}>
        <View>
          <Text style={styles.pageTitle}>Reminders</Text>
          <Text style={styles.pageCount}>{reminders.length} total · {activeReminders.length} active</Text>
        </View>
        <Animated.View style={fabStyle}>
          <Pressable
            onPress={openAdd}
            onPressIn={() => { fabScale.value = withSpring(0.9); }}
            onPressOut={() => { fabScale.value = withSpring(1); }}
            style={styles.fab}
          >
            <Feather name="plus" size={20} color={Colors.white} />
          </Pressable>
        </Animated.View>
      </Animated.View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {reminders.length === 0 ? (
          <Animated.View entering={FadeIn.delay(200)} style={styles.empty}>
            <Text style={styles.emptyEmoji}>🔔</Text>
            <Text style={styles.emptyTitle}>No reminders yet</Text>
            <Text style={styles.emptyText}>Tap + to add your first reminder</Text>
          </Animated.View>
        ) : (
          <>
            {activeReminders.length > 0 && (
              <Animated.View entering={FadeInDown.delay(100)}>
                <Text style={styles.section}>Active</Text>
                {activeReminders.map((r, i) => (
                  <Animated.View key={r.id} entering={FadeInDown.delay(i * 50).duration(300)}>
                    <ReminderCard
                      reminder={r}
                      onToggle={toggleReminder}
                      onDelete={handleDelete}
                      onEdit={openEdit}
                      onTap={(r) => setFsReminder(r)}
                    />
                  </Animated.View>
                ))}
              </Animated.View>
            )}
            {inactiveReminders.length > 0 && (
              <Animated.View entering={FadeInDown.delay(200)}>
                <Text style={[styles.section, { marginTop: 10 }]}>Paused</Text>
                {inactiveReminders.map((r, i) => (
                  <Animated.View key={r.id} entering={FadeInDown.delay(i * 50)}>
                    <ReminderCard
                      reminder={r}
                      onToggle={toggleReminder}
                      onDelete={handleDelete}
                      onEdit={openEdit}
                    />
                  </Animated.View>
                ))}
              </Animated.View>
            )}
          </>
        )}
        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Add / Edit Modal */}
      <Modal
        visible={showModal}
        transparent
        animationType="slide"
        statusBarTranslucent
        onRequestClose={() => setShowModal(false)}
      >
        <Pressable style={styles.backdrop} onPress={() => setShowModal(false)} />
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalWrap}
        >
          <Animated.View entering={SlideInUp.springify().damping(20)} style={styles.sheet}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>{editId ? 'Edit reminder' : 'New reminder'}</Text>

            {/* Text */}
            <TextInput
              style={styles.textInput}
              placeholder="What should interrupt you?"
              placeholderTextColor={Colors.soft}
              value={form.text}
              onChangeText={t => setForm(f => ({ ...f, text: t }))}
              multiline
              autoFocus
            />

            {/* Repeat Type */}
            <Text style={styles.fieldLabel}>Repeat Type</Text>
            <View style={styles.segRow}>
              {['once', 'daily', 'weekend', 'custom'].map(type => (
                <Pressable
                  key={type}
                  onPress={() => { 
                    setForm(f => ({ ...f, repeatType: type, scheduledTime: f.scheduledTime || Date.now() })); 
                    Haptics.selectionAsync(); 
                  }}
                  style={[styles.seg, form.repeatType === type && styles.segActive]}
                >
                  <Text style={[styles.segText, form.repeatType === type && styles.segTextActive]}>
                    {type.charAt(0).toUpperCase() + type.slice(1)}
                  </Text>
                </Pressable>
              ))}
            </View>

            {/* Date/Time Picker Trigger */}
            <View style={{ flexDirection: 'row', gap: 10, marginBottom: 16 }}>
               <View style={{ flex: 1 }}>
                  <Text style={styles.fieldLabel}>Start Time</Text>
                  <Pressable style={styles.timeBtn} onPress={() => setShowTimePicker(true)}>
                    <Feather name="clock" size={14} color={Colors.mid} />
                    <Text style={styles.timeBtnText}>
                      {form.scheduledTime
                        ? new Date(form.scheduledTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                        : 'Set time'}
                    </Text>
                  </Pressable>
               </View>
               {(form.repeatType === 'once' || form.repeatType === 'custom') && (
                 <View style={{ flex: 1 }}>
                    <Text style={styles.fieldLabel}>Date</Text>
                    <Pressable style={styles.timeBtn} onPress={() => setShowDatePicker(true)}>
                      <Feather name="calendar" size={14} color={Colors.mid} />
                      <Text style={styles.timeBtnText}>
                        {form.scheduledTime
                          ? new Date(form.scheduledTime).toLocaleDateString([], { month: 'short', day: 'numeric' })
                          : 'Set date'}
                      </Text>
                    </Pressable>
                 </View>
               )}
            </View>

            {/* Custom Interval & Unit */}
            {form.repeatType === 'custom' && (
              <View style={{ marginBottom: 16 }}>
                <Text style={styles.fieldLabel}>Every...</Text>
                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <View style={[styles.intervalControl, { flex: 1, height: 44, paddingHorizontal: 12, backgroundColor: Colors.sea, borderRadius: Radii.md, borderWidth: 0.5, borderColor: Colors.border }]}>
                    <Pressable onPress={() => setForm(f => ({ ...f, repeatInterval: Math.max(1, f.repeatInterval - 1) }))}>
                      <Feather name="minus" size={16} color={Colors.mid} />
                    </Pressable>
                    <Text style={styles.intervalVal}>{form.repeatInterval}</Text>
                    <Pressable onPress={() => setForm(f => ({ ...f, repeatInterval: f.repeatInterval + 1 }))}>
                      <Feather name="plus" size={16} color={Colors.mid} />
                    </Pressable>
                  </View>
                  <View style={{ flexDirection: 'row', flex: 2, gap: 4 }}>
                    {['minutes', 'hours', 'days'].map(u => (
                      <Pressable
                        key={u}
                        onPress={() => setForm(f => ({ ...f, repeatUnit: u }))}
                        style={[styles.seg, { flex: 1 }, form.repeatUnit === u && styles.segActive]}
                      >
                        <Text style={[styles.segText, { fontSize: 11 }, form.repeatUnit === u && styles.segTextActive]}>{u}</Text>
                      </Pressable>
                    ))}
                  </View>
                </View>
              </View>
            )}

            {/* Burst Settings */}
            <View style={{ flexDirection: 'row', gap: 16, marginBottom: 16 }}>
               <View style={{ flex: 1 }}>
                  <Text style={styles.fieldLabel}>Repeat Count</Text>
                  <View style={styles.intervalControl}>
                    <Pressable onPress={() => setForm(f => ({ ...f, repeatCount: Math.max(1, f.repeatCount - 1) }))} style={styles.stepBtn}>
                      <Feather name="minus" size={14} color={Colors.mid} />
                    </Pressable>
                    <Text style={styles.intervalVal}>{form.repeatCount}x</Text>
                    <Pressable onPress={() => setForm(f => ({ ...f, repeatCount: Math.min(10, f.repeatCount + 1) }))} style={styles.stepBtn}>
                      <Feather name="plus" size={14} color={Colors.mid} />
                    </Pressable>
                  </View>
               </View>
               <View style={{ flex: 1 }}>
                  <Text style={styles.fieldLabel}>Burst (Mins)</Text>
                  <View style={styles.intervalControl}>
                    <Pressable onPress={() => setForm(f => ({ ...f, burstInterval: Math.max(1, f.burstInterval - 1) }))} style={styles.stepBtn}>
                      <Feather name="minus" size={14} color={Colors.mid} />
                    </Pressable>
                    <Text style={styles.intervalVal}>{form.burstInterval}m</Text>
                    <Pressable onPress={() => setForm(f => ({ ...f, burstInterval: Math.min(60, f.burstInterval + 1) }))} style={styles.stepBtn}>
                      <Feather name="plus" size={14} color={Colors.mid} />
                    </Pressable>
                  </View>
               </View>
            </View>

            {/* Mode */}
            <Text style={styles.fieldLabel}>Mode</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
              {MODES.map(mode => {
                const sel = form.mode === mode;
                const color = MODE_COLORS[mode];
                return (
                  <Pressable
                    key={mode}
                    onPress={() => { setForm(f => ({ ...f, mode })); Haptics.selectionAsync(); }}
                    style={[styles.modeChip, sel && { backgroundColor: color + '20', borderColor: color }]}
                  >
                    <Text style={[styles.modeText, sel && { color }]}>{mode}</Text>
                  </Pressable>
                );
              })}
            </ScrollView>

            {/* Toggles */}
            <View style={styles.toggleRow}>
              <View style={styles.toggleInfo}>
                <Text style={styles.toggleTitle}>Escalate intensity</Text>
                <Text style={styles.toggleDesc}>Gets louder if ignored</Text>
              </View>
              <Switch
                value={form.escalation}
                onValueChange={v => setForm(f => ({ ...f, escalation: v }))}
                trackColor={{ false: Colors.sea2, true: Colors.sea3 }}
                thumbColor={form.escalation ? Colors.seafoam : Colors.soft}
                ios_backgroundColor={Colors.sea2}
              />
            </View>
            <View style={styles.toggleRow}>
              <View style={styles.toggleInfo}>
                <Text style={styles.toggleTitle}>Until done</Text>
                <Text style={styles.toggleDesc}>Asks if you completed it</Text>
              </View>
              <Switch
                value={form.untilDone}
                onValueChange={v => setForm(f => ({ ...f, untilDone: v }))}
                trackColor={{ false: Colors.sea2, true: Colors.sea3 }}
                thumbColor={form.untilDone ? Colors.seafoam : Colors.soft}
                ios_backgroundColor={Colors.sea2}
              />
            </View>

            {/* Save */}
            <PressButton
              label={editId ? 'Save changes' : 'Create reminder'}
              onPress={handleSave}
              variant="primary"
              size="lg"
              style={{ marginTop: 8 }}
              disabled={!form.text.trim()}
            />
          </Animated.View>
        </KeyboardAvoidingView>
      </Modal>

      {showTimePicker && (
        <DateTimePicker
          value={form.scheduledTime ? new Date(form.scheduledTime) : new Date()}
          mode="time"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={(e, date) => {
            setShowTimePicker(false);
            if (date) {
               const newDate = new Date(form.scheduledTime || Date.now());
               newDate.setHours(date.getHours());
               newDate.setMinutes(date.getMinutes());
               setForm(f => ({ ...f, scheduledTime: newDate.getTime() }));
            }
          }}
        />
      )}

      {showDatePicker && (
        <DateTimePicker
          value={form.scheduledTime ? new Date(form.scheduledTime) : new Date()}
          mode="date"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={(e, date) => {
            setShowDatePicker(false);
            if (date) {
               const newDate = new Date(form.scheduledTime || Date.now());
               newDate.setFullYear(date.getFullYear());
               newDate.setMonth(date.getMonth());
               newDate.setDate(date.getDate());
               setForm(f => ({ ...f, scheduledTime: newDate.getTime() }));
            }
          }}
        />
      )}

      <FullscreenReminder
        visible={!!fsReminder}
        reminder={fsReminder}
        onDone={() => setFsReminder(null)}
        onSnooze={() => setFsReminder(null)}
        onIgnore={() => setFsReminder(null)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.mist },
  scroll: { flex: 1 },
  content: { paddingHorizontal: 20, paddingTop: 8 },
  headerRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingTop: 16, paddingBottom: 12,
  },
  pageTitle: { fontFamily: 'Georgia', fontSize: 26, fontWeight: '600', color: Colors.deeper },
  pageCount: { fontSize: 12, color: Colors.soft, marginTop: 2, letterSpacing: 0.3 },
  fab: {
    width: 42, height: 42, borderRadius: 21,
    backgroundColor: Colors.seafoam, alignItems: 'center', justifyContent: 'center',
    ...Shadows.md,
  },
  empty: { alignItems: 'center', paddingTop: 80 },
  emptyEmoji: { fontSize: 48, marginBottom: 16 },
  emptyTitle: { fontFamily: 'Georgia', fontSize: 20, color: Colors.deeper, marginBottom: 6 },
  emptyText: { fontSize: 14, color: Colors.soft },
  section: {
    fontSize: 10, letterSpacing: 0.8, textTransform: 'uppercase',
    color: Colors.soft, marginBottom: 10,
  },
  backdrop: { flex: 1, backgroundColor: 'rgba(42,56,48,0.3)' },
  modalWrap: { justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: Colors.white, borderTopLeftRadius: Radii.xl,
    borderTopRightRadius: Radii.xl, padding: 24, paddingBottom: 40,
    ...Shadows.lg,
  },
  sheetHandle: {
    width: 36, height: 3, borderRadius: 2, backgroundColor: Colors.border,
    alignSelf: 'center', marginBottom: 20,
  },
  sheetTitle: { fontFamily: 'Georgia', fontSize: 22, color: Colors.deeper, marginBottom: 20 },
  textInput: {
    backgroundColor: Colors.sea, borderRadius: Radii.md, padding: 14,
    fontSize: 16, color: Colors.ink, marginBottom: 20, minHeight: 80,
    textAlignVertical: 'top', borderWidth: 0.5, borderColor: Colors.sea3,
    fontWeight: '300',
  },
  fieldLabel: {
    fontSize: 10, letterSpacing: 0.8, textTransform: 'uppercase',
    color: Colors.soft, marginBottom: 8,
  },
  segRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  seg: {
    flex: 1, paddingVertical: 10, borderRadius: Radii.md,
    backgroundColor: Colors.sea, borderWidth: 0.5, borderColor: Colors.border,
    alignItems: 'center',
  },
  segActive: { backgroundColor: Colors.seafoam + '20', borderColor: Colors.seafoam },
  segText: { fontSize: 13, color: Colors.mid },
  segTextActive: { color: Colors.deep, fontWeight: '500' },
  intervalRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  intervalControl: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  stepBtn: {
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: Colors.sea, borderWidth: 0.5, borderColor: Colors.border,
    alignItems: 'center', justifyContent: 'center',
  },
  intervalVal: { fontSize: 16, fontWeight: '500', color: Colors.ink, minWidth: 36, textAlign: 'center' },
  timeBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: Colors.sea, borderRadius: Radii.md, padding: 12,
    borderWidth: 0.5, borderColor: Colors.border, marginBottom: 16,
  },
  timeBtnText: { fontSize: 14, color: Colors.ink },
  modeChip: {
    paddingHorizontal: 16, paddingVertical: 8,
    backgroundColor: Colors.sea, borderRadius: Radii.full,
    borderWidth: 0.5, borderColor: Colors.border, marginRight: 8,
  },
  modeText: { fontSize: 13, color: Colors.mid, letterSpacing: 0.3 },
  toggleRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 14, borderBottomWidth: 0.5, borderBottomColor: Colors.borderLight,
  },
  toggleInfo: { flex: 1 },
  toggleTitle: { fontSize: 14, color: Colors.ink, fontWeight: '400' },
  toggleDesc: { fontSize: 12, color: Colors.soft, marginTop: 2 },
});
