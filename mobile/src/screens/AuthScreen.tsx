import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useStore } from '../store';
import { xtreamVerify } from '../api/xtream';
import { fetchM3U } from '../api/m3u';

export default function AuthScreen() {
  const setProvider = useStore((s) => s.setProvider);
  const savedProviders = useStore((s) => s.savedProviders);
  const removeSavedProvider = useStore((s) => s.removeSavedProvider);
  const loadContent = useStore((s) => s.loadContent);
  const accent = useStore((s) => s.settings.accentColor);

  const [mode, setMode] = useState<'xtream' | 'm3u'>('xtream');
  const [name, setName] = useState('');
  const [server, setServer] = useState('');
  const [user, setUser] = useState('');
  const [pass, setPass] = useState('');
  const [m3uUrl, setM3uUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showAdd, setShowAdd] = useState(savedProviders.length === 0);

  const connect = async () => {
    setError('');
    setLoading(true);
    try {
      if (mode === 'xtream') {
        if (!server || !user) throw new Error('Server URL and username are required');
        await xtreamVerify({ serverUrl: server, username: user, password: pass });
        const id = `xtream-${server}-${user}`;
        setProvider({ id, name: name || server, type: 'xtream', serverUrl: server, username: user, password: pass });
      } else {
        if (!m3uUrl) throw new Error('Playlist URL is required');
        const id = `m3u-${m3uUrl}`;
        setProvider({ id, name: name || 'Playlist', type: 'm3u', m3uUrl });
      }
    } catch (e: any) {
      setError(e?.message || 'Connection failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <Text style={styles.logo}>SHIFT</Text>
        <Text style={styles.tagline}>Connect your IPTV service to start streaming.</Text>

        {/* Saved providers */}
        {!showAdd && savedProviders.length > 0 && (
          <View style={styles.savedWrap}>
            <Text style={styles.sectionLabel}>Your Providers</Text>
            {savedProviders.map((p) => (
              <View key={p.id} style={styles.savedRow}>
                <TouchableOpacity
                  style={[styles.savedBtn, { flex: 1 }]}
                  onPress={() => { loadContent(p); setProvider(p); }}
                >
                  <Text style={styles.savedName}>{p.name}</Text>
                  <Text style={styles.savedSub}>{p.type === 'xtream' ? p.serverUrl : p.m3uUrl}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.removeBtn} onPress={() => removeSavedProvider(p.id)}>
                  <Text style={styles.removeText}>✕</Text>
                </TouchableOpacity>
              </View>
            ))}
            <TouchableOpacity style={styles.addNew} onPress={() => setShowAdd(true)}>
              <Text style={[styles.addNewText, { color: accent }]}>+ Add Provider</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Add provider form */}
        {showAdd && (
          <View style={styles.form}>
            {/* Mode tabs */}
            <View style={styles.tabs}>
              {(['xtream', 'm3u'] as const).map((m) => (
                <TouchableOpacity
                  key={m}
                  style={[styles.tab, mode === m && { backgroundColor: accent }]}
                  onPress={() => setMode(m)}
                >
                  <Text style={[styles.tabText, mode === m && { color: '#fff' }]}>
                    {m === 'xtream' ? 'Xtream Codes' : 'Playlist URL'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <TextInput
              style={styles.input}
              placeholder="Provider name (optional)"
              placeholderTextColor="#666"
              value={name}
              onChangeText={setName}
              returnKeyType="next"
            />

            {mode === 'xtream' ? (
              <>
                <TextInput
                  style={styles.input}
                  placeholder="Server URL (e.g. http://provider.com)"
                  placeholderTextColor="#666"
                  value={server}
                  onChangeText={setServer}
                  autoCapitalize="none"
                  keyboardType="url"
                  returnKeyType="next"
                />
                <TextInput
                  style={styles.input}
                  placeholder="Username"
                  placeholderTextColor="#666"
                  value={user}
                  onChangeText={setUser}
                  autoCapitalize="none"
                  returnKeyType="next"
                />
                <TextInput
                  style={styles.input}
                  placeholder="Password"
                  placeholderTextColor="#666"
                  value={pass}
                  onChangeText={setPass}
                  secureTextEntry
                  returnKeyType="done"
                  onSubmitEditing={connect}
                />
              </>
            ) : (
              <TextInput
                style={styles.input}
                placeholder="Playlist URL (.m3u / .m3u8)"
                placeholderTextColor="#666"
                value={m3uUrl}
                onChangeText={setM3uUrl}
                autoCapitalize="none"
                keyboardType="url"
                returnKeyType="done"
                onSubmitEditing={connect}
              />
            )}

            {error ? <Text style={styles.error}>{error}</Text> : null}

            <TouchableOpacity
              style={[styles.connectBtn, { backgroundColor: accent }, loading && { opacity: 0.7 }]}
              onPress={connect}
              disabled={loading}
            >
              {loading
                ? <ActivityIndicator color="#fff" />
                : <Text style={styles.connectText}>Connect</Text>
              }
            </TouchableOpacity>

            {savedProviders.length > 0 && (
              <TouchableOpacity onPress={() => setShowAdd(false)} style={styles.cancelBtn}>
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#141414' },
  scroll: { padding: 24, paddingTop: 60, minHeight: '100%' },
  logo: { fontSize: 36, fontWeight: '900', color: '#E50914', letterSpacing: 2, marginBottom: 8 },
  tagline: { fontSize: 15, color: '#b3b3b3', marginBottom: 32 },
  sectionLabel: { color: '#888', fontSize: 12, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 12 },
  savedWrap: { marginBottom: 24 },
  savedRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  savedBtn: { backgroundColor: '#1e1e1e', borderRadius: 8, padding: 14, marginRight: 8 },
  savedName: { color: '#fff', fontSize: 15, fontWeight: '600' },
  savedSub: { color: '#666', fontSize: 12, marginTop: 2 },
  removeBtn: { padding: 14, backgroundColor: '#1e1e1e', borderRadius: 8 },
  removeText: { color: '#888', fontSize: 16 },
  addNew: { marginTop: 8, alignSelf: 'flex-start' },
  addNewText: { fontSize: 15, fontWeight: '600' },
  form: {},
  tabs: { flexDirection: 'row', backgroundColor: '#1e1e1e', borderRadius: 8, padding: 4, marginBottom: 16 },
  tab: { flex: 1, paddingVertical: 10, borderRadius: 6, alignItems: 'center' },
  tabText: { fontSize: 14, fontWeight: '600', color: '#888' },
  input: {
    backgroundColor: '#1e1e1e', borderRadius: 8, padding: 14,
    color: '#fff', fontSize: 15, marginBottom: 12,
  },
  error: { color: '#E50914', fontSize: 13, marginBottom: 12 },
  connectBtn: { borderRadius: 8, padding: 16, alignItems: 'center', marginTop: 4 },
  connectText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  cancelBtn: { alignItems: 'center', marginTop: 16 },
  cancelText: { color: '#888', fontSize: 14 },
});
