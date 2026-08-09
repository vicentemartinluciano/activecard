import { Stack, useLocalSearchParams } from "expo-router";

import ChatAuditor from "../../components/ChatAuditor";
import { Screen } from "../../components/ui";

export default function ChatGimnasio() {
  const { id } = useLocalSearchParams();
  return (
    <Screen>
      <Stack.Screen options={{ title: "Gimnasio Mental", headerShown: false }} />
      <ChatAuditor chatId={id ? Number(id) : null} />
    </Screen>
  );
}
