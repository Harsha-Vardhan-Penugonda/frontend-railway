import { useRef, useState, useCallback } from 'react';
import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile } from '@ffmpeg/util';

// Same noise-reduction presets as the backend's server-side pipeline uses a
// different filter for (afftdn there vs highpass/lowpass/anlmdn here) - both
// are legitimate approaches, this one runs client-side before anything is
// ever uploaded.
const NOISE_REDUCTION_PRESETS = {
  light: { hp: 80, lp: 14000, s: 3 },
  medium: { hp: 120, lp: 12000, s: 7 },
  aggressive: { hp: 200, lp: 10000, s: 15 },
};

export function useFFmpeg() {
  const ffmpegRef = useRef(null);
  const [loaded, setLoaded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [statusMessage, setStatusMessage] = useState('');

  const load = useCallback(async () => {
    if (loaded || loading) return;
    setLoading(true);
    setStatusMessage('Loading audio engine...');

    try {
      const ffmpeg = new FFmpeg();
      ffmpeg.on('progress', ({ progress: p }) => {
        setProgress(Math.round(p * 100));
      });

      const baseURL = 'https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.6/dist/umd';
      await ffmpeg.load({
        coreURL: `${baseURL}/ffmpeg-core.js`,
        wasmURL: `${baseURL}/ffmpeg-core.wasm`,
      });

      ffmpegRef.current = ffmpeg;
      setLoaded(true);
      setStatusMessage('Audio engine ready');
    } catch (err) {
      console.error('Failed to load FFmpeg:', err);
      setStatusMessage('Failed to load audio engine');
      throw err;
    } finally {
      setLoading(false);
    }
  }, [loaded, loading]);

  // minSilenceSeconds mirrors the same "how much silence to trim" knob the
  // server-side pipeline exposes - lower = more aggressive, higher = gentler.
  const processAudio = useCallback(
    async (audioBlob, { noiseReduction = 'medium', silenceRemoval = true, normalization = true, minSilenceSeconds = 0.2 } = {}) => {
      const ffmpeg = ffmpegRef.current;
      if (!ffmpeg) throw new Error('FFmpeg not loaded');

      setProcessing(true);
      setProgress(0);

      try {
        setStatusMessage('Preparing audio...');
        const inputData = await fetchFile(audioBlob);
        await ffmpeg.writeFile('input', inputData);

        const filters = [];

        setStatusMessage('Applying noise reduction...');
        const nr = NOISE_REDUCTION_PRESETS[noiseReduction] || NOISE_REDUCTION_PRESETS.medium;
        filters.push(`highpass=f=${nr.hp}`);
        filters.push(`lowpass=f=${nr.lp}`);
        filters.push(`anlmdn=s=${nr.s}`);

        if (silenceRemoval) {
          setStatusMessage('Removing silence...');
          filters.push(
            `silenceremove=start_periods=1:start_duration=${minSilenceSeconds}:start_threshold=-45dB:detection=peak,silenceremove=stop_periods=-1:stop_duration=${minSilenceSeconds}:stop_threshold=-45dB:detection=peak`
          );
        }

        if (normalization) {
          setStatusMessage('Normalizing audio...');
          filters.push('loudnorm=I=-16:TP=-1.5:LRA=11');
          filters.push('compand=attacks=0.3:decays=0.8:points=-80/-900|-45/-15|-27/-9|0/-7|20/-7:gain=5');
        }

        const filterStr = filters.join(',');
        const outputFile = 'output.mp3';

        setStatusMessage('Processing audio...');
        await ffmpeg.exec(['-i', 'input', '-af', filterStr, '-codec:a', 'libmp3lame', '-q:a', '2', '-y', outputFile]);

        setStatusMessage('Finalizing...');
        const data = await ffmpeg.readFile(outputFile);
        const arrayBuffer = data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength);
        const blob = new Blob([arrayBuffer], { type: 'audio/mpeg' });

        await ffmpeg.deleteFile('input');
        await ffmpeg.deleteFile(outputFile);

        setStatusMessage('Done!');
        setProgress(100);
        return blob;
      } catch (err) {
        console.error('Processing failed:', err);
        setStatusMessage('Processing failed');
        throw err;
      } finally {
        setProcessing(false);
      }
    },
    []
  );

  return { load, loaded, loading, processing, progress, statusMessage, processAudio };
}
