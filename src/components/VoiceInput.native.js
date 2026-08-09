import Feather from "@expo/vector-icons/Feather";
import * as FileSystem from "expo-file-system/legacy";
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, PanResponder, PermissionsAndroid, Platform, Pressable, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { initWhisper } from "whisper.rn/index";
import { RealtimeTranscriber } from "whisper.rn/realtime-transcription/RealtimeTranscriber";
import { AudioPcmStreamAdapter } from "whisper.rn/realtime-transcription/adapters/AudioPcmStreamAdapter";

import { colors, font, radius, spacing, tabular, type } from "../theme";

const MODEL_NAME = "ggml-base-q5_1.bin";
const MODEL_URL = `https://huggingface.co/ggerganov/whisper.cpp/resolve/main/${MODEL_NAME}`;
const MODEL_PATH = `${FileSystem.documentDirectory}${MODEL_NAME}`;

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

const elapsedLabel = (seconds) => `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export default function VoiceInput({ value, onChangeText }) {
  const { width: windowWidth } = useWindowDimensions();
  const [state, setState] = useState("idle"); // idle | downloading | recording | paused | processing
  const [progress, setProgress] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState("");
  const [hint, setHint] = useState("");
  const transcriberRef = useRef(null);
  const segmentRef = useRef("");
  const accumulatedRef = useRef("");
  const baseRef = useRef("");
  const lockedRef = useRef(false);
  const pressedRef = useRef(false);
  const startingRef = useRef(false);
  const latest = useRef({ begin: null, finish: null });

  useEffect(() => {
    if (state !== "recording") return undefined;
    const timer = setInterval(() => setElapsed((seconds) => seconds + 1), 1000);
    return () => clearInterval(timer);
  }, [state]);

  useEffect(() => () => {
    transcriberRef.current?.release().catch(() => {});
  }, []);

  const modelIsReady = async () => {
    const info = await FileSystem.getInfoAsync(MODEL_PATH);
    return info.exists && Number(info.size) > 50 * 1024 * 1024;
  };

  const ensureModel = async () => {
    if (await modelIsReady()) return true;
    await FileSystem.deleteAsync(MODEL_PATH, { idempotent: true });
    setState("downloading");
    setProgress(0);
    const download = FileSystem.createDownloadResumable(
      MODEL_URL,
      MODEL_PATH,
      {},
      ({ totalBytesWritten, totalBytesExpectedToWrite }) =>
        setProgress(totalBytesExpectedToWrite ? totalBytesWritten / totalBytesExpectedToWrite : 0)
    );
    const result = await download.downloadAsync();
    if (!result || result.status < 200 || result.status >= 300 || !(await modelIsReady())) {
      await FileSystem.deleteAsync(MODEL_PATH, { idempotent: true });
      throw new Error("No se pudo descargar Whisper.");
    }
    setState("idle");
    setHint("Modelo listo: mantené apretado para dictar");
    return true;
  };

  const startSegment = async () => {
    try {
      setError("");
      setHint("");
      if (Platform.OS === "android") {
        const permission = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.RECORD_AUDIO);
        if (permission !== PermissionsAndroid.RESULTS.GRANTED) return;
      }
      const whisper = await getWhisper();
      segmentRef.current = "";
      const transcriber = new RealtimeTranscriber(
        { whisperContext: whisper, audioStream: new AudioPcmStreamAdapter() },
        {
          audioSliceSec: 8,
          audioMinSec: 0.8,
          realtimeProcessingPauseMs: 1500,
          initRealtimeAfterMs: 900,
          transcribeOptions: { language: "es", maxThreads: 4 },
        },
        {
          onTranscribe: (event) => {
            const text = event.data?.result?.trim();
            if (!text) return;
            segmentRef.current = text;
            const spoken = [accumulatedRef.current, text].filter(Boolean).join(" ").trim();
            onChangeText([baseRef.current, spoken].filter(Boolean).join(" ").trim());
          },
          onError: (message) => setError(String(message)),
        }
      );
      transcriberRef.current = transcriber;
      setState("recording");
      startingRef.current = true;
      await transcriber.start();
      startingRef.current = false;
      // Si el usuario soltó mientras Android pedía permiso o Whisper iniciaba,
      // cerramos acá. Sin esta compuerta el micrófono podía quedar grabando solo.
      if (!pressedRef.current && !lockedRef.current) {
        await pause();
        await finish();
      }
    } catch (e) {
      startingRef.current = false;
      setError(e.message || String(e));
      setState("idle");
    }
  };

  const pause = async () => {
    if (!transcriberRef.current) return;
    setState("processing");
    const transcriber = transcriberRef.current;
    await transcriber.nextSlice();
    const deadline = Date.now() + 12000;
    while (transcriber.getStatistics().isTranscribing && Date.now() < deadline) {
      // Whisper Base puede tardar varios segundos en el Galaxy A15. Esperamos
      // el último corte antes de liberar el micrófono para no perder palabras.
      await wait(120);
    }
    await transcriber.stop();
    await transcriber.release();
    transcriberRef.current = null;
    accumulatedRef.current = [accumulatedRef.current, segmentRef.current].filter(Boolean).join(" ").trim();
    segmentRef.current = "";
    setState("paused");
  };

  const finish = async () => {
    if (transcriberRef.current) await pause();
    const spoken = [accumulatedRef.current, segmentRef.current].filter(Boolean).join(" ").trim();
    onChangeText([baseRef.current, spoken].filter(Boolean).join(" ").trim());
    accumulatedRef.current = "";
    segmentRef.current = "";
    baseRef.current = "";
    lockedRef.current = false;
    setElapsed(0);
    setState("idle");
  };

  const discard = async () => {
    if (transcriberRef.current) {
      await transcriberRef.current.stop();
      await transcriberRef.current.release();
      transcriberRef.current = null;
    }
    onChangeText(baseRef.current);
    accumulatedRef.current = "";
    segmentRef.current = "";
    baseRef.current = "";
    lockedRef.current = false;
    setElapsed(0);
    setState("idle");
  };

  const begin = async () => {
    if (state !== "idle") return;
    if (!(await modelIsReady())) {
      try {
        await ensureModel();
      } catch (e) {
        setError(e.message || String(e));
        setState("idle");
      }
      return;
    }
    baseRef.current = value.trim();
    accumulatedRef.current = "";
    lockedRef.current = false;
    setElapsed(0);
    await startSegment();
  };

  latest.current = { begin, finish };

  const responder = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onPanResponderGrant: () => {
      pressedRef.current = true;
      latest.current.begin();
    },
    onPanResponderMove: (_, gesture) => {
      if (gesture.dy < -48) lockedRef.current = true;
    },
    onPanResponderRelease: () => {
      pressedRef.current = false;
      if (!lockedRef.current && transcriberRef.current && !startingRef.current) {
        latest.current.finish().catch(() => {});
      }
    },
    onPanResponderTerminate: () => {
      pressedRef.current = false;
      if (!lockedRef.current && transcriberRef.current && !startingRef.current) {
        latest.current.finish().catch(() => {});
      }
    },
  })).current;

  if (state === "downloading") {
    return <View style={styles.download}><ActivityIndicator color="#00F2FE" size="small" /><Text style={styles.downloadText}>{Math.round(progress * 100)}%</Text></View>;
  }

  if (["recording", "paused", "processing"].includes(state)) {
    return (
      <View style={[styles.bar, { width: Math.min(322, windowWidth - 48) }]}>
        <View style={styles.dot} />
        <Text style={styles.time}>{elapsedLabel(elapsed)}</Text>
        <View style={styles.wave}>{[7, 13, 20, 10, 17, 8, 21, 12].map((height, i) => <View key={i} style={[styles.waveLine, { height }]} />)}</View>
        <Pressable onPress={state === "recording" ? pause : startSegment} disabled={state === "processing"} style={styles.control}>
          {state === "processing" ? <ActivityIndicator color="#00F2FE" size="small" /> : <Feather name={state === "recording" ? "pause" : "play"} size={18} color="#00F2FE" />}
        </Pressable>
        <Pressable onPress={discard} style={styles.quiet}><Feather name="trash-2" size={17} color={colors.textMuted} /></Pressable>
        <Pressable onPress={finish} style={styles.finish}><Feather name="check" size={18} color="#fff" /></Pressable>
      </View>
    );
  }

  return (
    <View>
      <View {...responder.panHandlers} style={styles.mic}><Feather name="mic" size={18} color="#00F2FE" /></View>
      {error ? <Text style={styles.error} numberOfLines={1}>{error}</Text> : null}
      {hint ? <Text style={styles.hint} numberOfLines={1}>{hint}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  mic: { width: 42, height: 42, borderRadius: 21, borderWidth: 1, borderColor: colors.cyanBorder, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(8,22,38,0.82)" },
  download: { width: 48, height: 42, alignItems: "center", justifyContent: "center" },
  downloadText: { ...type.small, ...font(600), fontSize: 9, color: "#00F2FE" },
  bar: { position: "absolute", right: -50, bottom: -6, height: 54, flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingHorizontal: spacing.sm, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.cardBorder, backgroundColor: "#141822" },
  dot: { width: 9, height: 9, borderRadius: 5, backgroundColor: "#F05D62" },
  time: { ...type.small, ...font(600), ...tabular, color: colors.text },
  wave: { flex: 1, height: 24, flexDirection: "row", alignItems: "center", justifyContent: "space-around" },
  waveLine: { width: 2, borderRadius: 1, backgroundColor: "#00F2FE" },
  control: { width: 34, height: 34, borderRadius: 17, borderWidth: 1, borderColor: colors.cyanBorder, alignItems: "center", justifyContent: "center" },
  quiet: { width: 30, height: 34, alignItems: "center", justifyContent: "center" },
  finish: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.accent, alignItems: "center", justifyContent: "center" },
  error: { position: "absolute", width: 180, right: 0, bottom: 46, color: colors.danger, fontSize: 9 },
  hint: { position: "absolute", width: 220, right: 0, bottom: 46, color: "#00F2FE", fontSize: 9 },
});
