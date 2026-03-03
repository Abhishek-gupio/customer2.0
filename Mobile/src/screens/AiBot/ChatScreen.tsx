import React, { useMemo, useState } from "react";
import {
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
  const { userMessage } = route.params;
  const [message, setMessage] = useState("");

  const [messages, setMessages] = useState<ChatMessage[]>(() => [
    { id: "1", text: userMessage, sender: "user" },
    { id: "2", text: "Hi! How can I help you with that?", sender: "bot" },
  ]);

  const canSend = useMemo(() => message.trim().length > 0, [message]);

  const onSend = () => {
    if (!canSend) return;

    const nextText = message.trim();
    const nextMessage: ChatMessage = {
      id: Date.now().toString(),
      text: nextText,
      sender: "user",
    };

    setMessages((prev) => [...prev, nextMessage]);
    setMessage("");
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
          />
          <Pressable onPress={onSend} hitSlop={8}>
            <Ionicons
              name="send"
              size={20}
              color={canSend ? "#9fb3ff" : "#5d6780"}
            />
          </Pressable>
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
