import React, { useRef, useState, useCallback, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, StatusBar,
  Platform, BackHandler,
} from 'react-native';
import { Video, ResizeMode, type AVPlaybackStatus } from 'expo-av';
import { useStore } from '../store';
import type { Title, Channel } from '../types';

type Item = Title | Channel;

function isChannel(item: Item): item is Channel {
  return 'num' in item;
}

function formatTime(secs: number): string {
  if (!secs || !isFinite(secs)) return '0:00';
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = Math.floor(secs % 60);
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

interface Props {
  item: Item;
  onClose: () => void;
}

export default function PlayerScreen({ item, onClose }: Props) {
  const setProgress = useStore((s) => s.setProgress);
  const continueWatching = useStore((s) => s.continueWatching);
  const accent = useStore((s) => s.settings.accentColor);

  const videoRef = useRef<Video>(null);
  const live = isChannel(item);

  const [paused, setPaused] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [buffering, setBuffering] = useState(true);
  const [uiVisible, setUiVisible] = useState(true);
  const [seeked, setSeeked] = useState(false);

  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showUi = useCallback(() => {
    setUiVisible(true);
    if (hideTimer.current) clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => setUiVisible(false), 3500);
  }, []);

  useEffect(() => {
    showUi();
    return () => { if (hideTimer.current) clearTimeout(hideTimer.current); };
  }, [showUi]);

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      onClose();
      return true;
    });
    return () => sub.remove();
  }, [onClose]);

  const onPlaybackStatusUpdate = useCallback((status: AVPlaybackStatus) => {
    if (!status.isLoaded) {
      setBuffering(true);
      return;
    }

    const ct = status.positionMillis / 1000;
    const dur = status.durationMillis ? status.durationMillis / 1000 : 0;

    setCurrentTime(ct);
    if (dur > 0) setDuration(dur);
    setBuffering(status.isBuffering || false);

    // Resume from saved position once duration is known
    if (!live && !seeked && dur > 0) {
      const savedPct = continueWatching[item.id];
      if (savedPct && savedPct > 0 && savedPct < 95) {
        const seekToMs = Math.floor((savedPct / 100) * dur * 1000);
        videoRef.current?.setPositionAsync(seekToMs);
      }
      setSeeked(true);
    }

    // Persist progress
    if (!live && dur > 0) {
      const pct = Math.round((ct / dur) * 100);
      setProgress(item.id, pct);
    }
  }, [live, seeked, continueWatching, item.id, setProgress]);

  const seekRel = (delta: number) => {
    const targetMs = Math.max(0, (currentTime + delta) * 1000);
    videoRef.current?.setPositionAsync(targetMs);
    showUi();
  };

  const togglePause = () => {
    if (paused) {
      videoRef.current?.playAsync();
    } else {
      videoRef.current?.pauseAsync();
    }
    setPaused((p) => !p);
    showUi();
  };

  const progress = duration > 0 ? currentTime / duration : 0;
  const streamUrl = (item as any).streamUrl || '';

  return (
    <View style={styles.root}>
      <StatusBar hidden />
      <TouchableOpacity style={StyleSheet.absoluteFill} onPress={showUi} activeOpacity={1}>
        <Video
          ref={videoRef}
          source={{ uri: streamUrl }}
          style={StyleSheet.absoluteFill}
          resizeMode={ResizeMode.CONTAIN}
          shouldPlay={!paused}
          useNativeControls={false}
          onPlaybackStatusUpdate={onPlaybackStatusUpdate}
        />
      </TouchableOpacity>

      {buffering && (
        <View style={styles.bufferingWrap} pointerEvents="none">
          <Text style={styles.bufferingText}>●</Text>
        </View>
      )}

      {uiVisible && (
        <View style={styles.overlay} pointerEvents="box-none">
          {/* Top bar */}
          <View style={styles.topBar}>
            <TouchableOpacity onPress={onClose} style={styles.backBtn}>
              <Text style={styles.backIcon}>‹</Text>
            </TouchableOpacity>
            <View style={styles.titleWrap}>
              <Text style={styles.titleText} numberOfLines={1}>
                {isChannel(item) ? item.name : (item as Title).title}
              </Text>
              {!live && (
                <Text style={styles.metaText}>{(item as Title).year}</Text>
              )}
            </View>
          </View>

          {/* Center controls */}
          <View style={styles.centerControls} pointerEvents="box-none">
            {!live && (
              <TouchableOpacity style={styles.seekBtn} onPress={() => seekRel(-10)}>
                <Text style={styles.seekText}>−10s</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity style={[styles.playBtn, { backgroundColor: accent }]} onPress={togglePause}>
              <Text style={styles.playIcon}>{paused ? '▶' : '⏸'}</Text>
            </TouchableOpacity>
            {!live && (
              <TouchableOpacity style={styles.seekBtn} onPress={() => seekRel(10)}>
                <Text style={styles.seekText}>+10s</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Progress bar (VOD only) */}
          {!live && duration > 0 && (
            <View style={styles.bottomBar}>
              <View style={styles.scrubRow}>
                <Text style={styles.timeText}>{formatTime(currentTime)}</Text>
                <View style={styles.progressBg}>
                  <View style={[styles.progressFill, { width: `${progress * 100}%` as any, backgroundColor: accent }]} />
                </View>
                <Text style={styles.timeText}>{formatTime(duration)}</Text>
              </View>
            </View>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },
  bufferingWrap: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center' },
  bufferingText: { color: '#fff', fontSize: 32, opacity: 0.7 },
  overlay: { ...StyleSheet.absoluteFill, justifyContent: 'space-between' },
  topBar: {
    flexDirection: 'row', alignItems: 'center',
    padding: 16, paddingTop: Platform.OS === 'ios' ? 48 : 16,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  backBtn: { padding: 8, marginRight: 8 },
  backIcon: { color: '#fff', fontSize: 32, lineHeight: 32 },
  titleWrap: { flex: 1 },
  titleText: { color: '#fff', fontSize: 17, fontWeight: '700' },
  metaText: { color: '#b3b3b3', fontSize: 13, marginTop: 2 },
  centerControls: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 24,
  },
  playBtn: {
    width: 64, height: 64, borderRadius: 32,
    alignItems: 'center', justifyContent: 'center',
  },
  playIcon: { color: '#fff', fontSize: 24 },
  seekBtn: {
    backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 8,
    paddingHorizontal: 16, paddingVertical: 12,
  },
  seekText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  bottomBar: {
    padding: 16, paddingBottom: Platform.OS === 'ios' ? 32 : 16,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  scrubRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  timeText: { color: '#fff', fontSize: 13, minWidth: 44, textAlign: 'center' },
  progressBg: {
    flex: 1, height: 4, backgroundColor: 'rgba(255,255,255,0.3)', borderRadius: 2, overflow: 'hidden',
  },
  progressFill: { height: '100%', borderRadius: 2 },
});
