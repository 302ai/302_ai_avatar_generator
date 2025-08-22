import { APICallError } from "ai";
import { createScopedLogger } from "@/utils";
import ky from "ky";
import { env } from "@/env";

const logger = createScopedLogger("upload-video");

export async function POST(request: Request) {
  try {
    // 接收multipart/form-data格式的请求
    const formData = await request.formData();
    const apiKey = formData.get("apiKey") as string;
    const file = formData.get("file") as File;

    if (!apiKey || !file) {
      return Response.json(
        {
          error: {
            err_code: 400,
            message: "Missing required parameters",
            message_cn: "缺少必要参数",
            message_en: "Missing required parameters",
            message_ja: "必要なパラメータが不足しています",
            type: "MISSING_PARAMETERS",
          },
        },
        { status: 400 }
      );
    }

    try {
      // 创建新的FormData对象发送到外部API
      const uploadFormData = new FormData();
      uploadFormData.append("file", file);

      const resp = await ky
        .post(`${env.NEXT_PUBLIC_API_URL}/302/upload-file`, {
          headers: {
            Authorization: `Bearer ${apiKey}`,
            // 不设置Content-Type，让浏览器自动设置multipart/form-data的boundary
          },
          body: uploadFormData,
          timeout: false, // 增加超时时间以适应视频上传处理
        })
        .json();

      // 返回上传结果
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
  } catch (error: unknown) {
    logger.error("Video upload error");
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
          message_cn: "视频上传失败",
          message_en: "Video upload failed",
          message_ja: "動画アップロードに失敗しました",
          type: "VIDEO_UPLOAD_ERROR",
        },
      },
      { status: errorCode }
    );
  }
}
