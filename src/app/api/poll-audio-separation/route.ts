import { APICallError } from "ai";
import { createScopedLogger } from "@/utils";
import ky from "ky";
import { env } from "@/env";

const logger = createScopedLogger("audio-separation-status");

export async function POST(request: Request) {
  try {
    const { apiKey, taskId } = await request.json();

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

    // 轮询函数
    const pollStatus = async (attemptCount: number = 0): Promise<any> => {
      try {
        const statusResp = await ky
          .get(
            `${env.NEXT_PUBLIC_API_URL}/302/video/toolkit/status/${taskId}`,
            {
              headers: {
                Authorization: `Bearer ${apiKey}`,
                "Content-Type": "application/json",
              },
              timeout: false,
            }
          )
          .json<{
            task_id: string;
            status: "pending" | "completed" | "failed";
            created_at: string;
            updated_at: string;
            completed_at?: string;
            result?: {
              audio_url: string;
              audio_file: {
                url: string;
                file_name: string;
                file_size: number;
                mime_type: string;
                prefix: string;
              };
              source_video: string;
              format: string;
              metadata: {
                file_size: number;
                mime_type: string;
              };
            };
            execution_time?: string;
          }>();

        console.log(
          `Audio separation status result for task ${taskId}:`,
          statusResp
        );

        // 检查任务状态
        if (statusResp.status === "completed") {
          return {
            task_id: statusResp.task_id,
            status: "success",
            data: {
              id: statusResp.result?.audio_url,
            },
            audio_path: statusResp.result?.audio_url,
            audio_url: statusResp.result?.audio_url,
            result: statusResp.result,
            attempts: attemptCount + 1,
          };
        } else if (statusResp.status === "failed") {
          return {
            task_id: statusResp.task_id,
            status: "failed",
            err_msg: "音频分离任务失败",
            attempts: attemptCount + 1,
          };
        }

        // 如果还在处理中且未超过最大重试次数，继续轮询（最多轮询10次）
        const maxPollingAttempts = 10;
        if (attemptCount < maxPollingAttempts - 1) {
          await new Promise((resolve) => setTimeout(resolve, 5000));
          return pollStatus(attemptCount + 1);
        }

        // 超过最大轮询次数，返回超时错误
        return {
          task_id: taskId,
          status: "timeout",
          err_msg: `任务处理超时，已轮询${maxPollingAttempts}次`,
          attempts: maxPollingAttempts,
        };
      } catch (apiError: any) {
        logger.error(
          `Audio separation status API call failed on attempt ${attemptCount + 1}:`,
          apiError
        );

        // Check if error has response with error code for ErrorToast
        if (apiError.response) {
          try {
            const errorText = await apiError.response.text();
            const errorData = JSON.parse(errorText);
            if (errorData.error && errorData.error.err_code) {
              // If we have a structured error with err_code, return it directly
              throw apiError;
            }
          } catch (parseError) {
            // If parsing fails, continue to default error handling
          }
        }

        // 如果是网络错误且未超过重试次数，继续重试（最多重试1次）
        if (attemptCount < 1) {
          console.log(
            `Retrying audio separation status check (attempt ${attemptCount + 2}/2)`
          );
          await new Promise((resolve) => setTimeout(resolve, 5000));
          return pollStatus(attemptCount + 1);
        }

        // 重试1次后仍失败，抛出错误
        console.error(
          `Audio separation status check failed after ${attemptCount + 1} attempts`
        );
        throw apiError;
      }
    };

    // 开始轮询
    const result = await pollStatus();
    return Response.json(result);
  } catch (apiError: any) {
    logger.error("Audio separation status API call failed:", apiError);

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
}
