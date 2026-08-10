import Feather from "@expo/vector-icons/Feather";
import {
  ExpoSpeechRecognitionModule,
  useSpeechRecognitionEvent,
} from "@jamsch/expo-speech-recognition";
import * as FileSystem from "expo-file-system/legacy";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { initWhisper } from "whisper.rn/index";

import { composeTranscript, mergeTranscript } from "../lib/voiceTranscript";
import { colors, font, radius, spacing, type } from "../theme";

const MODEL_NAME = "ggml-base-q5_1.bin";
const MODEL_URL = `https://huggingface.co/ggerganov/whisper.cpp/resolve/main/${MODEL_NAME}`;
const MODEL_PATH = `${FileSystem.documentDirectory}${MODEL_NAME}`;
const MODEL_PART_PATH = `${MODEL_PATH}.part`;
// Tamaño publicado del modelo. El chequeo anterior aceptaba cualquier archivo
// mayor a 50 MiB, incluso una descarga cortada que Whisper no podía abrir.
const MODEL_SIZE = 59_707_625;
const AUDIO_HEADER_BYTES = 44;
const EVENT_TIMEOUT_MS = 6000;

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

function voiceError(error) {
  const message = String(error?.message || error || "");
  if (/permission|not-allowed|denied/i.test(message)) {
    return "Necesito permiso de micrófono para dictar.";
  }
  if (/download|network|fetch/i.test(message)) {
    return "No pude preparar la transcripción. Revisá internet y reintentá.";
  }
  if (/audio|speech|detect/i.test(message)) {
    return "No detecté voz. Probá hablar un poco más cerca del micrófono.";
  }
  return "No pude transcribir este audio. Podés reintentarlo.";
}

function VoiceDots({ active }) {
  const dots = useRef([
    new Animated.Value(0),
    new Animated.Value(0),
    new Animated.Value(0),
    new Animated.Value(0),
  ]).current;

  useEffect(() => {
    const animations = dots.map((dot, index) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(index * 90),
          Animated.timing(dot, { toValue: 1, duration: 220, useNativeDriver: true }),
          Animated.timing(dot, { toValue: 0, duration: 220, useNativeDriver: true }),
          Animated.delay((dots.length - index) * 90),
        ])
      )
    );
    if (active) animations.forEach((animation) => animation.start());
    else dots.forEach((dot) => dot.setValue(0));
    return () => animations.forEach((animation) => animation.stop());
  }, [active, dots]);

  return (
    <View style={styles.dots}>
      {dots.map((dot, index) => (
        <Animated.View
          key={index}
          style={[
            styles.voiceDot,
            {
              opacity: dot.interpolate({ inputRange: [0, 1], outputRange: [0.35, 1] }),
              transform: [
                { translateY: dot.interpolate({ inputRange: [0, 1], outputRange: [2, -3] }) },
              ],
            },
          ]}
        />
      ))}
    </View>
  );
}

