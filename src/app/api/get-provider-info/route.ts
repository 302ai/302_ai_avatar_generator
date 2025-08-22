import {
  APICallError,
  experimental_generateSpeech as generateSpeech,
} from "ai";
import { createAI302 } from "@302ai/ai-sdk";
import { createScopedLogger } from "@/utils";
import ky from "ky";
import { env } from "@/env";

const logger = createScopedLogger("gen-speech");

interface VoiceParseResult {
  platform: string;
  locale?: string;
  voiceName: string;
}

export async function POST(request: Request) {
  try {
    const {
      apiKey,
      provider,
    }: {
      apiKey: string;
      provider: string;
    } = await request.json();

    const response = await ky.get(
      `${env.NEXT_PUBLIC_API_URL}/302/tts/provider?provider=${provider}`,
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
        timeout: 60000000,
      }
    );

    const responseData: any = await response.json();
    const list =
      responseData.provider_list?.[0]?.req_params_info?.voice_list || [];

    // 返回音频 URL
    return Response.json({
      data: list || [],
    });
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
