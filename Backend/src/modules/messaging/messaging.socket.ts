import type { Socket } from "socket.io";
import { onSocketConnection } from "../../socket";
import type { CustomerPayload } from "../auth/auth.types";

/**
 * Typing indicator is pure ephemeral relay — no DB write. Registered via
 * socket.ts's onSocketConnection hook so the generic transport file stays
 * feature-agnostic. Importing this module (see messaging.routes.ts) is what
 * activates it.
 */
onSocketConnection((socket: Socket) => {
  socket.on("typing", (payload: { conversationId: string; receiverId: string; isTyping: boolean }) => {
    const verified = socket.data.customer as CustomerPayload | undefined;
    if (!verified?.id || !payload?.receiverId || !payload?.conversationId) return;
    socket.to(payload.receiverId).emit("conversation_typing", {
      conversationId: payload.conversationId,
      userId: verified.id,
      isTyping: !!payload.isTyping,
    });
  });
});
