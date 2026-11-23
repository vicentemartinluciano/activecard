import Feather from "@expo/vector-icons/Feather";
import {
  ExpoSpeechRecognitionModule,
  useSpeechRecognitionEvent,
} from "@jamsch/expo-speech-recognition";
import * as FileSystem from "expo-file-system/legacy";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { initWhisper } from "whisper.rn/index";

import { composeTranscript, mergeTranscript } from "../lib/voiceTranscript";
import { colors, font, radius, tabular, type } from "../theme";

const MODEL_NAME = "ggml-base-q5_1.bin";
const MODEL_URL = `https://huggingface.co/ggerganov/whisper.cpp/resolve/main/${MODEL_NAME}`;
const MODEL_PATH = `${FileSystem.documentDirectory}${MODEL_NAME}`;
const MODEL_PART_PATH = `${MODEL_PATH}.part`;
// Tamaño publicado del modelo. Evita aceptar descargas cortadas que Whisper no puede abrir.
const MODEL_SIZE = 59_707_625;
const AUDIO_HEADER_BYTES = 44;
const EVENT_TIMEOUT_MS = 6000;
const START_FALLBACK_MS = 900;
const WAVE_BARS = 28;
const METER_INTERVAL_MS = 65;
const DEFAULT_LEVELS = Array.from({ length: WAVE_BARS }, () => 0.16);

let whisperPromise = null;

async function getWhisper() {
  if (!whisperPromise) {
    whisperPromise = initWhisper({ filePath: MODEL_PATH }).catch((error) => {
      whisperPromise = null;
      throw error;
    });
  }
  return whisperPromise;
}

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const nativeSessionText = (session) =>
  mergeTranscript(session?.nativeFinal || "", session?.nativeInterim || "");

const formatDuration = (seconds) => {
  const safe = Math.max(0, Math.floor(seconds));
  const mins = Math.floor(safe / 60);
  const secs = safe % 60;
  return `${mins}:${String(secs).padStart(2, "0")}`;
};

function voiceError(error) {
  const message = String(error?.message || error || "");
  if (/permission|not-allowed|denied/i.test(message)) {
    return "Necesito permiso de micrófono para dictar.";
  }
  if (/download|network|fetch/i.test(message)) {
    return "No pude preparar la transcripción. Revisá internet y reintentá.";
  }
  if (/audio|speech|detect|empty/i.test(message)) {
    return "No detecté voz. Probá hablar un poco más cerca del micrófono.";
  }
  return "No pude transcribir este audio. Podés reintentarlo.";
}

