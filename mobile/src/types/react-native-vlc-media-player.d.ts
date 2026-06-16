// The published d.ts for this package declares VLCPlayer/VlCPlayerView but never
// exports them, even though the runtime (index.js) exports { VLCPlayer, VlCPlayerView }.
// This augments the module with a usable shape.
declare module 'react-native-vlc-media-player' {
  import { Component } from 'react';
  import { StyleProp, ViewStyle } from 'react-native';

  export type PlayerAspectRatio = '16:9' | '1:1' | '4:3' | '3:2' | '21:9' | '9:16';
  export type PlayerResizeMode = 'fill' | 'contain' | 'cover' | 'none' | 'scale-down';

  export interface VLCPlayerSource {
    uri: string;
    initType?: 1 | 2;
    initOptions?: string[];
  }

  export type Track = { id: number; name: string };

  export type VideoInfo = {
    duration: number;
    target: number;
    videoSize: Record<'width' | 'height', number>;
    audioTracks: Track[];
    textTracks: Track[];
  };

  type OnPlayingEventProps = Pick<VideoInfo, 'duration' | 'target'> & { seekable: boolean };
  type OnProgressEventProps = Pick<VideoInfo, 'duration' | 'target'> & {
    currentTime: number;
    position: number;
    remainingTime: number;
  };
  type SimpleCallbackEventProps = Pick<VideoInfo, 'target'>;

  export interface VLCPlayerProps {
    source: VLCPlayerSource;
    subtitleUri?: string;
    paused?: boolean;
    repeat?: boolean;
    rate?: number;
    seek?: number;
    volume?: number;
    muted?: boolean;
    audioTrack?: number;
    textTrack?: number;
    playInBackground?: boolean;
    videoAspectRatio?: PlayerAspectRatio;
    autoAspectRatio?: boolean;
    resizeMode?: PlayerResizeMode;
    style?: StyleProp<ViewStyle>;
    autoplay?: boolean;
    acceptInvalidCertificates?: boolean;
    onPlaying?: (event: OnPlayingEventProps) => void;
    onProgress?: (event: OnProgressEventProps) => void;
    onPaused?: (event: SimpleCallbackEventProps) => void;
    onStopped?: (event: SimpleCallbackEventProps) => void;
    onBuffering?: (event: SimpleCallbackEventProps) => void;
    onEnd?: (event: SimpleCallbackEventProps) => void;
    onError?: (event: SimpleCallbackEventProps) => void;
    onLoad?: (event: VideoInfo) => void;
  }

  export class VLCPlayer extends Component<VLCPlayerProps> {
    seek(pos: number): void;
    resume(): void;
    stopPlayer(): void;
    snapshot(path: string): void;
    startRecording(path: string): void;
    stopRecording(): void;
    autoAspectRatio(useAuto: boolean): void;
    changeVideoAspectRatio(ratio: string): void;
  }

  export class VlCPlayerView extends Component<any> {}
}
