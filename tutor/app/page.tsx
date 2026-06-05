"use client";

import { useState, useCallback } from "react";
import { v4 as uuidv4 } from "uuid";
import { Message, InputMode } from "@/types";
import ChatArea from "@/components/chat/ChatArea";
import LeftPane from "@/components/input/LeftPane";
import VoiceInput from "@/components/input/VoiceInput";
import CameraInput from "@/components/input/CameraInput";
import KeyboardInput from "@/components/input/KeyboardInput";
import GearButton from "@/components/shared/GearButton";
import ErrorIllustration from "@/components/shared/ErrorIllustration";

const KID_ID = process.env.NEXT_PUBLIC_KID_ID ?? "default";

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isThinking, setIsThinking] = useState(false);
  const [activeMode, setActiveMode] = useState<InputMode>("voice");
  const [isRecording, setIsRecording] = useState(false);
  const [error, setError] = useState(false);

  const sessionId = uuidv4(); // New session per page load for v1

  const sendMessage = useCallback(
    async (content: string, mode: InputMode, imageUrl?: string) => {
      setError(false);
      setIsThinking(true);

      const userMessage: Message = {
        id: uuidv4(),
        sessionId,
        role: "user",
        content,
        inputMode: mode,
        imageUrl,
        timestamp: new Date().toISOString(),
      };

      setMessages((prev) => [...prev, userMessage]);

      try {
        const response = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            kidId: KID_ID,
            sessionId,
            userMessage,
            existingMessages: messages,
          }),
        });

        if (!response.ok) throw new Error("API error");

        const data = await response.json();

        const assistantMessage: Message = {
          id: uuidv4(),
          sessionId,
          role: "assistant",
          content: data.content,
          responseType: data.responseType,
          timestamp: new Date().toISOString(),
        };

        setMessages((prev) => [...prev, assistantMessage]);
      } catch (err) {
        console.error("Chat error:", err);
        setError(true);
      } finally {
        setIsThinking(false);
      }
    },
    [sessionId, messages]
  );

  const handleVoiceTranscript = useCallback(
    (transcript: string) => {
      sendMessage(transcript, "voice");
      setIsRecording(false);
    },
    [sendMessage]
  );

  const handleCameraCapture = useCallback(
    (imageUrl: string) => {
      sendMessage(
        "この ワークシートの もんだいを みて、てつだって！",
        "camera",
        imageUrl
      );
    },
    [sendMessage]
  );

  const handleKeyboardSend = useCallback(
    (text: string) => {
      sendMessage(text, "keyboard");
    },
    [sendMessage]
  );

  const handleVoiceToggle = useCallback(() => {
    setIsRecording((prev) => !prev);
  }, []);

  return (
    <div className="h-full flex">
      {/* Left Pane — Input Controls */}
      <LeftPane
        activeMode={activeMode}
        onModeChange={setActiveMode}
        isRecording={isRecording}
        onVoiceToggle={handleVoiceToggle}
      />

      {/* Right Pane — Chat + Input */}
      <div className="flex-1 flex flex-col relative bg-dark-bg">
        {error ? (
          <ErrorIllustration onRetry={() => setError(false)} />
        ) : (
          <ChatArea messages={messages} isThinking={isThinking} />
        )}

        {/* Input area — rendered based on active mode */}
        {activeMode === "voice" && (
          <VoiceInput
            onTranscript={handleVoiceTranscript}
            disabled={isThinking}
          />
        )}
        {activeMode === "camera" && (
          <CameraInput
            onCapture={handleCameraCapture}
            disabled={isThinking}
          />
        )}
        {activeMode === "keyboard" && (
          <KeyboardInput
            onSend={handleKeyboardSend}
            disabled={isThinking}
          />
        )}

        <GearButton onClick={() => (window.location.href = "/parent")} />
      </div>
    </div>
  );
}
