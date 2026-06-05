import { NextRequest } from "next/server";
import { v4 as uuidv4 } from "uuid";
import { runAgentTurn } from "@/lib/agent/loop";
import { createFileBasedMemoryProvider } from "@/lib/memory/provider";

const memoryProvider = createFileBasedMemoryProvider();

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { kidId, sessionId, userMessage, existingMessages } = body;

    if (!kidId || !sessionId || !userMessage) {
      return Response.json(
        { error: "Missing required fields: kidId, sessionId, userMessage" },
        { status: 400 }
      );
    }

    // Ensure user message has an ID
    if (!userMessage.id) {
      userMessage.id = uuidv4();
    }

    const result = await runAgentTurn(
      memoryProvider,
      kidId,
      sessionId,
      userMessage,
      existingMessages ?? []
    );

    return Response.json({
      content: result.finalResponse.content,
      responseType: result.finalResponse.responseType,
      exerciseHtml: result.finalResponse.exerciseHtml,
      iterationCount: result.iterationCount,
    });
  } catch (error) {
    console.error("Agent loop error:", error);
    return Response.json(
      {
        error: "Agent processing failed",
        content:
          "ごめんね、ちょっと あたまが こんらん しちゃった。もういちど ためしてみてくれる？ 🐻",
        responseType: "chat",
      },
      { status: 500 }
    );
  }
}
