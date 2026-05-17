import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TextInput,
  Pressable, Switch, StatusBar, KeyboardAvoidingView, Platform, Modal,
} from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import DateTimePicker from '@react-native-community/datetimepicker';
import uuid from 'react-native-uuid';

import { Colors, Radii, Shadows } from '../utils/theme';
import { useApp } from '../store/AppContext';
import PressButton from '../components/PressButton';

const MODES = ['Focus', 'Health', 'Study', 'Sleep', 'Gym'];
const MODE_COLORS = {
  Focus: Colors.seafoam, Health: Colors.coral, Study: Colors.petalDeep,
  Sleep: Colors.deep, Gym: Colors.jasmineDark,
};

const DAYS = [
  { label: 'S', val: 1 },
  { label: 'M', val: 2 },
  { label: 'T', val: 3 },
  { label: 'W', val: 4 },
  { label: 'T', val: 5 },
  { label: 'F', val: 6 },
  { label: 'S', val: 7 },
];

const UNITS = ['minutes', 'hours', 'days', 'weeks', 'months', 'years'];

export default function ReminderEditScreen({ navigation, route }) {
  const { addReminder, updateReminder } = useApp();
  const editReminder = route.params?.reminder;

  const [form, setForm] = useState({
    text: '',
    repeatType: 'daily',
    repeatInterval: 1,
    repeatUnit: 'hours',
    daysOfWeek: [],
    repeatCount: 1,
    burstInterval: 1,
    mode: 'Focus',
    escalation: true,
    untilDone: true,
    scheduledTime: Date.now(),
    active: true,
  });

  const [showTimePicker, setShowTimePicker] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showUnitPicker, setShowUnitPicker] = useState(false);
  const [intervalInput, setIntervalInput] = useState(String(form.repeatInterval));

  useEffect(() => {
    if (editReminder) {
      setForm({
        ...editReminder,
        scheduledTime: editReminder.scheduledTime || Date.now(),
        daysOfWeek: editReminder.daysOfWeek || [],
      });
      setIntervalInput(String(editReminder.repeatInterval || 1));
    }
  }, [editReminder]);

  const handleSave = async () => {
    if (!form.text.trim()) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    
    // Ensure repeatInterval is valid before saving
    const finalInterval = parseInt(intervalInput, 10) || 1;
    const finalForm = { ...form, repeatInterval: finalInterval };

    if (editReminder) {
      updateReminder(finalForm);
    } else {
      addReminder({ id: uuid.v4(), ...finalForm, createdAt: Date.now() });
    }
    
    // Close screen immediately
    navigation.goBack();
  };

  const toggleDay = (day) => {
    setForm(f => {
      const days = f.daysOfWeek || [];
      const newDays = days.includes(day) 
        ? days.filter(d => d !== day) 
        : [...days, day].sort();
      return { ...f, daysOfWeek: newDays };
    });
    Haptics.selectionAsync();
  };

  const updateInterval = (val) => {
    const newVal = Math.max(1, val);
    setForm(f => ({ ...f, repeatInterval: newVal }));
    setIntervalInput(String(newVal));
  };

  return (
    <View style={styles.safe}>
      <SafeAreaView style={styles.safe} edges={['top']}>
        <StatusBar barStyle="dark-content" />
        
        <View style={styles.header}>
          <Pressable onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Feather name="arrow-left" size={24} color={Colors.ink} />
          </Pressable>
          <Text style={styles.headerTitle}>{editReminder ? 'Edit Reminder' : 'New Reminder'}</Text>
          <View style={{ width: 40 }} />
        </View>

        <KeyboardAvoidingView 
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={{ flex: 1 }}
        >
          <ScrollView 
            style={styles.scroll} 
            contentContainerStyle={styles.content}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {/* Main Text Input - Larger and prominent */}
            <Text style={styles.fieldLabel}>What should interrupt you?</Text>
            <TextInput
              style={styles.textInput}
              placeholder="E.g., Drink water, Stretch, Meditate..."
              placeholderTextColor={Colors.soft}
              value={form.text}
              onChangeText={t => setForm(f => ({ ...f, text: t }))}
              multiline
              autoFocus={!editReminder}
              blurOnSubmit={false}
            />

            <Animated.View entering={FadeIn.delay(100)}>
              {/* Repeat Type Selection */}
              <Text style={styles.fieldLabel}>Repeat Type</Text>
              <View style={styles.segRow}>
                {['once', 'daily', 'weekend', 'custom'].map(type => (
                  <Pressable
                    key={type}
                    onPress={() => { 
                      setForm(f => ({ ...f, repeatType: type })); 
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

              {/* Date & Time Selection */}
              <View style={styles.dateTimeRow}>
                 <View style={{ flex: 1 }}>
                    <Text style={styles.fieldLabel}>Start Time</Text>
                    <Pressable style={styles.timeBtn} onPress={() => setShowTimePicker(true)}>
                      <Feather name="clock" size={14} color={Colors.mid} />
                      <Text style={styles.timeBtnText}>
                        {new Date(form.scheduledTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </Text>
                    </Pressable>
                 </View>
                 {(form.repeatType === 'once' || form.repeatType === 'custom') && (
                   <View style={{ flex: 1 }}>
                      <Text style={styles.fieldLabel}>Start Date</Text>
                      <Pressable style={styles.timeBtn} onPress={() => setShowDatePicker(true)}>
                        <Feather name="calendar" size={14} color={Colors.mid} />
                        <Text style={styles.timeBtnText}>
                          {new Date(form.scheduledTime).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}
                        </Text>
                      </Pressable>
                   </View>
                 )}
              </View>

              {/* Custom Recurrence Logic */}
              {form.repeatType === 'custom' && (
                <View style={styles.sectionCard}>
                  <Text style={styles.fieldLabel}>Custom Recurrence</Text>
                  <View style={{ flexDirection: 'row', gap: 10, zIndex: 10, marginBottom: 16 }}>
                    <View style={styles.intervalBox}>
                      <Pressable onPress={() => {
                        const current = parseInt(intervalInput, 10) || 1;
                        const newVal = Math.max(1, current - 1);
                        updateInterval(newVal);
                      }}>
                        <Feather name="minus" size={16} color={Colors.mid} />
                      </Pressable>
                      <TextInput
                        style={styles.intervalInput}
                        value={intervalInput}
                        onChangeText={t => {
                          const sanitized = t.replace(/[^0-9]/g, '');
                          setIntervalInput(sanitized);
                          if (sanitized !== '') {
                            const val = parseInt(sanitized, 10);
                            setForm(f => ({ ...f, repeatInterval: val }));
                          }
                        }}
                        onBlur={() => {
                          if (intervalInput === '' || parseInt(intervalInput, 10) === 0) {
                            updateInterval(1);
                          }
                        }}
                        keyboardType="number-pad"
                        selectTextOnFocus
                      />
                      <Pressable onPress={() => {
                        const current = parseInt(intervalInput, 10) || 1;
                        const newVal = current + 1;
                        updateInterval(newVal);
                      }}>
                        <Feather name="plus" size={16} color={Colors.mid} />
                      </Pressable>
                    </View>
                    
                    <View style={{ flex: 1.5 }}>
                      <Pressable 
                        onPress={() => { setShowUnitPicker(true); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}
                        style={[styles.unitDropdown, showUnitPicker && styles.unitDropdownActive]}
                      >
                        <Text style={styles.unitDropdownText}>{form.repeatUnit}</Text>
                        <Feather name="chevron-down" size={14} color={Colors.mid} />
                      </Pressable>
                      
                      <Modal
                        visible={showUnitPicker}
                        transparent
                        animationType="fade"
                        onRequestClose={() => setShowUnitPicker(false)}
                      >
                        <Pressable 
                          style={styles.modalBackdrop} 
                          onPress={() => setShowUnitPicker(false)} 
                        />
                        <View style={styles.modalCenter}>
                          <View style={styles.unitMenuModal}>
                            <Text style={styles.modalTitle}>Select Unit</Text>
                            <ScrollView style={{ maxHeight: 300 }} keyboardShouldPersistTaps="handled">
                              {UNITS.map(u => (
                                <Pressable
                                  key={u}
                                  onPress={() => { 
                                    setForm(f => ({ ...f, repeatUnit: u })); 
                                    setShowUnitPicker(false); 
                                    Haptics.selectionAsync(); 
                                  }}
                                  style={[styles.unitItem, form.repeatUnit === u && styles.unitItemActive]}
                                >
                                  <Text style={[styles.unitItemText, form.repeatUnit === u && styles.unitItemTextActive]}>
                                    {u.charAt(0).toUpperCase() + u.slice(1)}
                                  </Text>
                                  {form.repeatUnit === u && <Feather name="check" size={16} color={Colors.seafoam} />}
                                </Pressable>
                              ))}
                            </ScrollView>
                            <PressButton 
                              label="Cancel" 
                              onPress={() => setShowUnitPicker(false)} 
                              variant="secondary" 
                              style={{ marginTop: 16 }}
                            />
                          </View>
                        </View>
                      </Modal>
                    </View>
                  </View>

                  {form.repeatUnit === 'weeks' && (
                    <View>
                      <Text style={styles.subLabel}>Repeat on</Text>
                      <View style={styles.daysRow}>
                        {DAYS.map(d => {
                          const sel = (form.daysOfWeek || []).includes(d.val);
                          return (
                            <Pressable
                              key={d.val}
                              onPress={() => toggleDay(d.val)}
                              style={[styles.dayCircle, sel && styles.dayCircleActive]}
                            >
                              <Text style={[styles.dayText, sel && styles.dayTextActive]}>{d.label}</Text>
                            </Pressable>
                          );
                        })}
                      </View>
                    </View>
                  )}
                </View>
              )}

              {/* Burst Settings */}
              <View style={styles.burstContainer}>
                 <View style={{ flex: 1 }}>
                    <Text style={styles.fieldLabel}>Repeat Count</Text>
                    <View style={styles.stepControl}>
                      <Pressable onPress={() => setForm(f => ({ ...f, repeatCount: Math.max(1, f.repeatCount - 1) }))} style={styles.stepBtn}>
                        <Feather name="minus" size={14} color={Colors.mid} />
                      </Pressable>
                      <Text style={styles.stepVal}>{form.repeatCount}x</Text>
                      <Pressable onPress={() => setForm(f => ({ ...f, repeatCount: Math.min(10, f.repeatCount + 1) }))} style={styles.stepBtn}>
                        <Feather name="plus" size={14} color={Colors.mid} />
                      </Pressable>
                    </View>
                 </View>
                 <View style={{ flex: 1 }}>
                    <Text style={styles.fieldLabel}>Burst (Mins)</Text>
                    <View style={styles.stepControl}>
                      <Pressable onPress={() => setForm(f => ({ ...f, burstInterval: Math.max(1, f.burstInterval - 1) }))} style={styles.stepBtn}>
                        <Feather name="minus" size={14} color={Colors.mid} />
                      </Pressable>
                      <Text style={styles.stepVal}>{form.burstInterval}m</Text>
                      <Pressable onPress={() => setForm(f => ({ ...f, burstInterval: Math.min(60, f.burstInterval + 1) }))} style={styles.stepBtn}>
                        <Feather name="plus" size={14} color={Colors.mid} />
                      </Pressable>
                    </View>
                 </View>
              </View>

              {/* Mode Selection */}
              <Text style={styles.fieldLabel}>Activity Mode</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.modeScroll}>
                {MODES.map(mode => {
                  const sel = form.mode === mode;
                  const color = MODE_COLORS[mode];
                  return (
                    <Pressable
                      key={mode}
                      onPress={() => { setForm(f => ({ ...f, mode })); Haptics.selectionAsync(); }}
                      style={[styles.modeChip, sel && { backgroundColor: color + '15', borderColor: color }]}
                    >
                      <Text style={[styles.modeText, sel && { color, fontWeight: '600' }]}>{mode}</Text>
                    </Pressable>
                  );
                })}
              </ScrollView>

              {/* Switches */}
              <View style={styles.switchesBlock}>
                <View style={styles.toggleRow}>
                  <View>
                    <Text style={styles.toggleTitle}>Escalate intensity</Text>
                    <Text style={styles.toggleDesc}>Increases volume if ignored</Text>
                  </View>
                  <Switch
                    value={form.escalation}
                    onValueChange={v => setForm(f => ({ ...f, escalation: v }))}
                    trackColor={{ false: Colors.sea2, true: Colors.sea3 }}
                    thumbColor={form.escalation ? Colors.seafoam : Colors.soft}
                  />
                </View>
                <View style={[styles.toggleRow, { borderBottomWidth: 0 }]}>
                  <View>
                    <Text style={styles.toggleTitle}>Completion check</Text>
                    <Text style={styles.toggleDesc}>Ensures task is actually done</Text>
                  </View>
                  <Switch
                    value={form.untilDone}
                    onValueChange={v => setForm(f => ({ ...f, untilDone: v }))}
                    trackColor={{ false: Colors.sea2, true: Colors.sea3 }}
                    thumbColor={form.untilDone ? Colors.seafoam : Colors.soft}
                  />
                </View>
              </View>
            </Animated.View>
            
            <View style={{ height: 40 }} />
          </ScrollView>
          
          <View style={styles.footer}>
            <PressButton
              label={editReminder ? 'Save Changes' : 'Create Reminder'}
              onPress={handleSave}
              variant="primary"
              size="lg"
              disabled={!form.text.trim()}
            />
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>

      {showTimePicker && (
        <DateTimePicker
          value={new Date(form.scheduledTime)}
          mode="time"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={(e, date) => {
            setShowTimePicker(false);
            if (date && e.type !== 'dismissed') {
               const current = new Date(form.scheduledTime);
               current.setHours(date.getHours());
               current.setMinutes(date.getMinutes());
               current.setSeconds(0);
               setForm(f => ({ ...f, scheduledTime: current.getTime() }));
            }
          }}
        />
      )}

      {showDatePicker && (
        <DateTimePicker
          value={new Date(form.scheduledTime)}
          mode="date"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={(e, date) => {
            setShowDatePicker(false);
            if (date && e.type !== 'dismissed') {
               const current = new Date(form.scheduledTime);
               current.setFullYear(date.getFullYear());
               current.setMonth(date.getMonth());
               current.setDate(date.getDate());
               setForm(f => ({ ...f, scheduledTime: current.getTime() }));
            }
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.mist },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12, backgroundColor: Colors.white,
    borderBottomWidth: 0.5, borderBottomColor: Colors.border,
  },
  headerTitle: { fontFamily: 'Georgia', fontSize: 18, fontWeight: '600', color: Colors.deeper },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  scroll: { flex: 1 },
  content: { padding: 20 },
  textInput: {
    backgroundColor: Colors.white, borderRadius: Radii.lg, padding: 18,
    fontSize: 20, color: Colors.ink, marginBottom: 24, minHeight: 120,
    textAlignVertical: 'top', borderWidth: 1, borderColor: Colors.sea3,
    fontWeight: '300', ...Shadows.sm,
  },
  fieldLabel: {
    fontSize: 11, letterSpacing: 1.2, textTransform: 'uppercase',
    color: Colors.soft, marginBottom: 10, fontWeight: '600',
  },
  subLabel: { fontSize: 12, color: Colors.mid, marginBottom: 8 },
  segRow: { flexDirection: 'row', gap: 8, marginBottom: 24 },
  seg: {
    flex: 1, paddingVertical: 10, borderRadius: Radii.md,
    backgroundColor: Colors.sea, borderWidth: 0.5, borderColor: Colors.border,
    alignItems: 'center',
  },
  segActive: { backgroundColor: Colors.seafoam + '20', borderColor: Colors.seafoam },
  segText: { fontSize: 13, color: Colors.mid, fontWeight: '400' },
  segTextActive: { color: Colors.deep, fontWeight: '600' },
  dateTimeRow: { flexDirection: 'row', gap: 12, marginBottom: 24 },
  timeBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: Colors.sea, borderRadius: Radii.md, padding: 14,
    borderWidth: 0.5, borderColor: Colors.border,
  },
  timeBtnText: { fontSize: 14, color: Colors.ink, fontWeight: '500' },
  sectionCard: {
    backgroundColor: Colors.white, borderRadius: Radii.lg, padding: 16,
    marginBottom: 24, borderWidth: 0.5, borderColor: Colors.border,
  },
  intervalBox: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: Colors.sea, borderRadius: Radii.md, paddingHorizontal: 12, height: 46,
  },
  intervalInput: {
    flex: 1,
    textAlign: 'center',
    fontSize: 16,
    fontWeight: '600',
    color: Colors.ink,
    paddingVertical: 0,
  },
  intervalVal: { fontSize: 16, fontWeight: '600', color: Colors.ink },
  unitDropdown: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: Colors.sea, borderRadius: Radii.md, paddingHorizontal: 16,
    height: 46, borderWidth: 0.5, borderColor: Colors.border,
  },
  unitDropdownActive: { borderColor: Colors.seafoam },
  unitDropdownText: { fontSize: 14, color: Colors.ink, textTransform: 'capitalize', fontWeight: '500' },
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  modalCenter: {
    flex: 1,
    justifyContent: 'center',
    padding: 20,
  },
  unitMenuModal: {
    backgroundColor: Colors.white,
    borderRadius: Radii.lg,
    padding: 20,
    ...Shadows.lg,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.deeper,
    marginBottom: 16,
    textAlign: 'center',
    fontFamily: 'Georgia',
  },
  unitItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 0.5,
    borderBottomColor: Colors.borderLight,
  },
  unitItemActive: {
    backgroundColor: Colors.sea,
  },
  unitItemText: { fontSize: 14, color: Colors.mid, textTransform: 'capitalize' },
  unitItemTextActive: { color: Colors.seafoam, fontWeight: '700' },
  daysRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 },
  dayCircle: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: Colors.sea, alignItems: 'center', justifyContent: 'center',
    borderWidth: 0.5, borderColor: 'transparent',
  },
  dayCircleActive: { backgroundColor: Colors.seafoam, borderColor: Colors.seafoam },
  dayText: { fontSize: 12, color: Colors.mid, fontWeight: '500' },
  dayTextActive: { color: Colors.white, fontWeight: '700' },
  burstContainer: { flexDirection: 'row', gap: 16, marginBottom: 24 },
  stepControl: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: Colors.sea, borderRadius: Radii.md, height: 46,
    borderWidth: 0.5, borderColor: Colors.border, paddingHorizontal: 8,
  },
  stepBtn: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  stepVal: { fontSize: 14, fontWeight: '600', color: Colors.ink },
  modeScroll: { marginBottom: 24 },
  modeChip: {
    paddingHorizontal: 20, paddingVertical: 10,
    backgroundColor: Colors.sea, borderRadius: Radii.full,
    borderWidth: 0.5, borderColor: Colors.border, marginRight: 10,
  },
  modeText: { fontSize: 13, color: Colors.mid },
  switchesBlock: {
    backgroundColor: Colors.white, borderRadius: Radii.lg, paddingHorizontal: 16,
    borderWidth: 0.5, borderColor: Colors.border, marginBottom: 20,
  },
  toggleRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 16, borderBottomWidth: 0.5, borderBottomColor: Colors.borderLight,
  },
  toggleTitle: { fontSize: 14, color: Colors.ink, fontWeight: '500' },
  toggleDesc: { fontSize: 12, color: Colors.soft, marginTop: 2 },
  footer: {
    padding: 20, backgroundColor: Colors.white,
    borderTopWidth: 0.5, borderTopColor: Colors.border,
  },
});
