import Feather from "@expo/vector-icons/Feather";
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";

import { composeTranscript, mergeTranscript } from "../lib/voiceTranscript";
import { colors, font, radius, tabular, type } from "../theme";

const WAVE_BARS = 44;
const METER_INTERVAL_MS = 65;
const DEFAULT_LEVELS = Array.from({ length: WAVE_BARS }, () => 0.16);

const getSpeechRecognition = () =>
  typeof window !== "undefined"
    ? window.SpeechRecognition || window.webkitSpeechRecognition || null
    : null;

const formatDuration = (seconds) => {
  const safe = Math.max(0, Math.floor(seconds));
  const mins = Math.floor(safe / 60);
  const secs = safe % 60;
  return `${mins}:${String(secs).padStart(2, "0")}`;
};

function webVoiceError(err) {
  const code = String(err?.error || err?.name || "").toLowerCase();
  const message = String(err?.message || err || "").toLowerCase();
  if (/not-allowed|permission|denied/.test(code) || /permission|denied|not-allowed/.test(message)) {
    return "Necesito permiso de micrófono para dictar.";
  }
  if (/no-speech/.test(code)) {
    return "No detecté voz. Probá hablar un poco más cerca del micrófono.";
  }
  if (/network/.test(code)) {
    return "El servicio de voz del navegador no pudo conectarse.";
  }
  return "No pude transcribir el dictado en este navegador.";
}

function WebWaveform({ levels, active }) {
  return (
    <View style={styles.waveform}>
      {levels.map((level, index) => (
        <View
          key={index}
          style={[
            styles.waveBar,
            {
              height: Math.round(4 + level * 24),
              opacity: active ? 0.45 + level * 0.55 : 0.25,
            },
          ]}
        />
      ))}
    </View>
  );
}

