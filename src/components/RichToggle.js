import Feather from "@expo/vector-icons/Feather";
import { useContext, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { colors } from "../theme";
import { StudyInteractionContext } from "./StudyInteractionContext";

export default function RichToggle({ title, children }) {
  const [open, setOpen] = useState(false);
  const interactionRef = useContext(StudyInteractionContext);
  const guard = (active) => {
    if (!interactionRef) return;
    interactionRef.current = active;
    interactionRef.suppressFlipUntil = Date.now() + 400;
  };
  return (
    <View style={styles.block}>
      <Pressable accessibilityRole="button" accessibilityState={{ expanded: open }}
        accessibilityHint={open ? "Contraer contenido" : "Expandir contenido"}
        onTouchStart={() => guard(true)} onTouchEnd={() => guard(false)} onTouchCancel={() => guard(false)}
        onPress={(event) => { event.stopPropagation(); guard(false); setOpen((value) => !value); }}
        style={({ pressed }) => [styles.title, pressed && styles.pressed]}>
        <View style={styles.arrow} pointerEvents="none">
          <Feather name={open ? "chevron-down" : "chevron-right"} size={15} color={colors.textMuted} />
        </View>
        <View style={styles.text}>{title}</View>
      </Pressable>
      {open && <View style={styles.content}>{children}</View>}
    </View>
  );
}

const styles = StyleSheet.create({
  block: { marginVertical: 5, width: "100%" },
  title: { minHeight: 44, flexDirection: "row", alignItems: "flex-start", paddingVertical: 10, borderRadius: 4 },
  pressed: { backgroundColor: "#FFFFFF08" },
  arrow: { width: 20, minHeight: 24, justifyContent: "center", alignItems: "center", opacity: 0.4 },
  text: { flex: 1 },
  content: { paddingLeft: 20, paddingTop: 2, paddingBottom: 4 },
});
