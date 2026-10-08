// Botón de dictado por voz (reconocimiento nativo, sin API paga).
// El resultado se vuelca al campo de texto: la voz es un INPUT alternativo,
// el flujo del Gimnasio Mental sigue siendo por texto.

import {
  ExpoSpeechRecognitionModule,
  useSpeechRecognitionEvent,
} from "@jamsch/expo-speech-recognition";
import { useState } from "react";
import { Pressable, StyleSheet, Text } from "react-native";
import Feather from '@expo/vector-icons/Feather';

import { colors, radius } from "../theme";

export default function MicButton({ onTranscript, style }) {
  const [recording, setRecording] = useState(false);
  const [unavailable, setUnavailable] = useState(false);

  useSpeechRecognitionEvent("result", (event) => {
    const transcript = event.results && event.results[0] && event.results[0].transcript;
    if (transcript) onTranscript(transcript, event.isFinal);
  });
  useSpeechRecognitionEvent("end", () => setRecording(false));
  useSpeechRecognitionEvent("error", () => {
    setRecording(false);
  });

  const toggle = async () => {
    if (recording) {
      ExpoSpeechRecognitionModule.stop();
      return;
    }
    try {
      const perm = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
      if (!perm.granted) return;
      ExpoSpeechRecognitionModule.start({
        lang: "es-AR",
        interimResults: true,
        continuous: false,
      });
      setRecording(true);
    } catch (e) {
      // Sin soporte (Expo Go / navegador sin Web Speech): se oculta el botón.
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
      {style ? <Feather name={recording ? 'square' : 'mic'} size={18} color={colors.text} /> : <Text style={styles.icon}>{recording ? "■" : "🎙"}</Text>}
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
