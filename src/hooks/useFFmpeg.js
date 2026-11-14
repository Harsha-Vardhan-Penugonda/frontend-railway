import { useRef, useState, useCallback } from 'react';
import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';

// Same afftdn-based noise reduction the backend's server-side pipeline uses
// (this used to be the anlmdn filter, which doesn't actually exist in
// ffmpeg's filter set at all - it silently produced near-empty garbage
// output instead of erroring, which is why "record -> enhance" looked
// broken with no visible error).
const NOISE_REDUCTION_PRESETS = {
  light: { hp: 80, lp: 14000, nr: 6 },
  medium: { hp: 120, lp: 12000, nr: 12 },
  aggressive: { hp: 200, lp: 10000, nr: 20 },
};

// Same loudness match the backend applies (train-announcer-backend/loudness.js):
// set the clip's average level to what the existing clips use, with a limiter
// to stop the extra gain clipping. Matching only the loudest instant left
// app recordings up to 5dB quieter than the rest.
const TARGET_MEAN_DB = -13.3;
const LIMIT = 0.95;
const MAX_GAIN_DB = 18;
const LOUDNESS_PASSES = 3;
const clampGain = (db) => Math.min(MAX_GAIN_DB, Math.max(-MAX_GAIN_DB, db));

export function useFFmpeg() {
  const ffmpegRef = useRef(null);
  const logBufferRef = useRef([]);
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
      // Registered once here (rather than per-call) so we don't depend on
      // the library supporting listener removal - processAudio just clears
      // this buffer before the measurement pass it cares about.
      ffmpeg.on('log', ({ message }) => {
        logBufferRef.current.push(message);
      });

      // Two separate things had to be right here:
      // 1. ffmpeg.load() hands these URLs to a dynamic import() inside its
      //    worker; a raw cross-origin CDN URL fails there even though the
      //    network fetch succeeds. toBlobURL turns it into a same-origin
      //    blob: URL the worker can actually import.
      // 2. The URL has to point at the ESM build, not UMD - UMD isn't a
      //    valid ES module (no `export` statements), so a dynamic import()
      //    of it fails immediately with "failed to import ffmpeg-core.js"
      //    regardless of (1).
      const baseURL = 'https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.6/dist/esm';
      await ffmpeg.load({
        coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
        wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
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

  // ffmpeg.exec() resolves with an exit code rather than rejecting on
  // failure - a bad filter name or unsupported option just returns non-zero
  // while whatever partial/empty output existed sits there looking like
  // success. Checking the code (and surfacing the logged ffmpeg output,
  // since that's the only place the real error message ends up) is what
  // caught the anlmdn mistake above; this project has already been bitten
  // once by treating an ignored failure as success, so don't repeat it here.
  const execOrThrow = useCallback(async (ffmpeg, args) => {
    const startLen = logBufferRef.current.length;
    const code = await ffmpeg.exec(args);
    if (code !== 0) {
      const recentLog = logBufferRef.current.slice(startLen).join('\n');
      throw new Error(`ffmpeg exited with code ${code} for [${args.join(' ')}]: ${recentLog || '(no log output)'}`);
    }
  }, []);

  // Measures a file already written into ffmpeg's virtual filesystem with
  // volumedetect, reading the result back out of the logged output
  // (ffmpeg.wasm doesn't return stderr from exec()). Null means silence.
  const measureMeanDb = useCallback(async (filename) => {
    const ffmpeg = ffmpegRef.current;
    logBufferRef.current = [];
    await execOrThrow(ffmpeg, ['-i', filename, '-af', 'volumedetect', '-f', 'null', '-']);
    const combined = logBufferRef.current.join('\n');
    const match = combined.match(/mean_volume:\s*(-?[\d.]+|-inf)\s*dB/);
    if (!match || match[1] === '-inf') return null;
    return parseFloat(match[1]);
  }, [execOrThrow]);

  // minSilenceSeconds mirrors the same "how much silence to trim" knob the
  // server-side pipeline exposes - lower = more aggressive, higher = gentler.
  // Output is always mono: browsers often record stereo with the voice on
  // the left channel only, which then plays at half volume next to the
  // mono clips in a generated announcement.
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

        setStatusMessage('Applying noise reduction...');
        const nr = NOISE_REDUCTION_PRESETS[noiseReduction] || NOISE_REDUCTION_PRESETS.medium;
        const stage1Filters = [`highpass=f=${nr.hp}`, `lowpass=f=${nr.lp}`, `afftdn=nf=-25:nr=${nr.nr}`];

        if (silenceRemoval) {
          setStatusMessage('Removing silence...');
          // start_duration=0 means "trim leading silence immediately,
          // whatever its length" (matches the server pipeline). Setting it
          // to minSilenceSeconds instead - a real bug this had - made the
          // filter collapse some recordings to nothing: it wants that much
          // *silence* to appear before it will start counting, which a
          // recording that starts speaking right away never satisfies, and
          // the whole clip got treated as one long leading silence.
          // minSilenceSeconds only makes sense on the stop/internal side.
          stage1Filters.push(
            `silenceremove=start_periods=1:start_duration=0:start_threshold=-45dB:detection=peak,silenceremove=stop_periods=-1:stop_duration=${minSilenceSeconds}:stop_threshold=-45dB:detection=peak`
          );
        }

        await execOrThrow(ffmpeg, ['-i', 'input', '-af', stage1Filters.join(','), '-ac', '1', '-ar', '44100', '-c:a', 'pcm_f32le', '-y', 'midstage.wav']);

        let source = 'midstage.wav';
        if (normalization) {
          setStatusMessage('Matching loudness...');
          const startMean = await measureMeanDb('midstage.wav');
          if (startMean !== null) {
            let gainDb = clampGain(TARGET_MEAN_DB - startMean);
            for (let i = 0; i < LOUDNESS_PASSES; i++) {
              await execOrThrow(ffmpeg, [
                '-i', 'midstage.wav',
                '-af', `volume=${gainDb.toFixed(2)}dB,alimiter=limit=${LIMIT}:attack=1:release=40:level=0`,
                '-c:a', 'pcm_f32le', '-y', 'leveled.wav',
              ]);
              const nowMean = await measureMeanDb('leveled.wav');
              if (nowMean === null) break;
              const missing = TARGET_MEAN_DB - nowMean;
              if (Math.abs(missing) < 0.3) break;
              gainDb = clampGain(gainDb + missing);
            }
            source = 'leveled.wav';
          }
        }

        await execOrThrow(ffmpeg, ['-i', source, '-c:a', 'libmp3lame', '-b:a', '128k', '-y', 'output.mp3']);
        const finalFile = 'output.mp3';

        setStatusMessage('Finalizing...');
        const data = await ffmpeg.readFile(finalFile);
        const arrayBuffer = data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength);
        const blob = new Blob([arrayBuffer], { type: 'audio/mpeg' });

        for (const f of ['input', 'midstage.wav', 'leveled.wav', 'output.mp3']) {
          try { await ffmpeg.deleteFile(f); } catch { /* may not exist */ }
        }

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
    [measureMeanDb, execOrThrow]
  );

  return { load, loaded, loading, processing, progress, statusMessage, processAudio };
}
