import { APICallError } from "ai";
import { createScopedLogger } from "@/utils";
import ky from "ky";
import { env } from "@/env";

const logger = createScopedLogger("gen-speech");

export async function POST(request: Request) {
  try {
    const {
      text,
      apiKey,
      voice,
      speed,
    }: {
      text: string;
      apiKey: string;
      platform: string;
      voice: string;
      speed: number;
    } = await request.json();
    try {
      const response = await ky.post(
        `${env.NEXT_PUBLIC_API_URL}/302/tts/generate`,
        {
          headers: {
            Authorization: `Bearer ${apiKey}`,
            Accept: "application/json",
          },
          json: {
            provider: "fish",
            text,
            voice,
            speed,
          },
          timeout: 6000000,
        }
      );

      // 解析 JSON 响应
      const result = (await response.json()) as {
        audio_url: string;
        data: string;
      };

      // 返回音频 URL
      return Response.json({
        audio_url: result.audio_url,
        data: result.data || {},
      });
    } catch (apiError: any) {
      logger.error("API call failed:", apiError);

      // Check if error has response with error code for ErrorToast
      if (apiError.response) {
        try {
          const errorText = await apiError.response.text();
          const errorData = JSON.parse(errorText);
          if (errorData.error && errorData.error.err_code) {
            // If we have a structured error with err_code, return it directly
            return Response.json(errorData, {
              status: apiError.response.status || 500,
            });
          }
        } catch (parseError) {
          // If parsing fails, continue to default error handling
        }
      }

      throw apiError;
    }
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