export default function VoiceInput({
  value,
  onChangeText,
  disabled = false,
  children,
  buttonStyle,
}) {
  const SpeechRecognition = getSpeechRecognition();
  const supported = Boolean(SpeechRecognition);

  const [phase, setPhase] = useState("idle"); // idle | starting | recording | paused
  const [elapsedSec, setElapsedSec] = useState(0);
  const [levels, setLevels] = useState(DEFAULT_LEVELS);
  const [error, setError] = useState("");

  const mountedRef = useRef(true);
  const phaseRef = useRef("idle");
  const valueRef = useRef(value);
  const onChangeRef = useRef(onChangeText);
  valueRef.current = value;
  onChangeRef.current = onChangeText;

  const baseRef = useRef("");
  const accumulatedRef = useRef("");
  const segmentFinalRef = useRef("");
  const segmentInterimRef = useRef("");
  const recognitionRef = useRef(null);
  const stopIntentRef = useRef(null); // "pause" | "finish" | "discard" | null
  const streamRef = useRef(null);
  const audioCtxRef = useRef(null);
  const analyserRef = useRef(null);
  const meterTimerRef = useRef(null);
  const clockTimerRef = useRef(null);
  const speakingUntilRef = useRef(0);
  const impulseRef = useRef(0);
  const tickRef = useRef(0);

  const setPhaseSafe = (next) => {
    phaseRef.current = next;
    if (mountedRef.current) setPhase(next);
  };

  const cleanupMeter = () => {
    clearInterval(meterTimerRef.current);
    meterTimerRef.current = null;
    analyserRef.current = null;
    if (audioCtxRef.current) {
      try {
        void audioCtxRef.current.close();
      } catch {}
      audioCtxRef.current = null;
    }
    if (streamRef.current) {
      try {
        streamRef.current.getTracks().forEach((track) => track.stop());
      } catch {}
      streamRef.current = null;
    }
  };

  const cleanupRecognition = () => {
    const rec = recognitionRef.current;
    recognitionRef.current = null;
    if (!rec) return;
    rec.onstart = null;
    rec.onaudiostart = null;
    rec.onspeechstart = null;
    rec.onspeechend = null;
    rec.onresult = null;
    rec.onerror = null;
    rec.onend = null;
    try {
      rec.abort();
    } catch {}
  };

  const stopClock = () => {
    clearInterval(clockTimerRef.current);
    clockTimerRef.current = null;
  };

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      stopClock();
      cleanupMeter();
      cleanupRecognition();
    };
  }, []);

  useEffect(() => {
    stopClock();
    clearInterval(meterTimerRef.current);
    meterTimerRef.current = null;
    if (phase !== "recording") return undefined;

    clockTimerRef.current = setInterval(() => {
      if (mountedRef.current) setElapsedSec((prev) => prev + 1);
    }, 1000);

    const samples = analyserRef.current ? new Uint8Array(analyserRef.current.fftSize) : null;
    meterTimerRef.current = setInterval(() => {
      if (!mountedRef.current || phaseRef.current !== "recording") return;
      let barLevel;
      if (analyserRef.current && samples) {
        analyserRef.current.getByteTimeDomainData(samples);
        let sum = 0;
        for (let i = 0; i < samples.length; i += 1) {
          const norm = (samples[i] - 128) / 128;
          sum += norm * norm;
        }
        const rms = Math.sqrt(sum / samples.length);
        barLevel = Math.max(0.14, Math.min(1, rms * 5.2));
      } else {
        tickRef.current += 1;
        const speaking = Date.now() < speakingUntilRef.current;
        const impulse = impulseRef.current;
        impulseRef.current = Math.max(0, impulse * 0.72);
        const raw = speaking
          ? 0.4 + Math.abs(Math.sin(tickRef.current * 0.65)) * 0.36 + impulse * 0.24
          : 0.16 + Math.abs(Math.sin(tickRef.current * 0.35)) * 0.1;
        barLevel = Math.max(0.14, Math.min(1, Number(raw.toFixed(2))));
      }
      setLevels((prev) => [...prev.slice(1), barLevel]);
    }, METER_INTERVAL_MS);

    return () => {
      stopClock();
      clearInterval(meterTimerRef.current);
      meterTimerRef.current = null;
    };
  }, [phase]);

  const flushSegment = () => {
    const segText = mergeTranscript(segmentFinalRef.current, segmentInterimRef.current);
    if (segText) {
      accumulatedRef.current = mergeTranscript(accumulatedRef.current, segText);
    }
    segmentFinalRef.current = "";
    segmentInterimRef.current = "";
  };

  const commitFinish = () => {
    flushSegment();
    cleanupMeter();
    cleanupRecognition();
    stopClock();
    const spoken = accumulatedRef.current.trim();
    if (spoken) {
      const combined = composeTranscript(baseRef.current, spoken);
      onChangeRef.current?.(combined);
    }
    baseRef.current = "";
    accumulatedRef.current = "";
    stopIntentRef.current = null;
    if (mountedRef.current) {
      setElapsedSec(0);
      setLevels(DEFAULT_LEVELS);
      setError("");
      setPhaseSafe("idle");
    }
  };

  const setupWebAudioMeter = async () => {
    if (
      typeof navigator === "undefined" ||
      !navigator.mediaDevices?.getUserMedia ||
      typeof window === "undefined"
    ) {
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
      if (!mountedRef.current || !["starting", "recording"].includes(phaseRef.current)) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      streamRef.current = stream;
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (typeof AudioCtx === "function") {
        const ctx = new AudioCtx();
        const source = ctx.createMediaStreamSource(stream);
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 256;
        source.connect(analyser);
        audioCtxRef.current = ctx;
        analyserRef.current = analyser;
      }
    } catch {
      // Si el navegador bloquea el stream paralelo, degrada a barras reactivas por eventos.
    }
  };

  const startSegment = async () => {
    if (!SpeechRecognition) return;
    setError("");
    stopIntentRef.current = null;
    segmentFinalRef.current = "";
    segmentInterimRef.current = "";
    speakingUntilRef.current = 0;
    impulseRef.current = 0;
    setPhaseSafe("starting");

    const rec = new SpeechRecognition();
    rec.lang = "es-AR";
    rec.continuous = true;
    rec.interimResults = true;
    rec.maxAlternatives = 1;
    recognitionRef.current = rec;

    rec.onstart = () => {
      if (phaseRef.current === "starting") setPhaseSafe("recording");
    };
    rec.onaudiostart = () => {
      if (phaseRef.current === "starting") setPhaseSafe("recording");
    };
    rec.onspeechstart = () => {
      if (phaseRef.current === "starting") setPhaseSafe("recording");
      speakingUntilRef.current = Date.now() + 900;
      impulseRef.current = 0.9;
    };
    rec.onspeechend = () => {
      speakingUntilRef.current = 0;
    };
    rec.onresult = (event) => {
      if (phaseRef.current === "starting") setPhaseSafe("recording");
      if (!event?.results) return;
      speakingUntilRef.current = Date.now() + 750;
      impulseRef.current = 1;
      let finals = "";
      let interims = "";
      for (let i = 0; i < event.results.length; i += 1) {
        const res = event.results[i];
        const transcript = res?.[0]?.transcript?.trim();
        if (!transcript) continue;
        if (res.isFinal) finals = mergeTranscript(finals, transcript);
        else interims = mergeTranscript(interims, transcript);
      }
      segmentFinalRef.current = finals;
      segmentInterimRef.current = interims;
    };
    rec.onerror = (event) => {
      if (stopIntentRef.current === "discard") return;
      if (stopIntentRef.current && event?.error === "aborted") return;
      cleanupMeter();
      flushSegment();
      stopIntentRef.current = null;
      if (mountedRef.current) {
        setError(webVoiceError(event));
        setPhaseSafe("paused");
      }
    };
    rec.onend = () => {
      const intent = stopIntentRef.current;
      recognitionRef.current = null;
      if (intent === "discard") return;
      if (intent === "finish") {
        commitFinish();
        return;
      }
      flushSegment();
      cleanupMeter();
      stopIntentRef.current = null;
      if (mountedRef.current && phaseRef.current !== "idle") {
        setPhaseSafe("paused");
      }
    };

    try {
      rec.start();
      void setupWebAudioMeter();
    } catch (startErr) {
      cleanupMeter();
      cleanupRecognition();
      if (mountedRef.current) {
        setError(webVoiceError(startErr));
        setPhaseSafe("idle");
      }
    }
  };

  const begin = () => {
    if (!supported || disabled || phaseRef.current !== "idle") return;
    baseRef.current = String(valueRef.current || "").trim();
    accumulatedRef.current = "";
    setElapsedSec(0);
    setLevels(DEFAULT_LEVELS);
    void startSegment();
  };

  const pause = () => {
    if (!["recording", "starting"].includes(phaseRef.current)) return;
    stopIntentRef.current = "pause";
    const rec = recognitionRef.current;
    if (rec) {
      try {
        rec.stop();
      } catch {
        flushSegment();
        cleanupMeter();
        setPhaseSafe("paused");
      }
    } else {
      flushSegment();
      cleanupMeter();
      setPhaseSafe("paused");
    }
  };

  const resume = () => {
    if (phaseRef.current !== "paused" || disabled) return;
    void startSegment();
  };

  const finish = () => {
    if (phaseRef.current === "idle") return;
    const rec = recognitionRef.current;
    if (rec) {
      stopIntentRef.current = "finish";
      try {
        rec.stop();
        return;
      } catch {
        // Fallback directo si el navegador ya detuvo el motor.
      }
    }
    commitFinish();
  };

  const discard = () => {
    stopIntentRef.current = "discard";
    cleanupMeter();
    cleanupRecognition();
    stopClock();
    baseRef.current = "";
    accumulatedRef.current = "";
    segmentFinalRef.current = "";
    segmentInterimRef.current = "";
    if (mountedRef.current) {
      setElapsedSec(0);
      setLevels(DEFAULT_LEVELS);
      setError("");
      setPhaseSafe("idle");
    }
  };

  if (!supported) {
    const emptyState = { micButton: null, panel: null, active: false, error: "" };
    return typeof children === "function" ? children(emptyState) : null;
  }

  const active = phase !== "idle";
  const starting = phase === "starting";

  const micButton = active ? (
    <View style={styles.micPlaceholder} />
  ) : (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Dictar por voz"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={begin}
      style={({ pressed }) => [styles.mic, buttonStyle, disabled && styles.disabled, pressed && styles.pressed]}
    >
      <Feather name="mic" size={18} color={buttonStyle ? colors.text : "#00F2FE"} />
    </Pressable>
  );

  const panel = active ? (
    <View style={styles.bar} accessibilityLiveRegion="polite">
      <View style={styles.leftMeta}>
        {starting ? (
          <>
            <ActivityIndicator color="#00F2FE" size="small" />
            <Text style={styles.statusText}>Preparando…</Text>
          </>
        ) : (
          <>
            <View style={[styles.recDot, phase === "paused" && styles.recDotPaused]} />
            <Text style={styles.timer}>{formatDuration(elapsedSec)}</Text>
          </>
        )}
      </View>
      <WebWaveform levels={levels} active={phase === "recording"} />
      <View style={styles.actions}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={phase === "recording" ? "Pausar dictado" : "Continuar dictado"}
          disabled={starting}
          onPress={phase === "recording" ? pause : resume}
          style={({ pressed }) => [styles.controlBtn, starting && styles.disabled, pressed && styles.pressed]}
        >
          <Feather name={phase === "recording" ? "pause" : "play"} size={16} color="#00F2FE" />
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Eliminar dictado"
          onPress={discard}
          style={({ pressed }) => [styles.controlBtn, pressed && styles.pressed]}
        >
          <Feather name="x" size={17} color={colors.textMuted} />
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Cargar transcripción"
          disabled={starting}
          onPress={finish}
          style={({ pressed }) => [styles.confirmBtn, starting && styles.disabled, pressed && styles.pressed]}
        >
          <Feather name="check" size={18} color="#FFFFFF" />
        </Pressable>
      </View>
    </View>
  ) : null;

  if (typeof children === "function") {
    return children({ micButton, panel, active, error });
  }

  return (
    <View style={styles.fallbackArea}>
      {error ? <Text style={styles.errorText}>{error}</Text> : null}
      {panel || micButton}
    </View>
  );
}

