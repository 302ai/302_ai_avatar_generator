import { APICallError } from "ai";
import { createScopedLogger } from "@/utils";
import ky from "ky";
import { env } from "@/env";

const logger = createScopedLogger("gen-voice-to-text");

export async function POST(request: Request) {
  try {
    // 接收FormData格式的请求
    const formData = await request.formData();

    // 从FormData中提取参数
    const apiKey = formData.get("apiKey") as string;
    const file = formData.get("file") as File;

    if (!apiKey || !file) {
      return Response.json(
        {
          error: {
            message: "缺少必要参数",
            message_cn: "缺少必要参数",
            message_en: "Missing required parameters",
            message_ja: "必要なパラメータがありません",
          },
        },
        { status: 400 }
      );
    }

    // 创建新的FormData对象用于语音识别API
    const transcriptionFormData = new FormData();
    transcriptionFormData.append("file", file);
    transcriptionFormData.append("model", "whisper-1");
    transcriptionFormData.append("response_format", "json");
    transcriptionFormData.append("temperature", "0");
    try {
      const transcriptionResponse = await ky
        .post(`${env.NEXT_PUBLIC_API_URL}/v1/audio/transcriptions`, {
          headers: {
            Authorization: `Bearer ${apiKey}`,
            Accept: "application/json",
          },
          body: transcriptionFormData,
          timeout: 600000,
        })
        .json<{ text: string }>();

      const text = transcriptionResponse.text;
      logger.info("识别到的文本", text);

      // 返回识别的文本
      return Response.json({
        text,
        success: true,
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
    // 使用FormData发送请求进行语音识别
  } catch (error: unknown) {
    logger.error("Speech to text error");
    const errorMessage = error instanceof Error ? error.message : "未知错误";

    // 处理 API 调用错误
    if (error instanceof APICallError) {
      const resp = error.responseBody;
      return Response.json(resp, { status: 500 });
    }

    // 处理一般错误
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
          message_cn: "语音识别失败",
          message_en: "Speech recognition failed",
          message_ja: "音声認識に失敗しました",
          type: "SPEECH_RECOGNITION_ERROR",
        },
      },
      { status: errorCode }
    );
  }
}
