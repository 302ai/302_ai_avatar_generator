import { APICallError } from "ai";
import { createScopedLogger } from "@/utils";
import ky from "ky";
import { env } from "@/env";

const logger = createScopedLogger("voice-clone");

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    // 从FormData中提取参数
    const apiKey = formData.get("apiKey") as string;
    const file = formData.get("file") as File;
    const title = formData.get("title") as string;
    const visibility = (formData.get("visibility") as string) || "unlist";
    const type = (formData.get("type") as string) || "tts";
    const train_mode = (formData.get("train_mode") as string) || "fast";

    // 创建新的FormData对象用于声音克隆API
    const voiceCloneFormData = new FormData();

    voiceCloneFormData.append("voices", file, "recording.wav");
    voiceCloneFormData.append("visibility", visibility);
    voiceCloneFormData.append("type", type);
    voiceCloneFormData.append("title", title);
    voiceCloneFormData.append("train_mode", train_mode);
    try {
      const resp = await ky
        .post(`${env.NEXT_PUBLIC_API_URL}/fish-audio/model`, {
          headers: {
            Authorization: `Bearer ${apiKey}`,
            Accept: "application/json",
          },
          body: voiceCloneFormData,
          timeout: 120000, // 增加超时时间以适应声音克隆处理
        })
        .json();

      // 返回声音克隆结果
      return Response.json(resp);
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
    // 发送请求进行声音克隆
  } catch (error: unknown) {
    logger.error("Voice clone error");
    const errorMessage = error instanceof Error ? error.message : "未知错误";
    console.log(errorMessage, "错误信息");

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
          message_cn: "声音克隆失败",
          message_en: "Voice cloning failed",
          message_ja: "音声クローンに失敗しました",
          type: "VOICE_CLONING_ERROR",
        },
      },
      { status: errorCode }
    );
  }
}