const styles = StyleSheet.create({
  fallbackArea: {
    alignSelf: "stretch",
    gap: 4,
  },
  errorText: {
    color: colors.danger,
    fontSize: 12,
    textAlign: "right",
  },
  mic: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.cyanBorder,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(8,22,38,0.82)",
  },
  micPlaceholder: {
    width: 40,
    height: 40,
  },
  bar: {
    flex: 1,
    minHeight: 40,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radius.pill,
  },
  leftMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    minWidth: 56,
  },
  recDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#F05D62",
  },
  recDotPaused: {
    backgroundColor: colors.textMuted,
  },
  timer: {
    ...type.small,
    fontSize: 12,
    color: colors.text,
    ...font(600),
    ...tabular,
  },
  statusText: {
    ...type.small,
    fontSize: 12,
    color: colors.text,
    ...font(600),
  },
  waveform: {
    flex: 1,
    height: 32,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    paddingHorizontal: 6,
    overflow: "hidden",
  },
  waveBar: {
    width: 3,
    borderRadius: 2,
    backgroundColor: "#00F2FE",
  },
  actions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  controlBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.cardBorder,
    backgroundColor: "rgba(255,255,255,0.04)",
  },
  confirmBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.accent,
  },
  disabled: {
    opacity: 0.35,
  },
  pressed: {
    opacity: 0.72,
  },
});
