"use client";

import { Message } from "@/types";
import { useEffect, useRef } from "react";
import ChatBubble from "./ChatBubble";
import ExerciseCard from "./ExerciseCard";
import ThinkingMascot from "./ThinkingMascot";

interface ChatAreaProps {
  messages: Message[];
  isThinking: boolean;
}

export default function ChatArea({ messages, isThinking }: ChatAreaProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isThinking]);

  return (
    <div className="flex-1 overflow-y-auto px-6 py-5 flex flex-col gap-4 scroll-smooth">
      {messages.length === 0 && !isThinking && (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center text-text-muted">
            <span className="text-5xl block mb-4 animate-float">🐻</span>
            <p className="text-lg">くま先生が まっているよ！</p>
            <p className="text-sm mt-2">マイクのボタンで はなしかけてね</p>
          </div>
        </div>
      )}

      {messages.map((msg) => {
        // Check if this message has an exercise card
        const isExercise = msg.responseType === "exercise";

        return (
          <div key={msg.id}>
            <ChatBubble message={msg} />
            {isExercise && (
              <div className="mt-2">
                <ExerciseCard
                  problem={msg.content}
                  html={
                    msg.role === "assistant"
                      ? extractExerciseHtml(msg.content)
                      : undefined
                  }
                />
              </div>
            )}
          </div>
        );
      })}

      {isThinking && <ThinkingMascot />}

      <div ref={bottomRef} />
    </div>
  );
}

function extractExerciseHtml(content: string): string | undefined {
  const match = content.match(/```exercise\n([\s\S]*?)```/);
  return match?.[1]?.trim();
}
