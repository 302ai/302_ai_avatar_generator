import { APICallError } from "ai";
import { createScopedLogger } from "@/utils";
import ky from "ky";
import { env } from "@/env";

const logger = createScopedLogger("voice-clone-status");

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const apiKey = url.searchParams.get("apiKey") as string;
    const taskId = url.searchParams.get("id") as string;

    if (!apiKey || !taskId) {
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
      console.log(`Checking status for task ${taskId}`);
      const statusResp = await ky
        .get(`${env.NEXT_PUBLIC_API_URL}/chanjing/open/v1/customised_audio`, {
          headers: {
            Authorization: `Bearer ${apiKey}`,
          },
          searchParams: {
            id: taskId,
          },
          timeout: 30000,
        })
        .json<{
          code: number;
          data: {
            audio_path: string;
            err_msg: string;
            id: string;
            lang: string;
            name: string;
            progress: number;
            status: number; // 状态：2表示完成
            type: string;
          };
          msg: string;
          trace_id: string;
        }>();

      console.log(`Status result for task ${taskId}:`, statusResp);

      if (statusResp.code !== 0) {
        throw new Error(`查询任务状态失败: ${statusResp.msg}`);
      }

      const { data } = statusResp;

      // 返回格式化的状态信息
      return Response.json({
        _id: data.id,
        title: data.name,
        type: data.type,
        visibility: "unlist",
        status:
          data.status === 2
            ? "success"
            : data.status < 0
              ? "failed"
              : "pending",
        progress: data.progress,
        audio_path: data.audio_path,
        err_msg: data.err_msg,
      });
    } catch (apiError: any) {
      logger.error("Voice clone status API call failed:", apiError);

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
    logger.error("Voice clone status error");
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
          message_cn: "查询声音克隆状态失败",
          message_en: "Voice clone status query failed",
          message_ja: "音声クローンステータス取得に失敗しました",
          type: "VOICE_CLONE_STATUS_ERROR",
        },
      },
      { status: errorCode }
    );
  }
}
