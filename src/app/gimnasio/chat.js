import { Stack, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator } from "react-native";

import ChatAuditor from "../../components/ChatAuditor";
import { Screen } from "../../components/ui";
import { getCard } from "../../db/cards";
import { colors } from "../../theme";

export default function ChatGimnasio() {
  const { id, cardId } = useLocalSearchParams();
  const [card, setCard] = useState(null);
  const [loading, setLoading] = useState(!!cardId);

  useEffect(() => {
    let alive = true;
    if (!cardId) {
      setCard(null);
      setLoading(false);
      return () => { alive = false; };
    }
    setLoading(true);
    getCard(Number(cardId))
      .then((selected) => { if (alive) setCard(selected); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [cardId]);

  return (
    <Screen>
      <Stack.Screen options={{ title: "Gimnasio Mental", headerShown: false }} />
      {loading ? <ActivityIndicator color={colors.accent} style={{ flex: 1 }} /> : (
        <ChatAuditor card={card} chatId={id ? Number(id) : null} />
      )}
    </Screen>
  );
}
