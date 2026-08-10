import MicButton from "./MicButton";

export default function VoiceInput({ value, onChangeText, children }) {
  const micButton = (
    <MicButton
      onTranscript={(text) => onChangeText([value, text].filter(Boolean).join(" ").trim())}
    />
  );
  return typeof children === "function" ? children({ micButton, active: false }) : micButton;
}
