import { useState, useEffect, useRef, useCallback } from "react";
import { Message } from "../types";
import { useSalesforceMessaging } from "./useSalesforceMessaging";

const INACTIVITY_TIMEOUT = 5 * 60 * 1000; // 5 minutes

export function useChat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [currentAgent, setCurrentAgent] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const eventSourceRef = useRef<EventSource | null>(null);
  const credsRef = useRef<{
    accessToken: string;
    conversationId: string;
    orgId: string;
    lastEventId: string;
  } | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const pollingRef = useRef<NodeJS.Timeout | null>(null);
  const isInitializedRef = useRef(false);

  const {
    initialize,
    sendMessage: sendMessageToApi,
    closeChat: closeChatApi,
  } = useSalesforceMessaging();

  const resetTimeout = useCallback(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);

    timeoutRef.current = setTimeout(async () => {
      if (!credsRef.current || !isConnected) return;

      try {
        await closeChatApi(
          credsRef.current.accessToken,
          credsRef.current.conversationId
        );
        setIsConnected(false);
        setMessages((prev) => [
          ...prev,
          {
            id: crypto.randomUUID(),
            type: "system",
            content: "Chat ended due to inactivity",
            timestamp: new Date(),
          },
        ]);
      } catch (err) {
        console.error("Failed to end chat:", err);
      }
    }, INACTIVITY_TIMEOUT);
  }, [isConnected, closeChatApi]);

  const startPolling = useCallback(() => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
    }

    setIsConnected(true);

    const pollMessages = async () => {
      if (!credsRef.current) return;

      try {
        const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8080/api";
        const response = await fetch(`${API_URL}/chat/message`, {
          headers: {
            Authorization: `Bearer ${credsRef.current.accessToken}`,
            "X-Conversation-Id": credsRef.current.conversationId,
          },
        });

        if (response.ok) {
          const data = await response.json();
          console.log('Polling response:', data);
          
          if (data.conversationEntries && data.conversationEntries.length > 0) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const entries = data.conversationEntries.filter((entry: any) =>
              entry.entryType === "Message" && entry.sender.role === "Chatbot"
            );

            console.log('Found bot entries:', entries.length);

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            entries.forEach((entry: any) => {
              const payload = typeof entry.entryPayload === 'string' 
                ? JSON.parse(entry.entryPayload)
                : entry.entryPayload;

              const messageText = payload.abstractMessage.staticContent.text;
              const messageId = payload.abstractMessage.id;

              console.log('Bot message:', messageText);

              // Only add if not already in messages
              setMessages((prev) => {
                if (prev.find(m => m.id === messageId)) return prev;
                return [
                  ...prev,
                  {
                    id: messageId,
                    type: "ai",
                    content: messageText,
                    timestamp: new Date(entry.clientTimestamp),
                  },
                ];
              });
            });

            setIsLoading(false);
            setIsTyping(false);
          }
        }
      } catch (error) {
        console.error('Polling error:', error);
      }
    };

    // Poll every 2 seconds
    pollingRef.current = setInterval(pollMessages, 2000);
    
        
    // Also poll immediately
    pollMessages();
  }, []);

  const startChat = useCallback(async () => {
    try {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }

      setMessages([]);
      setIsLoading(false);
      setIsTyping(false);
      setCurrentAgent(null);
      setError(null);

      const creds = await initialize();
      credsRef.current = creds;
      
      console.log('Chat initialized:', { 
        conversationId: creds.conversationId, 
        orgId: creds.orgId, 
        lastEventId: creds.lastEventId 
      });

      // Start polling for messages instead of SSE
      startPolling();
    } catch (err) {
      console.error("Chat initialization error:", err);
      setError("Failed to start chat");
      setIsConnected(false);
    }
  }, [initialize, startPolling]);

  const sendMessage = async (content: string) => {
    if (!credsRef.current) return;
    resetTimeout();

    const message = {
      id: crypto.randomUUID(),
      type: "user" as const,
      content,
      timestamp: new Date(),
    };

    try {
      setMessages((prev) => [...prev, message]);
      setIsLoading(true);

      await sendMessageToApi(
        credsRef.current.accessToken,
        credsRef.current.conversationId,
        content
      );
    } catch (err) {
      console.error(err);
      setError("Failed to send message");
      setIsLoading(false);
      setMessages((prev) => prev.filter((m) => m.id !== message.id));
    }
  };

  const closeChat = async (onClosed: () => void) => {
    try {
      if (!credsRef.current) return;

      // Stop polling
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }

      await closeChatApi(
        credsRef.current.accessToken,
        credsRef.current.conversationId
      );

      setIsConnected(false);
      setIsTyping(false);
      setCurrentAgent(null);
      setMessages([]);
      setIsLoading(false);
      setError(null);
      onClosed();
    } catch (err) {
      console.error("Failed to close chat:", err);
      setError("Failed to close chat");
    }
  };

  useEffect(() => {
    if (isInitializedRef.current) return;
    isInitializedRef.current = true;

    startChat();
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [startChat]);

  return {
    messages,
    isConnected,
    isLoading,
    isTyping,
    currentAgent,
    error,
    sendMessage,
    closeChat,
    startNewChat: startChat,
  };
}
