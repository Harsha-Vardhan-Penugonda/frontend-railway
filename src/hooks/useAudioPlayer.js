import { useRef, useState, useCallback, useEffect } from 'react';

// A single shared <audio> element so only one clip plays at a time across
// the whole dashboard, like any real media table (Spotify, Drive, etc.)
export function useAudioPlayer() {
  const audioRef = useRef(null);
  const [playingKey, setPlayingKey] = useState(null);

  useEffect(() => {
    const audio = new Audio();
    audioRef.current = audio;
    const handleEnded = () => setPlayingKey(null);
    audio.addEventListener('ended', handleEnded);
    return () => {
      audio.pause();
      audio.removeEventListener('ended', handleEnded);
    };
  }, []);

  const toggle = useCallback((key, url) => {
    const audio = audioRef.current;
    if (!audio) return;

    if (playingKey === key) {
      audio.pause();
      setPlayingKey(null);
      return;
    }

    audio.src = url;
    audio.currentTime = 0;
    audio.play().catch(() => setPlayingKey(null));
    setPlayingKey(key);
  }, [playingKey]);

  const stop = useCallback(() => {
    audioRef.current?.pause();
    setPlayingKey(null);
  }, []);

  return { playingKey, toggle, stop };
}