function VoiceWaveform({ levels, active }) {
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
  const [state, setState] = useState("idle"); // idle | starting | recording | paused | processing
  const [progress, setProgress] = useState(null);
  const [elapsedSec, setElapsedSec] = useState(0);
  const [levels, setLevels] = useState(DEFAULT_LEVELS);
  const [error, setError] = useState("");

  const mountedRef = useRef(true);
  const stateRef = useRef(state);
  const onChangeRef = useRef(onChangeText);
  const valueRef = useRef(value);
  const baseRef = useRef("");
  const accumulatedRef = useRef("");
  const sessionRef = useRef(null);
  const sequenceRef = useRef(0);
  const startingRef = useRef(false);
  const recognizingRef = useRef(false);
  const finalizingRef = useRef(false);
  const stopReasonRef = useRef(null);
  const audioResolverRef = useRef(null);
  const endResolverRef = useRef(null);
  const startFallbackRef = useRef(null);
  const meterTimerRef = useRef(null);
  const clockTimerRef = useRef(null);
  const speakingUntilRef = useRef(0);
  const impulseRef = useRef(0);
  const meterTickRef = useRef(0);
  const latestRef = useRef({ unexpectedEnd: null });

  stateRef.current = state;
  onChangeRef.current = onChangeText;
  valueRef.current = value;

  const changeState = (nextState) => {
    stateRef.current = nextState;
    if (mountedRef.current) setState(nextState);
  };

  const stopVisualLoops = () => {
    clearTimeout(startFallbackRef.current);
    startFallbackRef.current = null;
    clearInterval(meterTimerRef.current);
    meterTimerRef.current = null;
    clearInterval(clockTimerRef.current);
    clockTimerRef.current = null;
  };

  const markAudioReady = () => {
    clearTimeout(startFallbackRef.current);
    startFallbackRef.current = null;
    if (stateRef.current === "starting" && !stopReasonRef.current && mountedRef.current) {
      changeState("recording");
    }
  };

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      stopVisualLoops();
      if (recognizingRef.current) {
        try {
          ExpoSpeechRecognitionModule.abort();
        } catch {}
      }
      const uri = sessionRef.current?.uri;
      if (uri) FileSystem.deleteAsync(uri, { idempotent: true }).catch(() => {});
    };
  }, []);

  useEffect(() => {
    clearInterval(meterTimerRef.current);
    clearInterval(clockTimerRef.current);
    meterTimerRef.current = null;
    clockTimerRef.current = null;
    if (state !== "recording") return undefined;

    clockTimerRef.current = setInterval(() => {
      if (mountedRef.current) setElapsedSec((prev) => prev + 1);
    }, 1000);

    meterTimerRef.current = setInterval(() => {
      if (!mountedRef.current || stateRef.current !== "recording") return;
      meterTickRef.current += 1;
      const tick = meterTickRef.current;
      const speaking = Date.now() < speakingUntilRef.current;
      const impulse = impulseRef.current;
      impulseRef.current = Math.max(0, impulse * 0.72);
      const base = speaking
        ? 0.42 + Math.abs(Math.sin(tick * 0.65)) * 0.34 + impulse * 0.24
        : 0.16 + Math.abs(Math.sin(tick * 0.35)) * 0.1;
      const level = Math.max(0.14, Math.min(1, Number(base.toFixed(2))));
      setLevels((prev) => [...prev.slice(1), level]);
    }, METER_INTERVAL_MS);

    return () => {
      clearInterval(meterTimerRef.current);
      clearInterval(clockTimerRef.current);
      meterTimerRef.current = null;
      clockTimerRef.current = null;
    };
  }, [state]);

  useSpeechRecognitionEvent("audiostart", () => {
    markAudioReady();
  });

  useSpeechRecognitionEvent("start", () => {
    markAudioReady();
  });

  useSpeechRecognitionEvent("speechstart", () => {
    markAudioReady();
    speakingUntilRef.current = Date.now() + 900;
    impulseRef.current = 0.9;
  });

  useSpeechRecognitionEvent("soundstart", () => {
    markAudioReady();
    speakingUntilRef.current = Date.now() + 700;
    impulseRef.current = Math.max(impulseRef.current, 0.7);
  });

  useSpeechRecognitionEvent("speechend", () => {
    speakingUntilRef.current = 0;
  });

  useSpeechRecognitionEvent("soundend", () => {
    speakingUntilRef.current = 0;
  });

  useSpeechRecognitionEvent("result", (event) => {
    markAudioReady();
    const session = sessionRef.current;
    const text = event.results?.[0]?.transcript?.trim();
    const acceptingFinalResult =
      (stateRef.current === "processing" &&
        ["pause", "finish"].includes(stopReasonRef.current)) ||
      (session?.draining && event.isFinal);
    if (!session || !text || (stateRef.current !== "recording" && !acceptingFinalResult)) {
      return;
    }

    speakingUntilRef.current = Date.now() + 750;
    impulseRef.current = 1;

    if (event.isFinal) {
      session.nativeFinal = mergeTranscript(session.nativeFinal, text);
      session.nativeInterim = "";
    } else {
      session.nativeInterim = text;
    }
  });

  useSpeechRecognitionEvent("error", (event) => {
    const session = sessionRef.current;
    if (!session) return;
    if (stopReasonRef.current && ["aborted", "client"].includes(event.error)) return;
    session.nativeError = event.message || event.error;
  });

  useSpeechRecognitionEvent("audioend", (event) => {
    const session = sessionRef.current;
    if (!session || (event.uri && session.fileName && !event.uri.includes(session.fileName))) {
      if (event.uri) FileSystem.deleteAsync(event.uri, { idempotent: true }).catch(() => {});
      return;
    }
    if (event.uri) session.uri = event.uri;
    session.audioEnded = true;
    session.draining = !session.endObserved;
    audioResolverRef.current?.(session.uri);
    audioResolverRef.current = null;
  });

  useSpeechRecognitionEvent("end", () => {
    clearTimeout(startFallbackRef.current);
    startFallbackRef.current = null;
    speakingUntilRef.current = 0;
    const session = sessionRef.current;
    if (session) {
      session.endObserved = true;
      session.draining = !session.audioEnded;
    }
    recognizingRef.current = false;
    endResolverRef.current?.();
    endResolverRef.current = null;
    if (!stopReasonRef.current && ["starting", "recording"].includes(stateRef.current)) {
      latestRef.current.unexpectedEnd?.();
    }
  });

  const modelIsReady = async () => {
    const info = await FileSystem.getInfoAsync(MODEL_PATH);
    return info.exists && Number(info.size) === MODEL_SIZE;
  };

  const ensureModel = async () => {
    if (await modelIsReady()) return;
    await FileSystem.deleteAsync(MODEL_PATH, { idempotent: true });
    await FileSystem.deleteAsync(MODEL_PART_PATH, { idempotent: true });
    if (mountedRef.current) {
      setProgress(0);
    }
    const download = FileSystem.createDownloadResumable(
      MODEL_URL,
      MODEL_PART_PATH,
      {},
      ({ totalBytesWritten, totalBytesExpectedToWrite }) => {
        if (!mountedRef.current) return;
        setProgress(totalBytesExpectedToWrite ? totalBytesWritten / totalBytesExpectedToWrite : 0);
      }
    );
    const result = await download.downloadAsync();
    const info = await FileSystem.getInfoAsync(MODEL_PART_PATH);
    if (!result || result.status < 200 || result.status >= 300 || !info.exists || Number(info.size) !== MODEL_SIZE) {
      await FileSystem.deleteAsync(MODEL_PART_PATH, { idempotent: true });
      throw new Error("download incomplete");
    }
    await FileSystem.moveAsync({ from: MODEL_PART_PATH, to: MODEL_PATH });
    if (mountedRef.current) setProgress(null);
  };

  const transcribeSession = async (session) => {
    const nativeFinal = session?.nativeFinal?.trim() || "";
    const nativeText = nativeSessionText(session);
    // Si el motor del sistema entregó resultado final limpio, se usa directo;
    // Whisper queda como respaldo local sobre el WAV persistido.
    if (nativeFinal && !session.nativeError && !session.forceWhisper) return nativeText;
    if (!session?.uri) {
      if (nativeText) return nativeText;
      throw new Error(session?.nativeError || "audio uri missing");
    }

    const audioInfo = await FileSystem.getInfoAsync(session.uri);
    if (!audioInfo.exists || Number(audioInfo.size) <= AUDIO_HEADER_BYTES) {
      if (nativeText) return nativeText;
      throw new Error("audio recording is empty");
    }

    try {
      await ensureModel();
      if (mountedRef.current) setProgress(null);
      const whisper = await getWhisper();
      const { promise } = whisper.transcribe(session.uri, {
        language: "es",
        maxThreads: 4,
      });
      const result = await promise;
      const text = result?.result?.trim();
      if (text) return text;
      if (nativeText) return nativeText;
      throw new Error("speech was not detected");
    } catch (transcriptionError) {
      if (nativeText) return nativeText;
      throw transcriptionError;
    }
  };

  const closeCapture = async (reason) => {
    clearTimeout(startFallbackRef.current);
    startFallbackRef.current = null;
    const session = sessionRef.current;
    if (!session) return session;
    if (session.audioEnded && session.endObserved) return session;
    stopReasonRef.current = reason;
    session.draining = true;
    const audioEnded = session.audioEnded
      ? Promise.resolve(session.uri)
      : new Promise((resolve) => {
          audioResolverRef.current = resolve;
        });
    const recognitionEnded = session.endObserved
      ? Promise.resolve()
      : new Promise((resolve) => {
          endResolverRef.current = resolve;
        });
    const completed = Promise.all([audioEnded, recognitionEnded]);
    const shouldKeepNativeResult = reason !== "discard";

    if (recognizingRef.current) {
      if (shouldKeepNativeResult) ExpoSpeechRecognitionModule.stop();
      else ExpoSpeechRecognitionModule.abort();
    }

    let didComplete = await Promise.race([
      completed.then(() => true),
      wait(EVENT_TIMEOUT_MS).then(() => false),
    ]);

    if (!didComplete && shouldKeepNativeResult) {
      session.forceWhisper = true;
      ExpoSpeechRecognitionModule.abort();
      didComplete = await Promise.race([
        completed.then(() => true),
        wait(2000).then(() => false),
      ]);
    }

    if (!didComplete) throw new Error("audio stop timeout");

    recognizingRef.current = false;
    session.draining = false;
    audioResolverRef.current = null;
    endResolverRef.current = null;
    return session;
  };

  const processCapturedSession = async (session, { allowEmptyIfAccumulated = false } = {}) => {
    if (!session || session.processed) return true;
    try {
      const text = await transcribeSession(session);
      accumulatedRef.current = mergeTranscript(accumulatedRef.current, text);
      session.processed = true;
      if (session.uri) {
        await FileSystem.deleteAsync(session.uri, { idempotent: true });
        session.uri = null;
      }
      if (mountedRef.current) {
        setError("");
      }
      return true;
    } catch (sessionError) {
      if (allowEmptyIfAccumulated && accumulatedRef.current.trim()) {
        session.processed = true;
        if (session.uri) {
          await FileSystem.deleteAsync(session.uri, { idempotent: true }).catch(() => {});
          session.uri = null;
        }
        if (mountedRef.current) setError("");
        return true;
      }
      if (mountedRef.current) setError(voiceError(sessionError));
      return false;
    }
  };

  const finalizeCurrent = async ({ alreadyEnded = false, reason = "pause" } = {}) => {
    if (finalizingRef.current) return false;
    finalizingRef.current = true;
    speakingUntilRef.current = 0;
    if (mountedRef.current) {
      changeState("processing");
      setError("");
    }
    try {
      const session = alreadyEnded
        ? sessionRef.current
        : await closeCapture(reason);
      const ok = await processCapturedSession(session, {
        allowEmptyIfAccumulated: reason === "finish",
      });
      changeState("paused");
      return ok;
    } catch (closeError) {
      if (mountedRef.current) {
        setError(voiceError(closeError));
        changeState("paused");
      }
      return false;
    } finally {
      finalizingRef.current = false;
      stopReasonRef.current = null;
      if (mountedRef.current) setProgress(null);
    }
  };

  const handleUnexpectedEnd = async () => {
    if (finalizingRef.current || stopReasonRef.current) return;
    await finalizeCurrent({ alreadyEnded: true });
  };
  latestRef.current.unexpectedEnd = handleUnexpectedEnd;

  const startSegment = async () => {
    if (startingRef.current || recognizingRef.current || finalizingRef.current) return;
    if (sessionRef.current && !sessionRef.current.processed) {
      if (mountedRef.current) {
        setError("Primero necesito terminar de transcribir el audio pendiente.");
        changeState("paused");
      }
      return;
    }
    startingRef.current = true;
    try {
      setError("");
      changeState("starting");
      const permission = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
      if (!permission.granted) throw new Error("permission denied");
      if (!mountedRef.current) return;

      const id = ++sequenceRef.current;
      const fileName = `activecard-voice-${Date.now()}-${id}.wav`;
      const canPersist = ExpoSpeechRecognitionModule.supportsRecording();
      sessionRef.current = {
        id,
        fileName,
        uri: null,
        nativeFinal: "",
        nativeInterim: "",
        nativeError: "",
        processed: false,
        forceWhisper: false,
        audioEnded: false,
        endObserved: false,
        draining: false,
      };
      stopReasonRef.current = null;
      recognizingRef.current = true;
      speakingUntilRef.current = 0;
      impulseRef.current = 0;

      const availableServices = Platform.OS === "android"
        ? ExpoSpeechRecognitionModule.getSpeechRecognitionServices()
        : [];
      const services = Array.isArray(availableServices) ? availableServices : [];
      const googleService = services.includes("com.google.android.googlequicksearchbox")
        ? "com.google.android.googlequicksearchbox"
        : undefined;

      clearTimeout(startFallbackRef.current);
      startFallbackRef.current = setTimeout(() => {
        markAudioReady();
      }, START_FALLBACK_MS);

      ExpoSpeechRecognitionModule.start({
        lang: "es-AR",
        interimResults: true,
        continuous: true,
        maxAlternatives: 1,
        addsPunctuation: true,
        ...(googleService ? { androidRecognitionServicePackage: googleService } : {}),
        ...(Platform.OS === "android"
          ? {
              androidIntentOptions: {
                EXTRA_SPEECH_INPUT_COMPLETE_SILENCE_LENGTH_MILLIS: 4500,
                EXTRA_SPEECH_INPUT_POSSIBLY_COMPLETE_SILENCE_LENGTH_MILLIS: 3000,
                EXTRA_SPEECH_INPUT_MINIMUM_LENGTH_MILLIS: 10000,
              },
            }
          : {}),
        ...(canPersist
          ? { recordingOptions: { persist: true, outputFileName: fileName } }
          : {}),
      });
    } catch (startError) {
      clearTimeout(startFallbackRef.current);
      startFallbackRef.current = null;
      recognizingRef.current = false;
      sessionRef.current = null;
      if (mountedRef.current) {
        setError(voiceError(startError));
        changeState("idle");
      }
    } finally {
      startingRef.current = false;
    }
  };

  const begin = async () => {
    if (disabled || stateRef.current !== "idle") return;
    baseRef.current = String(valueRef.current || "").trim();
    accumulatedRef.current = "";
    setElapsedSec(0);
    setLevels(DEFAULT_LEVELS);
    await startSegment();
  };

  const pause = async () => {
    if (!["recording", "starting"].includes(stateRef.current)) return;
    await finalizeCurrent({ reason: "pause" });
  };

  const resume = async () => {
    if (stateRef.current !== "paused" || finalizingRef.current) return;
    const pending = sessionRef.current;
    if (pending?.draining) {
      setError("Todavía estoy cerrando el audio. Reintentá en un momento.");
      return;
    }
    if (pending && !pending.processed) {
      finalizingRef.current = true;
      changeState("processing");
      let ok = false;
      try {
        ok = await processCapturedSession(pending);
      } finally {
        finalizingRef.current = false;
      }
      if (!ok) {
        changeState("paused");
        return;
      }
    }
    await startSegment();
  };

  const finish = async () => {
    if (finalizingRef.current) return;
    let ok = true;
    if (recognizingRef.current || sessionRef.current?.draining) {
      ok = await finalizeCurrent({ reason: "finish" });
    } else if (sessionRef.current && !sessionRef.current.processed) {
      finalizingRef.current = true;
      changeState("processing");
      try {
        ok = await processCapturedSession(sessionRef.current, {
          allowEmptyIfAccumulated: true,
        });
      } finally {
        finalizingRef.current = false;
      }
    }
    if (!ok) {
      changeState("paused");
      return;
    }
    const finalSpoken = accumulatedRef.current.trim();
    if (finalSpoken) {
      const nextValue = composeTranscript(baseRef.current, finalSpoken);
      onChangeRef.current?.(nextValue);
    }
    baseRef.current = "";
    accumulatedRef.current = "";
    sessionRef.current = null;
    stopReasonRef.current = null;
    if (mountedRef.current) {
      setProgress(null);
      setElapsedSec(0);
      setLevels(DEFAULT_LEVELS);
      changeState("idle");
    }
  };

  const discard = async () => {
    if (finalizingRef.current) return;
    finalizingRef.current = true;
    changeState("processing");
    try {
      const session = recognizingRef.current || sessionRef.current?.draining
        ? await closeCapture("discard")
        : sessionRef.current;
      if (session?.uri) {
        await FileSystem.deleteAsync(session.uri, { idempotent: true }).catch(() => {});
      }
      baseRef.current = "";
      accumulatedRef.current = "";
      sessionRef.current = null;
      if (mountedRef.current) {
        setError("");
        setProgress(null);
        setElapsedSec(0);
        setLevels(DEFAULT_LEVELS);
        changeState("idle");
      }
    } catch (discardError) {
      if (mountedRef.current) {
        setError(voiceError(discardError));
        changeState("paused");
      }
    } finally {
      finalizingRef.current = false;
      stopReasonRef.current = null;
    }
  };

  const active = ["starting", "recording", "paused", "processing"].includes(state);
  const lockedControl = state === "processing" || state === "starting";

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
        {state === "starting" || state === "processing" ? (
          <>
            <ActivityIndicator color="#00F2FE" size="small" />
            <Text style={styles.statusText} numberOfLines={1}>
              {state === "starting"
                ? "Preparando…"
                : progress != null
                  ? `${Math.round(progress * 100)}%`
                  : "Procesando…"}
            </Text>
          </>
        ) : (
          <>
            <View style={[styles.recDot, state === "paused" && styles.recDotPaused]} />
            <Text style={styles.timer}>{formatDuration(elapsedSec)}</Text>
          </>
        )}
      </View>
      <VoiceWaveform levels={levels} active={state === "recording"} />
      <View style={styles.actions}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={state === "recording" ? "Pausar dictado" : "Continuar dictado"}
          disabled={lockedControl}
          onPress={state === "recording" ? pause : resume}
          style={({ pressed }) => [styles.controlBtn, lockedControl && styles.disabled, pressed && styles.pressed]}
        >
          <Feather name={state === "recording" ? "pause" : "play"} size={16} color="#00F2FE" />
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Eliminar dictado"
          disabled={state === "processing"}
          onPress={discard}
          style={({ pressed }) => [styles.controlBtn, state === "processing" && styles.disabled, pressed && styles.pressed]}
        >
          <Feather name="x" size={17} color={colors.textMuted} />
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Cargar transcripción"
          disabled={lockedControl}
          onPress={finish}
          style={({ pressed }) => [styles.confirmBtn, lockedControl && styles.disabled, pressed && styles.pressed]}
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
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: radius.pill,
  },
  leftMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    minWidth: 52,
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
    height: 30,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 3,
    paddingHorizontal: 4,
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
    gap: 6,
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
