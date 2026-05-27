"""
Voice Pain Analysis — librosa acoustic feature extraction.
Supports WebM/OGG/WAV from browser MediaRecorder.
Converts audio format using soundfile/audioread fallback chain.
"""
import os
import io
import tempfile
from typing import Optional

from pydantic import BaseModel
from backend.utils.logger import get_logger

log = get_logger(__name__)


class VoiceFeatures(BaseModel):
    mfcc_mean: list[float]
    mfcc_std: list[float]
    zcr_mean: float
    spectral_centroid: float
    f0_mean: float
    f0_std: float
    rms_energy: float
    pain_score: float
    confidence: float
    low_confidence: bool


def _load_audio_bytes(audio_bytes: bytes, hint_ext: str = ".webm"):
    """
    Try multiple strategies to decode audio bytes into (y, sr).
    Strategy order:
    1. soundfile direct (handles WAV, OGG/Vorbis — no ffmpeg needed)
    2. pydub (handles WebM/OGG/MP4 — needs ffmpeg, skipped gracefully if absent)
    3. librosa direct with multiple extensions as fallback
    Returns (y, sr) numpy arrays or raises Exception.
    """
    import librosa
    import numpy as np

    # Strategy 1: soundfile — handles OGG/WAV natively without ffmpeg
    try:
        import soundfile as sf
        buf = io.BytesIO(audio_bytes)
        data, sr_sf = sf.read(buf, dtype='float32', always_2d=False)
        if len(data) > 0:
            # Resample to 16kHz if needed
            if sr_sf != 16000:
                data = librosa.resample(data, orig_sr=sr_sf, target_sr=16000)
            log.debug(f"Audio decoded via soundfile: {len(data)/16000:.1f}s")
            return data, 16000
    except Exception as e:
        log.debug(f"soundfile strategy failed: {e}")

    # Strategy 2: pydub conversion (handles WebM/MP4 — needs ffmpeg)
    try:
        from pydub import AudioSegment
        with tempfile.NamedTemporaryFile(suffix=hint_ext, delete=False) as src:
            src.write(audio_bytes)
            src_path = src.name
        try:
            seg = AudioSegment.from_file(src_path)
            seg = seg.set_channels(1).set_frame_rate(16000)
            buf = io.BytesIO()
            seg.export(buf, format="wav")
            buf.seek(0)
            y, sr = librosa.load(buf, sr=16000, mono=True, duration=10.0)
            log.debug("Audio decoded via pydub")
            return y, sr
        finally:
            os.unlink(src_path)
    except Exception as e:
        log.debug(f"pydub strategy failed: {e}")

    # Strategy 3: librosa direct with multiple extensions
    for ext in [hint_ext, ".ogg", ".webm", ".wav"]:
        try:
            with tempfile.NamedTemporaryFile(suffix=ext, delete=False) as tmp:
                tmp.write(audio_bytes)
                tmp_path = tmp.name
            try:
                y, sr = librosa.load(tmp_path, sr=16000, mono=True, duration=10.0)
                log.debug(f"Audio decoded directly as {ext}")
                return y, sr
            finally:
                os.unlink(tmp_path)
        except Exception:
            continue

    raise ValueError("Could not decode audio with any strategy")


def extract_voice_features(audio_bytes: bytes, filename: str = "audio.webm") -> Optional[VoiceFeatures]:
    """
    Extract voice pain features from browser-recorded audio.
    Returns VoiceFeatures or None if audio is too short / unreadable.
    """
    try:
        import librosa
        import numpy as np

        hint_ext = os.path.splitext(filename)[1].lower() if filename else ".webm"
        if not hint_ext or hint_ext not in (".webm", ".ogg", ".wav", ".mp4", ".mp3", ".m4a"):
            hint_ext = ".webm"

        log.info(f"Voice analysis: {len(audio_bytes)} bytes, format hint: {hint_ext}")

        y, sr = _load_audio_bytes(audio_bytes, hint_ext)
        n_samples = len(y)
        duration_s = n_samples / sr

        log.info(f"Audio decoded: {duration_s:.1f}s at {sr}Hz")

        if duration_s < 2.0:
            log.warning(f"Audio too short: {duration_s:.1f}s < 2s minimum")
            return None

        confidence = 1.0
        low_confidence = duration_s < 7.0
        if low_confidence:
            confidence = 0.6

        # ── MFCC ─────────────────────────────────────────────────────────────
        mfcc = librosa.feature.mfcc(y=y, sr=sr, n_mfcc=13)
        mfcc_mean = mfcc.mean(axis=1).tolist()
        mfcc_std  = mfcc.std(axis=1).tolist()

        # ── Zero crossing rate ────────────────────────────────────────────────
        zcr_mean = float(librosa.feature.zero_crossing_rate(y).mean())

        # ── Spectral centroid ─────────────────────────────────────────────────
        spectral_centroid = float(librosa.feature.spectral_centroid(y=y, sr=sr).mean())

        # ── Fundamental frequency ─────────────────────────────────────────────
        try:
            f0, voiced_flag, _ = librosa.pyin(y, fmin=librosa.note_to_hz('C2'), fmax=librosa.note_to_hz('C7'), sr=sr)
            voiced = f0[voiced_flag == True] if voiced_flag is not None else np.array([])
            f0_mean = float(voiced.mean()) if len(voiced) > 0 else 0.0
            f0_std  = float(voiced.std())  if len(voiced) > 1 else 0.0
        except Exception:
            f0_mean, f0_std = 0.0, 0.0

        # ── RMS energy ────────────────────────────────────────────────────────
        rms_energy = float(librosa.feature.rms(y=y).mean())

        # ── Pain score heuristic (0–10) ───────────────────────────────────────
        pain_pitch_var = min(10.0, f0_std / 15.0)
        pain_centroid  = min(10.0, spectral_centroid / 400.0)
        pain_energy    = min(10.0, max(0.0, (0.08 - rms_energy) * 60))
        pain_score = round(max(0.0, min(10.0,
            pain_pitch_var * 0.4 + pain_centroid * 0.3 + pain_energy * 0.3
        )), 2)

        log.info(f"Voice done: pain={pain_score} f0_mean={f0_mean:.1f}Hz rms={rms_energy:.5f} confidence={confidence}")

        return VoiceFeatures(
            mfcc_mean=[round(v, 4) for v in mfcc_mean],
            mfcc_std=[round(v, 4) for v in mfcc_std],
            zcr_mean=round(zcr_mean, 6),
            spectral_centroid=round(spectral_centroid, 2),
            f0_mean=round(f0_mean, 2),
            f0_std=round(f0_std, 2),
            rms_energy=round(rms_energy, 6),
            pain_score=pain_score,
            confidence=round(confidence, 2),
            low_confidence=low_confidence,
        )

    except ImportError as e:
        log.error(f"Missing audio package: {e}")
        return None
    except Exception as exc:
        log.error(f"Voice feature extraction failed: {exc}")
        return None
