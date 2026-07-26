import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useStore } from '../store';
import Shifty from '../components/Shifty';

const ACCENTS = ['#E50914', '#6E3FF3', '#14B8A6', '#F5C518', '#46D369', '#2E51A2', '#FF6B00', '#EC4899'];

interface Props {
  onClose: () => void;
}

export default function SettingsScreen({ onClose }: Props) {
  const provider = useStore((s) => s.provider);
  const setProvider = useStore((s) => s.setProvider);
  const settings = useStore((s) => s.settings);
  const updateSettings = useStore((s) => s.updateSettings);
  const accent = settings.accentColor;

  const [tmdbKey, setTmdbKey] = useState(settings.tmdbApiKey || '');

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onClose} style={styles.backBtn}>
          <Text style={styles.backIcon}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Settings</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.hero}>
          <Shifty size={92} mood="idle" />
          {!!provider && <Text style={styles.provName}>{provider.name}</Text>}
          <Text style={styles.provSub}>{provider?.type === 'xtream' ? 'Xtream Codes' : 'M3U playlist'}</Text>
        </View>

        {/* Accent color */}
        <Text style={styles.sectionLabel}>Accent Color</Text>
        <View style={styles.swatchRow}>
          {ACCENTS.map((c) => (
            <TouchableOpacity
              key={c}
              onPress={() => updateSettings({ accentColor: c })}
              style={[styles.swatch, { backgroundColor: c }, accent === c && styles.swatchActive]}
            />
          ))}
        </View>

        {/* TMDB */}
        <Text style={styles.sectionLabel}>TMDB API Key</Text>
        <Text style={styles.hint}>
          Adds proper widescreen cover art on the home billboard. Free key from themoviedb.org.
        </Text>
        <TextInput
          style={styles.input}
          placeholder="TMDB API key (v3 auth)"
          placeholderTextColor="#666"
          value={tmdbKey}
          onChangeText={setTmdbKey}
          autoCapitalize="none"
          autoCorrect={false}
        />
        <View style={styles.btnRow}>
          <TouchableOpacity
            style={[styles.saveBtn, { backgroundColor: accent }]}
            onPress={() => updateSettings({ tmdbApiKey: tmdbKey.trim() || undefined })}
          >
            <Text style={styles.saveText}>Save key</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.linkBtn}
            onPress={() => Linking.openURL('https://www.themoviedb.org/settings/api')}
          >
            <Text style={styles.linkText}>Get a key ↗</Text>
          </TouchableOpacity>
        </View>

        {/* Account */}
        <Text style={[styles.sectionLabel, { marginTop: 34 }]}>Account</Text>
        <TouchableOpacity style={styles.signOutBtn} onPress={() => { setProvider(null); onClose(); }}>
          <Text style={styles.signOutText}>Sign out of this provider</Text>
        </TouchableOpacity>

        <Text style={styles.footer}>SHIFT — bring your own IPTV provider. No content included.</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0e0e0e' },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 8 },
  backBtn: { padding: 8, width: 44 },
  backIcon: { color: '#fff', fontSize: 32, lineHeight: 32 },
  headerTitle: { color: '#fff', fontSize: 20, fontWeight: '800' },
  content: { padding: 20, paddingBottom: 60 },
  hero: { alignItems: 'center', marginBottom: 28 },
  provName: { color: '#fff', fontSize: 18, fontWeight: '800', marginTop: 6 },
  provSub: { color: '#777', fontSize: 13, marginTop: 2 },
  sectionLabel: { color: '#888', fontSize: 12, fontWeight: '800', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 12 },
  swatchRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 28 },
  swatch: { width: 42, height: 42, borderRadius: 21, borderWidth: 2, borderColor: 'transparent' },
  swatchActive: { borderColor: '#fff' },
  hint: { color: '#777', fontSize: 12.5, lineHeight: 18, marginBottom: 12, marginTop: -4 },
  input: { backgroundColor: '#1c1c1c', borderRadius: 8, padding: 14, color: '#fff', fontSize: 14, marginBottom: 12 },
  btnRow: { flexDirection: 'row', gap: 10 },
  saveBtn: { borderRadius: 8, paddingVertical: 12, paddingHorizontal: 22 },
  saveText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  linkBtn: { borderRadius: 8, paddingVertical: 12, paddingHorizontal: 18, backgroundColor: '#1c1c1c' },
  linkText: { color: '#bbb', fontSize: 14, fontWeight: '600' },
  signOutBtn: { backgroundColor: '#1c1c1c', borderRadius: 8, padding: 15, alignItems: 'center' },
  signOutText: { color: '#E50914', fontSize: 15, fontWeight: '700' },
  footer: { color: '#555', fontSize: 12, textAlign: 'center', marginTop: 40, lineHeight: 18 },
});
