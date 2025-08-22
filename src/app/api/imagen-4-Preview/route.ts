import {
  APICallError,
  experimental_generateSpeech as generateSpeech,
} from "ai";
import { createAI302 } from "@302ai/ai-sdk";
import { createScopedLogger } from "@/utils";
import ky from "ky";
import { env } from "@/env";

const logger = createScopedLogger("text-to-image");

export async function POST(request: Request) {
  try {
    const {
      apiKey,
      prompt,
      aspectRatio,
    }: {
      apiKey: string;
      prompt: string;
      aspectRatio: "16:9" | "9:16";
    } = await request.json();
    console.log("request", prompt, aspectRatio);

    const response = await ky.post(
      `${env.NEXT_PUBLIC_API_URL}/302/submit/imagen-4-preview`,
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
        timeout: false,
        json: {
          prompt,
          aspect_ratio: aspectRatio,
        },
      }
    );

    const responseData: any = await response.json();

    console.log("API Response:", responseData);

    return Response.json(responseData);
  } catch (error) {
    logger.error("Speech generation error");

    // 处理 API 调用错误
    if (error instanceof APICallError) {
      const resp = error.responseBody;
      return Response.json(resp, { status: 500 });
    }

    // 处理一般错误
    const errorMessage =
      error instanceof Error ? error.message : "Failed to generate audio";
    const errorCode = 500;

    // 检查是否有响应体
    if (error instanceof Error) {
      const resp = (error as any)?.responseBody;
      if (resp) {
        return Response.json(resp, { status: 500 });
      }
    }

    // 返回标准化错误响应
    return Response.json(
      {
        error: {
          err_code: errorCode,
          message: errorMessage,
          message_cn: "生成音频失败",
          message_en: "Failed to generate audio",
          message_ja: "音声生成に失敗しました",
          type: "AUDIO_GENERATION_ERROR",
        },
      },
      { status: errorCode }
    );
  }
}