export default function VoiceInput({ value, onChangeText, children }) {
  const [state, setState] = useState("idle"); // idle | recording | paused | processing
  const [progress, setProgress] = useState(null);
  const [error, setError] = useState("");

  const mountedRef = useRef(true);
  const stateRef = useRef(state);
  const onChangeRef = useRef(onChangeText);
  const valueRef = useRef(value);
  const lastPublishedRef = useRef(value);
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
  const latestRef = useRef({ unexpectedEnd: null });

  stateRef.current = state;
  onChangeRef.current = onChangeText;
  valueRef.current = value;

  const changeState = (nextState) => {
    stateRef.current = nextState;
    if (mountedRef.current) setState(nextState);
  };

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (recognizingRef.current) ExpoSpeechRecognitionModule.abort();
      const uri = sessionRef.current?.uri;
      if (uri) FileSystem.deleteAsync(uri, { idempotent: true }).catch(() => {});
    };
  }, []);

  const publish = (current = nativeSessionText(sessionRef.current)) => {
    if (!mountedRef.current) return;
    const nextValue = composeTranscript(baseRef.current, accumulatedRef.current, current);
    lastPublishedRef.current = nextValue;
    valueRef.current = nextValue;
    onChangeRef.current(nextValue);
  };

  useSpeechRecognitionEvent("result", (event) => {
    const session = sessionRef.current;
    const text = event.results?.[0]?.transcript?.trim();
    const acceptingFinalResult =
      (stateRef.current === "processing" &&
        ["pause", "finish"].includes(stopReasonRef.current)) ||
      (session?.draining && event.isFinal);
    if (!session || !text || (stateRef.current !== "recording" && !acceptingFinalResult)) {
      return;
    }

    // Si el usuario escribió mientras grababa, esa edición pasa a ser la nueva
    // base. Así un resultado tardío del reconocedor nunca pisa texto manual.
    if (valueRef.current.trim() !== lastPublishedRef.current.trim()) {
      baseRef.current = valueRef.current.trim();
      accumulatedRef.current = "";
      session.nativeFinal = "";
      session.nativeInterim = "";
    }
    if (event.isFinal) {
      session.nativeFinal = mergeTranscript(session.nativeFinal, text);
      session.nativeInterim = "";
    } else {
      session.nativeInterim = text;
    }
    publish();
  });

  useSpeechRecognitionEvent("error", (event) => {
    const session = sessionRef.current;
    if (!session) return;
    // abort() es el cierre intencional que usamos para obtener el WAV. Algunos
    // proveedores lo informan como "aborted" y otros como "client".
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
    const session = sessionRef.current;
    if (session) {
      session.endObserved = true;
      session.draining = !session.audioEnded;
    }
    recognizingRef.current = false;
    endResolverRef.current?.();
    endResolverRef.current = null;
    if (!stopReasonRef.current && stateRef.current === "recording") {
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
    // Android suele entregar un resultado final al detener. Ese camino es
    // inmediato; Whisper queda como respaldo real, no como paso obligatorio.
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

    // Algunos servicios de Android no responden a stop(). Recién entonces se
    // cancela: el WAV persistido sigue quedando disponible para Whisper.
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

  const processCapturedSession = async (session) => {
    if (!session || session.processed) return true;
    try {
      const text = await transcribeSession(session);
      accumulatedRef.current = mergeTranscript(accumulatedRef.current, text);
      session.processed = true;
      publish("");
      if (session.uri) {
        await FileSystem.deleteAsync(session.uri, { idempotent: true });
        session.uri = null;
      }
      if (mountedRef.current) {
        setError("");
      }
      return true;
    } catch (sessionError) {
      if (mountedRef.current) setError(voiceError(sessionError));
      return false;
    }
  };

  const finalizeCurrent = async ({ alreadyEnded = false, reason = "pause" } = {}) => {
    if (finalizingRef.current) return false;
    finalizingRef.current = true;
    if (mountedRef.current) {
      changeState("processing");
      setError("");
    }
    try {
      const session = alreadyEnded
        ? sessionRef.current
        : await closeCapture(reason);
      const ok = await processCapturedSession(session);
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
      changeState("recording");

      const availableServices = Platform.OS === "android"
        ? ExpoSpeechRecognitionModule.getSpeechRecognitionServices()
        : [];
      const services = Array.isArray(availableServices) ? availableServices : [];
      const googleService = services.includes("com.google.android.googlequicksearchbox")
        ? "com.google.android.googlequicksearchbox"
        : undefined;

      ExpoSpeechRecognitionModule.start({
        lang: "es-AR",
        interimResults: true,
        continuous: true,
        maxAlternatives: 1,
        addsPunctuation: true,
        ...(googleService ? { androidRecognitionServicePackage: googleService } : {}),
        ...(canPersist
          ? { recordingOptions: { persist: true, outputFileName: fileName } }
          : {}),
      });
    } catch (startError) {
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
    if (stateRef.current !== "idle") return;
    baseRef.current = value.trim();
    accumulatedRef.current = "";
    valueRef.current = value;
    lastPublishedRef.current = value;
    await startSegment();
  };

  const pause = async () => {
    if (stateRef.current !== "recording") return;
    await finalizeCurrent();
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
        ok = await processCapturedSession(sessionRef.current);
      } finally {
        finalizingRef.current = false;
      }
    }
    if (!ok) {
      changeState("paused");
      return;
    }
    lastPublishedRef.current = valueRef.current;
    baseRef.current = "";
    accumulatedRef.current = "";
    sessionRef.current = null;
    stopReasonRef.current = null;
    if (mountedRef.current) {
      setProgress(null);
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
      onChangeRef.current(baseRef.current);
      valueRef.current = baseRef.current;
      lastPublishedRef.current = baseRef.current;
      baseRef.current = "";
      accumulatedRef.current = "";
      sessionRef.current = null;
      if (mountedRef.current) {
        setError("");
        setProgress(null);
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

  const active = ["recording", "paused", "processing"].includes(state);
  const micButton = active ? (
    <View style={styles.micPlaceholder} />
  ) : (
    <Pressable accessibilityLabel="Dictar por voz" onPress={begin} style={styles.mic}>
      <Feather name="mic" size={18} color="#00F2FE" />
    </Pressable>
  );

  return (
    <View style={styles.area}>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {active ? (
        <View style={styles.audioPanel}>
          <View style={styles.voicePill}>
            {state === "processing" ? (
              <>
                <ActivityIndicator color="#00F2FE" size="small" />
                {progress != null ? (
                  <Text style={styles.progress}>{Math.round(progress * 100)}%</Text>
                ) : null}
              </>
            ) : (
              <>
                <View style={[styles.statusDot, state === "paused" && styles.statusDotPaused]} />
                <VoiceDots active={state === "recording"} />
              </>
            )}
          </View>
          <Pressable
            accessibilityLabel={state === "recording" ? "Pausar dictado" : "Continuar dictado"}
            onPress={state === "recording" ? pause : resume}
            disabled={state === "processing"}
            style={[styles.control, state === "processing" && styles.disabled]}
          >
            <Feather name={state === "recording" ? "pause" : "play"} size={16} color="#00F2FE" />
          </Pressable>
          <Pressable
            accessibilityLabel="Eliminar dictado"
            onPress={discard}
            disabled={state === "processing"}
            style={[styles.quiet, state === "processing" && styles.disabled]}
          >
            <Feather name="trash-2" size={16} color={colors.textMuted} />
          </Pressable>
          <Pressable
            accessibilityLabel="Cargar transcripción"
            onPress={finish}
            disabled={state === "processing"}
            style={[styles.finish, state === "processing" && styles.disabled]}
          >
            <Feather name="check" size={17} color="#fff" />
          </Pressable>
        </View>
      ) : null}
      {typeof children === "function" ? children({ micButton, active }) : micButton}
    </View>
  );
}

const styles = StyleSheet.create({
  area: {
    alignSelf: "stretch",
    gap: 4,
  },
  mic: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1,
    borderColor: colors.cyanBorder,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(8,22,38,0.82)",
  },
  micPlaceholder: { width: 38, height: 38 },
  // Fila real dentro del layout: Android puede medir y tocar todos sus botones
  // sin depender de overflow fuera del slot angosto del micrófono.
  audioPanel: {
    alignSelf: "flex-end",
    marginRight: 4,
    width: 182,
    height: 38,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 4,
  },
  voicePill: {
    width: 72,
    height: 32,
    borderRadius: radius.pill,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    backgroundColor: "#141822",
  },
  statusDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: "#F05D62" },
  statusDotPaused: { backgroundColor: colors.textMuted },
  dots: { height: 16, flexDirection: "row", alignItems: "center", gap: 4 },
  voiceDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: "#00F2FE" },
  progress: { ...type.small, ...font(600), fontSize: 9, color: "#00F2FE" },
  control: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#141822",
    alignItems: "center",
    justifyContent: "center",
  },
  quiet: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#141822",
    alignItems: "center",
    justifyContent: "center",
  },
  finish: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.accent,
    alignItems: "center",
    justifyContent: "center",
  },
  disabled: { opacity: 0.4 },
  error: {
    alignSelf: "flex-end",
    maxWidth: "100%",
    color: colors.danger,
    fontSize: 10,
    textAlign: "right",
  },
});
