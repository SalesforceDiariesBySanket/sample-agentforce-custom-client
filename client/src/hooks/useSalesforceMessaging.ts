import { useCallback } from "react";

const API_BASE_URL =
  import.meta.env.VITE_API_URL || "http://localhost:8080/api";

interface MessagingCredentials {
  accessToken: string;
  conversationId: string;
  orgId: string;
  lastEventId: string;
}

interface MessagingHookReturn {
  initialize: () => Promise<MessagingCredentials>;
  sendMessage: (
    token: string,
    conversationId: string,
    content: string
  ) => Promise<void>;
  closeChat: (token: string, conversationId: string) => Promise<void>;
  setupEventSource: (token: string, orgId: string, lastEventId: string) => EventSource;
}

export function useSalesforceMessaging(): MessagingHookReturn {
  const initialize = useCallback(async (): Promise<MessagingCredentials> => {
    const response = await fetch(`${API_BASE_URL}/chat/initialize`);
    if (!response.ok) throw new Error("Failed to initialize chat");
    return response.json();
  }, []);

  const sendMessage = useCallback(
    async (
      token: string,
      conversationId: string,
      content: string
    ): Promise<void> => {
      const response = await fetch(`${API_BASE_URL}/chat/message`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          "X-Conversation-Id": conversationId,
        },
        body: JSON.stringify({ message: content }),
      });

      if (!response.ok) throw new Error("Failed to send message");
    },
    []
  );

  const closeChat = useCallback(
    async (token: string, conversationId: string): Promise<void> => {
      const response = await fetch(`${API_BASE_URL}/chat/end`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "X-Conversation-Id": conversationId,
        },
      });

      if (!response.ok) throw new Error("Failed to close chat");
    },
    []
  );

  const setupEventSource = useCallback((token: string, orgId: string, lastEventId: string): EventSource => {
    return new EventSource(`${API_BASE_URL}/chat/sse?token=${token}&orgId=${orgId}&lastEventId=${lastEventId}`, {
      withCredentials: true,
    });
  }, []);

  return {
    initialize,
    sendMessage,
    closeChat,
    setupEventSource,
  };
}
