import { APICallError } from "ai";
import { createScopedLogger } from "@/utils";
import { env } from "@/env";
import ky from "ky";
import type {
  BackgroundChangeRequest,
  BackgroundApiResponse,
} from "@/types/background-api";

const logger = createScopedLogger("change-background");

export async function POST(request: Request) {
  try {
    const {
      imageUrl,
      backgroundDescription,
      backgroundImageUrl,
      type,
      apiKey,
    }: BackgroundChangeRequest = await request.json();

    logger.info("change-background-request", {
      imageUrl,
      backgroundDescription,
      backgroundImageUrl,
      type,
    });

    // 验证必需参数
    if (!imageUrl || !apiKey) {
      return Response.json(
        {
          error: {
            errCode: 400,
            message: "Missing required parameters: imageUrl and apiKey",
            messageCn: "缺少必需参数：图片URL和API密钥",
            messageEn: "Missing required parameters: imageUrl and apiKey",
            messageJa: "必要なパラメータが不足しています：画像URLとAPIキー",
            type: "VALIDATION_ERROR",
          },
        },
        { status: 400 }
      );
    }

    if (type === "text" && !backgroundDescription) {
      return Response.json(
        {
          error: {
            errCode: 400,
            message: "Background description is required for text type",
            messageCn: "文字类型需要背景描述",
            messageEn: "Background description is required for text type",
            messageJa: "テキストタイプには背景の説明が必要です",
            type: "VALIDATION_ERROR",
          },
        },
        { status: 400 }
      );
    }

    if (type === "image" && !backgroundImageUrl) {
      return Response.json(
        {
          error: {
            errCode: 400,
            message: "Background image URL is required for image type",
            messageCn: "图片类型需要背景图片URL",
            messageEn: "Background image URL is required for image type",
            messageJa: "画像タイプには背景画像URLが必要です",
            type: "VALIDATION_ERROR",
          },
        },
        { status: 400 }
      );
    }

    try {
      // 构建请求负载
      const payload: Record<string, unknown> = {
        image_url: imageUrl,
        type: type,
      };

      if (type === "text") {
        payload.prompt = backgroundDescription;
      } else if (type === "image") {
        payload.background_image_url = backgroundImageUrl;
      }

      // 调用302.ai的背景更换API
      const response = await ky.post(
        `${env.NEXT_PUBLIC_API_URL}/302/submit/relight-v2`,
        {
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          json: {
            ...payload,
            cfg: 1,
            hr_downscale: 0.5,
            output_format: "jpeg",
            guidance_scale: 5,
            lowres_denoise: 0.98,
            highres_denoise: 0.95,
            num_inference_steps: 28,
            background_threshold: 0.8,
            enable_hr_fix: true,
          },
          timeout: false, // 60秒超时
        }
      );

      const result = (await response.json()) as BackgroundApiResponse;
      logger.info("background-change-success", { result });

      // 根据API响应格式返回结果
      if (result.images && result.images.length > 0 && result.images[0].url) {
        // 处理实际的响应格式: {"images": [{"url": "..."}]}
        return Response.json({
          success: true,
          newImageUrl: result.images[0].url,
        });
      } else if (result.success && result.data?.image_url) {
        return Response.json({
          success: true,
          newImageUrl: result.data.image_url,
        });
      } else if (result.image_url) {
        // 兼容不同的响应格式
        return Response.json({
          success: true,
          newImageUrl: result.image_url,
        });
      } else {
        throw new Error(result.error || "Failed to change background");
      }
    } catch (apiError) {
      logger.error("Failed to change background", apiError);

      let errorMessage = "Failed to change background";
      let errorCode = 500;

      if (apiError instanceof Error) {
        errorMessage = apiError.message;

        // 处理HTTP错误
        if ("response" in apiError && apiError.response) {
          const response = apiError.response as any;
          errorCode = response.status || 500;

          try {
            const errorData = await response.json();
            errorMessage = errorData.error || errorData.message || errorMessage;
          } catch {
            // 忽略JSON解析错误
          }
        }
      }

      return Response.json(
        {
          error: {
            errCode: errorCode,
            message: errorMessage,
            messageCn: "背景更换失败",
            messageEn: "Failed to change background",
            messageJa: "背景の変更に失敗しました",
            type: "BACKGROUND_CHANGE_ERROR",
          },
        },
        { status: errorCode }
      );
    }
  } catch (error) {
    logger.error("Unexpected error in change-background API", error);

    if (error instanceof APICallError) {
      const resp = error.responseBody;
      return Response.json(resp, { status: 500 });
    }

    // 处理其他类型的错误
    let errorMessage = "Internal server error";
    let errorCode = 500;

    if (error instanceof Error) {
      errorMessage = error.message;
      if ("code" in error && typeof (error as any).code === "number") {
        errorCode = (error as any).code;
      }
    }

    return Response.json(
      {
        error: {
          errCode: errorCode,
          message: errorMessage,
          messageCn: "服务器内部错误",
          messageEn: "Internal server error",
          messageJa: "サーバー内部エラー",
          type: "INTERNAL_ERROR",
        },
      },
      { status: errorCode }
    );
  }
}
