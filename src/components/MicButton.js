// Botón de dictado por voz (reconocimiento nativo, sin API paga).
// El resultado acumulado se deduplica por sesión para no repetir parciales.

import {
  ExpoSpeechRecognitionModule,
  useSpeechRecognitionEvent,
} from "@jamsch/expo-speech-recognition";
import Feather from "@expo/vector-icons/Feather";
import { useRef, useState } from "react";
import { Pressable, StyleSheet, Text } from "react-native";

import { mergeTranscript } from "../lib/voiceTranscript";
import { colors, radius } from "../theme";

export default function MicButton({ onTranscript, style }) {
  const [recording, setRecording] = useState(false);
  const [unavailable, setUnavailable] = useState(false);
  const finalRef = useRef("");

  useSpeechRecognitionEvent("result", (event) => {
    const transcript = event.results?.[0]?.transcript?.trim();
    if (!transcript) return;
    if (event.isFinal) {
      finalRef.current = mergeTranscript(finalRef.current, transcript);
      onTranscript?.(finalRef.current, true);
    } else {
      onTranscript?.(mergeTranscript(finalRef.current, transcript), false);
    }
  });
  useSpeechRecognitionEvent("end", () => setRecording(false));
  useSpeechRecognitionEvent("error", () => setRecording(false));

  const toggle = async () => {
    if (recording) {
      ExpoSpeechRecognitionModule.stop();
      return;
    }
    try {
      const perm = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
      if (!perm.granted) return;
      finalRef.current = "";
      ExpoSpeechRecognitionModule.start({
        lang: "es-AR",
        interimResults: true,
        continuous: false,
      });
      setRecording(true);
    } catch {
      setUnavailable(true);
    }
  };

  if (unavailable) return null;

  return (
    <Pressable
      accessibilityRole="button"
      onPress={toggle}
      style={({ pressed }) => [
        styles.button,
        style,
        recording && styles.recording,
        pressed && { opacity: 0.7 },
      ]}
      accessibilityLabel={recording ? "Detener dictado" : "Dictar por voz"}
    >
      {style ? (
        <Feather name={recording ? "square" : "mic"} size={18} color={colors.text} />
      ) : (
        <Text style={styles.icon}>{recording ? "■" : "🎙"}</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    width: 44,
    height: 44,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  recording: {
    borderColor: colors.danger,
    backgroundColor: "#2A1518",
  },
  icon: {
    fontSize: 18,
    color: colors.text,
  },
});
