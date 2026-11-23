import React from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, StatusBar, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';

import { Colors } from '../utils/theme';
import { PRIVACY_SECTIONS, PRIVACY_UPDATED, PRIVACY_CONTACT } from '../content/privacyPolicy';

export default function PrivacyScreen({ navigation }) {
  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <StatusBar barStyle="dark-content" backgroundColor={Colors.mist} />
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} style={styles.iconBtn} hitSlop={8}>
          <Feather name="arrow-left" size={22} color={Colors.ink} />
        </Pressable>
        <Text style={styles.headerTitle}>Privacy policy</Text>
        <View style={styles.iconBtn} />
      </View>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.updated}>Last updated {PRIVACY_UPDATED}</Text>
        {PRIVACY_SECTIONS.map(s => (
          <View key={s.title} style={styles.section}>
            <Text style={styles.title}>{s.title}</Text>
            {s.body.map((p, i) => (
              <Text key={i} style={styles.body}>{p}</Text>
            ))}
          </View>
        ))}
        {PRIVACY_CONTACT && (
          <Pressable onPress={() => Linking.openURL(`mailto:${PRIVACY_CONTACT}`)} style={styles.contact}>
            <Feather name="mail" size={16} color={Colors.deep} />
            <Text style={styles.contactText}>{PRIVACY_CONTACT}</Text>
          </Pressable>
        )}
        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.mist },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, height: 56 },
  iconBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontFamily: 'Georgia', fontSize: 19, fontWeight: '600', color: Colors.deeper },
  content: { paddingHorizontal: 22, paddingTop: 4 },
  updated: { fontSize: 12, color: Colors.soft, marginBottom: 8 },
  section: { marginTop: 18 },
  title: { fontSize: 16, fontWeight: '700', color: Colors.deeper, marginBottom: 6 },
  body: { fontSize: 14, lineHeight: 21, color: Colors.ink, marginBottom: 6 },
  contact: {
    flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 20, padding: 14,
    backgroundColor: Colors.sea, borderRadius: 16,
  },
  contactText: { fontSize: 14, color: Colors.deep, fontWeight: '600' },
});
