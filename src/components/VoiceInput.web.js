import MicButton from "./MicButton";

export default function VoiceInput({ value, onChangeText }) {
  return <MicButton onTranscript={(text) => onChangeText([value, text].filter(Boolean).join(" ").trim())} />;
}
