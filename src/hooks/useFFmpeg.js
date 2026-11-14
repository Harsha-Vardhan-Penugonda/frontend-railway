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

// -0.4dB is where the original digit/phrase clips (daya_chesi, kindAttention,
// 0-9 in all 3 languages) actually peak - matching it exactly is what makes
// everything sound consistent instead of a little quieter.
const TARGET_PEAK_DB = -0.4;
// Every lossy encode pass shifts the decoded peak down by ~0.4dB from what
// the pre-encode gain math predicts (confirmed server-side by re-encoding a
// file at 0dB gain and watching its measured peak drop anyway) - compensate
// for it in the one encode pass below.
const ENCODE_SHIFT_COMPENSATION_DB = 0.4;

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

  // Measures the true peak of a file already written into ffmpeg's virtual
  // filesystem, by running volumedetect and reading its result back out of
  // the logged output (ffmpeg.wasm doesn't return stderr from exec()).
  const measurePeakDb = useCallback(async (filename) => {
    const ffmpeg = ffmpegRef.current;
    logBufferRef.current = [];
    await execOrThrow(ffmpeg, ['-i', filename, '-af', 'volumedetect', '-f', 'null', '-']);
    const combined = logBufferRef.current.join('\n');
    const match = combined.match(/max_volume:\s*(-?[\d.]+|-inf)\s*dB/);
    if (!match || match[1] === '-inf') return null;
    return parseFloat(match[1]);
  }, [execOrThrow]);

  // minSilenceSeconds mirrors the same "how much silence to trim" knob the
  // server-side pipeline exposes - lower = more aggressive, higher = gentler.
  // Normalization is a real gain adjustment based on a measured peak (see
  // measurePeakDb), not loudnorm - loudnorm's single-pass EBU R128 algorithm
  // needs several seconds of audio to work with, and these are mostly 1-2s
  // single-word clips, so it was silently a near no-op on exactly the files
  // that most needed it (this is what made station/train-name recordings
  // come out noticeably quieter than the fixed phrase clips).
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

        await execOrThrow(ffmpeg, ['-i', 'input', '-af', stage1Filters.join(','), '-codec:a', 'libmp3lame', '-q:a', '2', '-y', 'midstage.mp3']);

        let finalFile = 'midstage.mp3';
        if (normalization) {
          setStatusMessage('Normalizing audio...');
          const peakDb = await measurePeakDb('midstage.mp3');
          if (peakDb !== null) {
            const gainDb = (TARGET_PEAK_DB - peakDb) + ENCODE_SHIFT_COMPENSATION_DB;
            await execOrThrow(ffmpeg, ['-i', 'midstage.mp3', '-af', `volume=${gainDb}dB`, '-codec:a', 'libmp3lame', '-q:a', '2', '-y', 'output.mp3']);
            finalFile = 'output.mp3';
          }
        }

        setStatusMessage('Finalizing...');
        const data = await ffmpeg.readFile(finalFile);
        const arrayBuffer = data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength);
        const blob = new Blob([arrayBuffer], { type: 'audio/mpeg' });

        for (const f of ['input', 'midstage.mp3', 'output.mp3']) {
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
    [measurePeakDb, execOrThrow]
  );

  return { load, loaded, loading, processing, progress, statusMessage, processAudio };
}
