import Svg, { Circle, Path } from "react-native-svg";

export default function BrainMark({ size = 34 }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 64 64" accessibilityLabel="ActiveCard IA">
      <Path
        d="M32 9C25 3 16 7 16 15c-7 0-10 8-6 13-6 5-3 15 4 16-1 8 8 13 14 8 2 4 4 5 4 5V9Z"
        fill="none"
        stroke="#42DCE7"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M32 9c7-6 16-2 16 6 7 0 10 8 6 13 6 5 3 15-4 16 1 8-8 13-14 8-2 4-4 5-4 5V9Z"
        fill="none"
        stroke="#7690F3"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M17 22h7v8h8M18 40h7l7 7M22 22v-6"
        fill="none"
        stroke="#42DCE7"
        strokeWidth="2.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Circle cx="17" cy="22" r="2.4" fill="#09090B" stroke="#42DCE7" strokeWidth="2.2" />
      <Circle cx="24" cy="30" r="2.4" fill="#09090B" stroke="#42DCE7" strokeWidth="2.2" />
      <Circle cx="25" cy="40" r="2.4" fill="#09090B" stroke="#42DCE7" strokeWidth="2.2" />
      <Path
        d="M42 19c-5 0-6 4-5 7m5 2c-3 1-4 4-2 7m6 2c-4 0-6 3-5 7"
        fill="none"
        stroke="#7690F3"
        strokeWidth="2.8"
        strokeLinecap="round"
      />
    </Svg>
  );
}
