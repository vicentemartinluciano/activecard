import Feather from "@expo/vector-icons/Feather";
import * as FileSystem from "expo-file-system/legacy";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  PermissionsAndroid,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { initWhisper } from "whisper.rn/index";
import { RealtimeTranscriber } from "whisper.rn/realtime-transcription/RealtimeTranscriber";
import { AudioPcmStreamAdapter } from "whisper.rn/realtime-transcription/adapters/AudioPcmStreamAdapter";

import { colors, font, radius, spacing, type } from "../theme";

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

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

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
              transform: [{ translateY: dot.interpolate({ inputRange: [0, 1], outputRange: [2, -3] }) }],
            },
          ]}
        />
      ))}
    </View>
  );
}

export default function VoiceInput({ value, onChangeText }) {
  const [state, setState] = useState("idle"); // idle | downloading | recording | paused | processing
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState("");
  const [hint, setHint] = useState("");
  const transcriberRef = useRef(null);
  const segmentRef = useRef("");
  const accumulatedRef = useRef("");
  const baseRef = useRef("");
  const finalResolverRef = useRef(null);

  useEffect(() => () => {
    finalResolverRef.current = null;
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
    setHint("Modelo listo: tocá el micrófono para dictar");
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
          audioSliceSec: 5,
          audioMinSec: 0.6,
          realtimeProcessingPauseMs: 900,
          initRealtimeAfterMs: 500,
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
          onSliceTranscriptionStabilized: (text) => {
            const clean = text?.trim();
            if (clean) segmentRef.current = clean;
            finalResolverRef.current?.(clean || "");
            finalResolverRef.current = null;
          },
          onError: (message) => setError(String(message)),
        }
      );
      transcriberRef.current = transcriber;
      setState("recording");
      await transcriber.start();
    } catch (e) {
      setError(e.message || String(e));
      setState("idle");
    }
  };

  const pause = async () => {
    if (!transcriberRef.current) return;
    setState("processing");
    const transcriber = transcriberRef.current;
    const finalText = new Promise((resolve) => {
      finalResolverRef.current = resolve;
    });
    await transcriber.nextSlice();
    await Promise.race([finalText, wait(20000)]);
    await transcriber.stop();
    await transcriber.release();
    transcriberRef.current = null;
    finalResolverRef.current = null;
    accumulatedRef.current = [accumulatedRef.current, segmentRef.current]
      .filter(Boolean)
      .join(" ")
      .trim();
    segmentRef.current = "";
    onChangeText([baseRef.current, accumulatedRef.current].filter(Boolean).join(" ").trim());
    setState("paused");
  };

  const finish = async () => {
    if (transcriberRef.current) await pause();
    onChangeText([baseRef.current, accumulatedRef.current].filter(Boolean).join(" ").trim());
    accumulatedRef.current = "";
    segmentRef.current = "";
    baseRef.current = "";
    setState("idle");
  };

  const discard = async () => {
    finalResolverRef.current?.("");
    finalResolverRef.current = null;
    if (transcriberRef.current) {
      await transcriberRef.current.stop();
      await transcriberRef.current.release();
      transcriberRef.current = null;
    }
    onChangeText(baseRef.current);
    accumulatedRef.current = "";
    segmentRef.current = "";
    baseRef.current = "";
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
    await startSegment();
  };

  if (state === "downloading") {
    return (
      <View style={styles.download}>
        <ActivityIndicator color="#00F2FE" size="small" />
        <Text style={styles.downloadText}>{Math.round(progress * 100)}%</Text>
      </View>
    );
  }

  if (["recording", "paused", "processing"].includes(state)) {
    return (
      <View style={styles.audioPanel}>
        <View style={styles.voicePill}>
          <View style={[styles.statusDot, state === "paused" && styles.statusDotPaused]} />
          <VoiceDots active={state === "recording"} />
        </View>
        <Pressable
          onPress={state === "recording" ? pause : startSegment}
          disabled={state === "processing"}
          style={styles.control}
        >
          {state === "processing" ? (
            <ActivityIndicator color="#00F2FE" size="small" />
          ) : (
            <Feather name={state === "recording" ? "pause" : "play"} size={17} color="#00F2FE" />
          )}
        </Pressable>
        <Pressable onPress={discard} style={styles.quiet}>
          <Feather name="trash-2" size={17} color={colors.textMuted} />
        </Pressable>
        <Pressable
          accessibilityLabel="Cargar transcripción"
          onPress={finish}
          disabled={state === "processing"}
          style={[styles.finish, state === "processing" && { opacity: 0.45 }]}
        >
          <Feather name="check" size={18} color="#fff" />
        </Pressable>
      </View>
    );
  }

  return (
    <View>
      <Pressable accessibilityLabel="Dictar por voz" onPress={begin} style={styles.mic}>
        <Feather name="mic" size={18} color="#00F2FE" />
      </Pressable>
      {error ? <Text style={styles.error} numberOfLines={1}>{error}</Text> : null}
      {hint ? <Text style={styles.hint} numberOfLines={1}>{hint}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  mic: { width: 38, height: 38, borderRadius: 19, borderWidth: 1, borderColor: colors.cyanBorder, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(8,22,38,0.82)" },
  download: { width: 44, height: 38, alignItems: "center", justifyContent: "center" },
  downloadText: { ...type.small, ...font(600), fontSize: 9, color: "#00F2FE" },
  // Es hijo directo del composer: right: 0 lo alinea con su borde. El valor
  // negativo anterior empujaba justamente el botón de confirmar fuera del A15.
  audioPanel: { position: "absolute", right: 0, bottom: 50, zIndex: 20, elevation: 8, width: 248, height: 42, flexDirection: "row", alignItems: "center", justifyContent: "flex-end", gap: 6 },
  voicePill: { width: 102, height: 34, borderRadius: radius.pill, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm, backgroundColor: "#141822" },
  statusDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: "#F05D62" },
  statusDotPaused: { backgroundColor: colors.textMuted },
  dots: { height: 16, flexDirection: "row", alignItems: "center", gap: 5 },
  voiceDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: "#00F2FE" },
  control: { width: 34, height: 34, borderRadius: 17, backgroundColor: "#141822", alignItems: "center", justifyContent: "center" },
  quiet: { width: 34, height: 34, borderRadius: 17, backgroundColor: "#141822", alignItems: "center", justifyContent: "center" },
  finish: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.accent, alignItems: "center", justifyContent: "center" },
  error: { position: "absolute", width: 220, right: 0, bottom: 46, color: colors.danger, fontSize: 9 },
  hint: { position: "absolute", width: 240, right: 0, bottom: 46, color: "#00F2FE", fontSize: 9 },
});
