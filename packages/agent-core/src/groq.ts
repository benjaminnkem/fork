import Groq from "groq-sdk";
import { ForkError } from "@fork/shared";
import {
  isAuthError,
  isRateLimitError,
  isTransientProviderError,
  type ModelProvider,
  type ProviderMessage,
  type ProviderRequest,
  type ProviderResponse,
  type ProviderToolCall,
} from "./provider.js";

type GroqClient = InstanceType<typeof Groq>;

export class GroqModelProvider implements ModelProvider {
  constructor(private readonly client: GroqClient) {}

  static fromApiKey(apiKey: string): GroqModelProvider {
    return new GroqModelProvider(new Groq({ apiKey }));
  }

  async complete(request: ProviderRequest): Promise<ProviderResponse> {
    try {
      const response = await this.client.chat.completions.create({
        model: request.model,
        messages: request.messages.map(toGroqMessage),
        tools: request.tools,
        tool_choice: "auto",
        temperature: request.temperature,
        max_completion_tokens: request.maxCompletionTokens,
        reasoning_effort: request.reasoningEffort,
        include_reasoning: request.includeReasoning,
      } as never);
      const message = response.choices[0]?.message;
      const toolCalls: ProviderToolCall[] = (message?.tool_calls ?? []).map((call) => ({
        id: call.id,
        type: "function",
        function: {
          name: call.function.name,
          arguments: call.function.arguments,
        },
      }));
      return {
        model: response.model,
        content: message?.content ?? null,
        toolCalls,
        finishReason: response.choices[0]?.finish_reason ?? null,
      };
    } catch (error) {
      if (isAuthError(error)) {
        throw new ForkError("GROQ_UNAVAILABLE", "Groq rejected the API key", {
          retryable: false,
          cause: error,
        });
      }
      if (isRateLimitError(error)) {
        throw new ForkError("GROQ_RATE_LIMITED", "Groq rate limited the request", {
          retryable: true,
          cause: error,
        });
      }
      if (isTransientProviderError(error)) {
        throw new ForkError("GROQ_RATE_LIMITED", "Groq provider is temporarily unavailable", {
          retryable: true,
          cause: error,
        });
      }
      throw error;
    }
  }
}

function toGroqMessage(message: ProviderMessage) {
  if (message.role === "tool") {
    return {
      role: "tool" as const,
      content: message.content ?? "",
      tool_call_id: message.tool_call_id ?? "",
    };
  }
  if (message.role === "assistant") {
    return {
      role: "assistant" as const,
      content: message.content,
      tool_calls: message.tool_calls,
    };
  }
  return {
    role: message.role,
    content: message.content ?? "",
  };
}
