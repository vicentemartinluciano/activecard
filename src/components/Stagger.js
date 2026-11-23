import { Children } from "react";
import { View } from "react-native";

// Mantiene la firma pública por compatibilidad sin re-disparar animaciones en cada foco.
export function useStaggerKey() {
  return 0;
}

export default function Stagger({ children, style }) {
  return Children.map(Children.toArray(children), (child, index) => (
    <View key={index} style={style}>
      {child}
    </View>
  ));
}

export function StaggerRow({ children, style }) {
  return <View style={style}>{children}</View>;
}
