// Tarjeta de estudio: una sola cara con layout natural. El "giro" es un
// aplastado horizontal (scaleX) — robusto en Android new-arch, donde el
// enfoque de dos caras absolutas con rotateY/opacity se rompía.

import Feather from "@expo/vector-icons/Feather";
import FontAwesome from "@expo/vector-icons/FontAwesome";
import { useEffect, useRef, useState } from "react";
import { Animated, Platform, Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from "react-native";

import RichText from "./RichText";
import { colors, radius, spacing, textColors, type } from "../theme";

// RN Web convierte Pressable + role button en BUTTON. La superficie contiene
// otros botones, por lo que usamos un DIV accesible para evitar HTML anidado
// inválido. Android conserva su Pressable y su gestión de toques.
function WebFlipSurface({ children, onPress, accessibilityLabel, style }) {
  return <div role="button" tabIndex={0} data-study-flip="true" aria-label={accessibilityLabel}
    onClick={onPress}
    onKeyDown={(event) => {
      if (event.target !== event.currentTarget || !['Enter', ' '].includes(event.key)) return;
      const key = event.nativeEvent || event;
      if (key.ctrlKey || key.metaKey || key.altKey || key.isComposing) return;
      event.preventDefault();
      event.stopPropagation();
      if (!event.repeat) onPress();
    }}
    style={{ display: 'flex', flexDirection: 'column', cursor: 'pointer', outline: 'none', ...StyleSheet.flatten(style) }}>
    {children}
  </div>;
}

// gymArmed/onToggleGym: rayo ⚡ opcional (repaso diario) — al armarlo, DESPUÉS
// de calificar esta tarjeta se abre el Gimnasio Mental. Decisión del momento:
// no persiste, cada tarjeta arranca apagada.
export default function FlipCard({
  cardId,
  front,
  back,
  flipped,
  onFlip,
  starred,
  onToggleStar,
  gymArmed,
  onToggleGym,
  onEdit,
}) {
  const { height } = useWindowDimensions();
  const scaleX = useRef(new Animated.Value(1)).current;
  const [showBack, setShowBack] = useState(flipped);
  const scrollRef = useRef(null);
  const prevCardId = useRef(cardId);

  // Un solo efecto para evitar carreras entre "cambió la tarjeta" y "giro".
  // - Nueva tarjeta (sin `key`, este componente ya NO se remonta): resetear al
  //   frente AL INSTANTE, sin animar, y volver el scroll arriba.
  // - Misma tarjeta: animar el giro (colapsar/expandir scaleX). showBack en las
  //   deps es clave: si tocás de nuevo durante la animación, el efecto vuelve a
  //   disparar hasta converger y la tarjeta nunca queda "sorda".
  useEffect(() => {
    if (prevCardId.current !== cardId) {
      prevCardId.current = cardId;
      scaleX.setValue(1);
      setShowBack(flipped);
      scrollRef.current?.scrollTo({ y: 0, animated: false });
      return;
    }
    if (showBack === flipped) return;
    Animated.timing(scaleX, { toValue: 0, duration: 110, useNativeDriver: true }).start(
      ({ finished }) => {
        if (!finished) return;
        setShowBack(flipped);
        scrollRef.current?.scrollTo({ y: 0, animated: false });
        Animated.timing(scaleX, { toValue: 1, duration: 110, useNativeDriver: true }).start();
      }
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cardId, flipped, showBack]);

  const faceText = showBack ? back : front;
  const Surface = Platform.OS === 'web' ? WebFlipSurface : Pressable;

  return (
    <Surface onPress={onFlip} accessibilityRole="button" accessibilityLabel={showBack ? "Volver a la pregunta" : "Mostrar respuesta"} style={[styles.wrapper, height < 700 && { minHeight: 220 }]}>
      <Animated.View style={[styles.card, { transform: [{ scaleX }] }]}>
        <View style={styles.face}>
          {/* ScrollView: el dorso (o el frente) largo se lee scrolleando en
              vertical. El swipe horizontal lo sigue tomando el PanResponder del
              SwipeCard (exige dx>dy). El tap para girar va en un Pressable PROPIO
              adentro del scroll: un ScrollView se queda con el toque y no deja
              que suba al Pressable de afuera. contentContainerStyle centra el
              texto corto y deja crecer el largo; el paddingTop deja libre la
              esquina de la estrella/rayo. El frente arranca centrado por
              defecto; el dorso, izquierda (defaultAlign). */}
          <ScrollView
            ref={scrollRef}
            style={styles.textBox}
            contentContainerStyle={styles.textContent}
            showsVerticalScrollIndicator
          >
            <Pressable onPress={onFlip} {...(Platform.OS === 'web' ? {
              tabIndex: -1, dataSet: { studyFlipText: 'true' }, style: { outlineStyle: 'none' },
            } : {})}>
              <RichText
                text={faceText}
                style={styles.text}
                defaultAlign={showBack ? "left" : "center"}
              />
            </Pressable>
          </ScrollView>
          {/* Estrella y rayo AL FINAL del JSX: así se dibujan por ENCIMA del
              texto (en Android el orden de render gana; sin esto el ScrollView
              los tapaba). Absolutos en la esquina superior derecha. */}
          {onToggleStar ? (
            <Pressable accessibilityRole="button" accessibilityLabel={starred ? "Quitar de destacadas" : "Destacar tarjeta"} accessibilityState={{ selected: !!starred }} dataSet={{ studyAction: 'star' }} onPress={onToggleStar} hitSlop={2} style={styles.star}>
              {starred ? (
                <FontAwesome name="star" size={20} color="#FFC53D" />
              ) : (
                <Feather name="star" size={20} color={colors.textMuted} />
              )}
            </Pressable>
          ) : null}
          {onToggleGym ? (
            <Pressable accessibilityRole="button" accessibilityLabel="Abrir Gimnasio después de calificar" accessibilityState={{ selected: !!gymArmed }} dataSet={{ studyAction: 'gym' }} onPress={onToggleGym} hitSlop={2} style={styles.gym}>
              <Feather
                name="zap"
                size={20}
                color={gymArmed ? textColors.violeta : colors.textMuted}
              />
            </Pressable>
          ) : null}
          {/* Lápiz de edición: esquina superior IZQUIERDA (la estrella y el rayo
              van a la derecha). Abre el editor de la tarjeta sin salir del
              estudio. Mismo patrón absoluto: el tap no dispara flip ni swipe. */}
          {onEdit ? (
            <Pressable accessibilityRole="button" accessibilityLabel="Editar tarjeta" dataSet={{ studyAction: 'edit' }} onPress={onEdit} hitSlop={2} style={styles.edit}>
              <Feather name="edit-2" size={20} color={colors.textMuted} />
            </Pressable>
          ) : null}
        </View>
      </Animated.View>
    </Surface>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    flex: 1,
    minHeight: 340,
  },
  card: {
    flex: 1,
  },
  face: {
    flex: 1,
    borderRadius: radius.lg,
    // Fondo sólido oscuro (más oscuro que el degradé anterior, como el panel de
    // lectura). Sin header de "Pregunta/Respuesta": la tarjeta queda limpia.
    backgroundColor: colors.surfaceCard,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    padding: spacing.lg,
    justifyContent: "center",
    alignItems: "center",
    overflow: "hidden",
  },
  star: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    position: "absolute",
    top: spacing.sm,
    right: spacing.sm,
    zIndex: 2,
  },
  gym: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    position: "absolute",
    top: spacing.sm,
    right: spacing.sm + 48,
    zIndex: 2,
  },
  edit: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    position: "absolute",
    top: spacing.sm,
    left: spacing.sm,
    zIndex: 2,
  },
  textBox: {
    flex: 1,
    alignSelf: "stretch",
  },
  textContent: {
    flexGrow: 1,
    justifyContent: "center",
    // Deja libre la franja superior derecha donde van la estrella y el rayo,
    // así el texto (largo o pegado arriba) no arranca debajo de ellos.
    paddingTop: spacing.lg,
  },
  text: {
    ...type.body,
    fontSize: 20,
    lineHeight: 30,
    // Sin textAlign fijo: la alineación la decide cada bloque (RichText la
    // aplica según cómo se creó), con el default por cara (dorso = centro).
  },
});
