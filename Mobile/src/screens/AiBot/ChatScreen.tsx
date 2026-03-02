import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Ionicons from "react-native-vector-icons/Ionicons";

import { RouteProp } from "@react-navigation/native";
import { RootStackParamList } from "../../navigation/types";
import { aiService } from "../../services/aiService";

type ChatRouteProp = RouteProp<RootStackParamList, "Chat">;

type Props = {
  route: ChatRouteProp;
};

type ChatMessage = {
  id: string;
  text: string;
  sender: "user" | "bot";
};

export default function ChatScreen({ route }: Props) {
  const initialUserMessage = route.params?.userMessage ?? "";
  const [message, setMessage] = useState("");
  const [sessionId, setSessionId] = useState<string | undefined>(undefined);
  const [sending, setSending] = useState(false);
  const hasBootstrappedRef = useRef(false);

  const [messages, setMessages] = useState<ChatMessage[]>([]);

  const canSend = useMemo(() => message.trim().length > 0, [message]);

  const sendToBackend = useCallback(
    async (text: string) => {
      const nextMessage: ChatMessage = {
        id: `${Date.now()}-user`,
        text,
        sender: "user",
      };

      setMessages((prev) => [...prev, nextMessage]);
      setSending(true);

      try {
        const result = await aiService.sendMessage(text, sessionId);
        setSessionId(result.sessionId);

        setMessages((prev) => [
          ...prev,
          {
            id: `${Date.now()}-bot`,
            text: result.message,
            sender: "bot",
          },
        ]);
      } catch (error: any) {
        setMessages((prev) => [
          ...prev,
          {
            id: `${Date.now()}-error`,
            text:
              error?.message ??
              "Could not reach AI assistant. Please try again.",
            sender: "bot",
          },
        ]);
      } finally {
        setSending(false);
      }
    },
    [sessionId],
  );

  useEffect(() => {
    if (hasBootstrappedRef.current) return;
    hasBootstrappedRef.current = true;

    const text = initialUserMessage.trim();
    if (!text) return;
    sendToBackend(text);
  }, [initialUserMessage, sendToBackend]);

  const onSend = () => {
    if (!canSend || sending) return;
    const nextText = message.trim();
    setMessage("");
    sendToBackend(nextText);
  };

  return (
    <SafeAreaView style={styles.container} edges={["left", "right", "bottom"]}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? 8 : 0}
      >
        <FlatList
          data={messages}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          keyboardShouldPersistTaps="handled"
          renderItem={({ item }) => (
            <View
              style={[
                styles.message,
                item.sender === "user" ? styles.user : styles.bot,
              ]}
            >
              <Text style={styles.text}>{item.text}</Text>
            </View>
          )}
        />

        <View style={styles.inputContainer}>
          <TextInput
            value={message}
            onChangeText={setMessage}
            placeholder="Ask anything..."
            placeholderTextColor="#7a8599"
            style={styles.input}
            returnKeyType="send"
            onSubmitEditing={onSend}
            editable={!sending}
          />
          {sending ? (
            <ActivityIndicator size="small" color="#9fb3ff" />
          ) : (
            <Pressable onPress={onSend} hitSlop={8}>
              <Ionicons
                name="send"
                size={20}
                color={canSend ? "#9fb3ff" : "#5d6780"}
              />
            </Pressable>
          )}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#050b17",
  },
  flex: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
  },
  message: {
    padding: 12,
    borderRadius: 14,
    marginVertical: 6,
    maxWidth: "80%",
  },
  user: {
    alignSelf: "flex-end",
    backgroundColor: "#4a8dd8",
  },
  bot: {
    alignSelf: "flex-start",
    backgroundColor: "#0b1326",
  },
  text: {
    color: "#fff",
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#0b1326",
    borderRadius: 26,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginHorizontal: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#1c2640",
  },
  input: {
    flex: 1,
    color: "#fff",
    marginRight: 8,
  },
});
