import React, { useRef, useState, useCallback, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, StatusBar,
  Platform, BackHandler,
} from 'react-native';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useEvent } from 'expo';
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

  const live = isChannel(item);
  const streamUrl = (item as any).streamUrl || '';

  const [uiVisible, setUiVisible] = useState(true);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const seekedRef = useRef(false);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // expo-video player — created once, auto-plays. timeUpdate fires ~2x/sec.
  const player = useVideoPlayer(streamUrl, (p) => {
    p.timeUpdateEventInterval = 0.5;
    p.play();
  });

  const { isPlaying } = useEvent(player, 'playingChange', { isPlaying: player.playing });
  const { status } = useEvent(player, 'statusChange', { status: player.status });
  const buffering = status === 'loading';

  // The saved position is only read once (to resume), so hold it in a ref.
  // Keeping `continueWatching` in the dep array below would tear down and
  // re-create the native timeUpdate subscription on every tick, because
  // setProgress replaces that object several times a second.
  const resumePctRef = useRef(continueWatching[item.id]);

  useEffect(() => {
    const sub = player.addListener('timeUpdate', ({ currentTime: ct }) => {
      const dur = player.duration || 0;
      setCurrentTime(ct);
      if (dur > 0) setDuration(dur);
      // Resume from saved position once duration is known
      if (!live && !seekedRef.current && dur > 0) {
        const savedPct = resumePctRef.current;
        if (savedPct && savedPct > 0 && savedPct < 95) {
          player.currentTime = (savedPct / 100) * dur;
        }
        seekedRef.current = true;
      }
      // Persist progress
      if (!live && dur > 0) setProgress(item.id, Math.round((ct / dur) * 100));
    });
    return () => sub.remove();
  }, [player, live, item.id, setProgress]);

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
    const sub = BackHandler.addEventListener('hardwareBackPress', () => { onClose(); return true; });
    return () => sub.remove();
  }, [onClose]);

  const seekRel = (delta: number) => { player.seekBy(delta); showUi(); };
  const togglePause = () => { isPlaying ? player.pause() : player.play(); showUi(); };

  const progress = duration > 0 ? currentTime / duration : 0;

  return (
    <View style={styles.root}>
      <StatusBar hidden />
      <TouchableOpacity style={StyleSheet.absoluteFill} onPress={showUi} activeOpacity={1}>
        <VideoView
          player={player}
          style={StyleSheet.absoluteFill}
          contentFit="contain"
          nativeControls={false}
          allowsPictureInPicture
        />
      </TouchableOpacity>

      {buffering && (
        <View style={styles.bufferingWrap} pointerEvents="none">
          <Text style={styles.bufferingText}>●</Text>
        </View>
      )}

      {uiVisible && (
        <View style={styles.overlay} pointerEvents="box-none">
          <View style={styles.topBar}>
            <TouchableOpacity onPress={onClose} style={styles.backBtn}>
              <Text style={styles.backIcon}>‹</Text>
            </TouchableOpacity>
            <View style={styles.titleWrap}>
              <Text style={styles.titleText} numberOfLines={1}>
                {isChannel(item) ? item.name : (item as Title).title}
              </Text>
              {!live && <Text style={styles.metaText}>{(item as Title).year}</Text>}
            </View>
          </View>

          <View style={styles.centerControls} pointerEvents="box-none">
            {!live && (
              <TouchableOpacity style={styles.seekBtn} onPress={() => seekRel(-10)}>
                <Text style={styles.seekText}>−10s</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity style={[styles.playBtn, { backgroundColor: accent }]} onPress={togglePause}>
              <Text style={styles.playIcon}>{isPlaying ? '⏸' : '▶'}</Text>
            </TouchableOpacity>
            {!live && (
              <TouchableOpacity style={styles.seekBtn} onPress={() => seekRel(10)}>
                <Text style={styles.seekText}>+10s</Text>
              </TouchableOpacity>
            )}
          </View>

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
  // absoluteFillObject (not absoluteFill) — the latter is a registered style ID,
  // which can't be spread into a style object.
  bufferingWrap: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  bufferingText: { color: '#fff', fontSize: 32, opacity: 0.7 },
  overlay: { ...StyleSheet.absoluteFillObject, justifyContent: 'space-between' },
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
  centerControls: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 24 },
  playBtn: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center' },
  playIcon: { color: '#fff', fontSize: 24 },
  seekBtn: { backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 8, paddingHorizontal: 16, paddingVertical: 12 },
  seekText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  bottomBar: { padding: 16, paddingBottom: Platform.OS === 'ios' ? 32 : 16, backgroundColor: 'rgba(0,0,0,0.6)' },
  scrubRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  timeText: { color: '#fff', fontSize: 13, minWidth: 44, textAlign: 'center' },
  progressBg: { flex: 1, height: 4, backgroundColor: 'rgba(255,255,255,0.3)', borderRadius: 2, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 2 },
});
