import { APICallError } from "ai";
import { createScopedLogger } from "@/utils";
import ky from "ky";
import { env } from "@/env";

const logger = createScopedLogger("gen-chanjing-audio");

export async function POST(request: Request) {
  try {
    const {
      text,
      apiKey,
      voice,
    }: {
      text: string;
      apiKey: string;
      voice: string;
    } = await request.json();

    try {
      const response = await ky.post(
        `${env.NEXT_PUBLIC_API_URL}/chanjing/open/v1/create_audio_task`,
        {
          headers: {
            Authorization: `Bearer ${apiKey}`,
            Accept: "application/json",
          },
          json: {
            audio_man: voice,
            speed: 1,
            pitch: 1,
            volume: 100,
            text: {
              text: text,
              plain_text: text,
            },
            font_size: 64,
            width: 1000,
            height: 90,
            callback: "",
          },
          timeout: 6000000,
        }
      );

      // 解析 JSON 响应
      const taskResult = (await response.json()) as {
        data: {
          task_id: string;
        };
      };

      const pollStatus = async (attemptCount: number = 0): Promise<any> => {
        try {
          const statusResp = await ky
            .post(
              `${env.NEXT_PUBLIC_API_URL}/chanjing/open/v1/audio_task_state`,
              {
                headers: {
                  Authorization: `Bearer ${apiKey}`,
                  "Content-Type": "application/json",
                },
                timeout: false,
                json: {
                  task_id: taskResult.data.task_id,
                },
              }
            )
            .json<{
              data: {
                status: 10 | 9;
                full: {
                  url: string;
                };
              };
            }>();

          // 检查任务状态
          if (statusResp.data.status === 9) {
            return {
              task_id: taskResult.data.task_id,
              status: "success",
              audio_url: statusResp.data.full.url,
              attempts: attemptCount + 1,
            };
          } else if (statusResp.data.status === 10) {
            return {
              task_id: taskResult.data.task_id,
              status: "failed",
              err_msg: "音频分离任务失败",
              attempts: attemptCount + 1,
            };
          }

          // 如果还在处理中且未超过最大重试次数，继续轮询（最多轮询20次）
          const maxPollingAttempts = 20;
          if (attemptCount < maxPollingAttempts - 1) {
            await new Promise((resolve) => setTimeout(resolve, 10000));
            return pollStatus(attemptCount + 1);
          }

          // 超过最大轮询次数，返回超时错误
          return {
            task_id: taskResult.data.task_id,
            status: "timeout",
            err_msg: `任务处理超时，已轮询${maxPollingAttempts}次`,
            attempts: maxPollingAttempts,
          };
        } catch (apiError: any) {
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

          // 如果是网络错误且未超过重试次数，继续重试（最多重试19次）
          if (attemptCount < 19) {
            await new Promise((resolve) => setTimeout(resolve, 10000));
            return pollStatus(attemptCount + 1);
          }

          // 重试1次后仍失败，抛出错误
          throw apiError;
        }
      };

      // 开始轮询
      const result = await pollStatus();

      // 检查结果是否有效
      if (
        !result ||
        result.status === "timeout" ||
        result.status === "failed"
      ) {
        throw new Error(result.err_msg || "Audio generation failed");
      }

      // 确保响应被正确序列化
      const responseJson = JSON.stringify(result.audio_url);

      // 设置正确的响应头并返回
      const finalResponse = new Response(responseJson, {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-cache",
        },
      });

      return finalResponse;
    } catch (apiError: any) {
      logger.error("API call failed", {
        error: apiError,
        message: apiError?.message,
        response: apiError?.response,
        status: apiError?.response?.status,
        stack: apiError?.stack,
      });

      // Check if error has response with error code for ErrorToast
      if (apiError.response) {
        try {
          const errorText = await apiError.response.text();
          const errorData = JSON.parse(errorText);
          if (errorData.error && errorData.error.err_code) {
            // If we have a structured error with err_code, return it directly
            const errorResponseJson = JSON.stringify(errorData);

            const errorResponse = new Response(errorResponseJson, {
              status: apiError.response.status || 500,
              headers: {
                "Content-Type": "application/json",
              },
            });
            return errorResponse;
          }
        } catch (parseError) {
          // If parsing fails, continue to default error handling
        }
      }

      // 返回通用错误响应
      const genericErrorResponse = {
        error: {
          err_code: 500,
          message: apiError.message || "API call failed",
          message_cn: "API调用失败",
          message_en: "API call failed",
          message_ja: "API呼び出しに失敗しました",
          type: "API_CALL_ERROR",
        },
      };

      const genericResponseJson = JSON.stringify(genericErrorResponse);

      return new Response(genericResponseJson, {
        status: 500,
        headers: {
          "Content-Type": "application/json",
        },
      });
    }
  } catch (error) {
    logger.error("Top-level error in speech generation", {
      error: error,
      message: error instanceof Error ? error.message : "Unknown error",
      stack: error instanceof Error ? error.stack : undefined,
      type: typeof error,
    });

    // 处理 API 调用错误
    if (error instanceof APICallError) {
      const resp = error.responseBody;
      const apiCallResponseJson = JSON.stringify(resp);

      return new Response(apiCallResponseJson, {
        status: 500,
        headers: {
          "Content-Type": "application/json",
        },
      });
    }

    // 处理一般错误
    const errorMessage =
      error instanceof Error ? error.message : "Failed to generate audio";
    const errorCode = 500;

    // 检查是否有响应体
    if (error instanceof Error) {
      const resp = (error as any)?.responseBody;
      if (resp) {
        const responseBodyJson = JSON.stringify(resp);

        return new Response(responseBodyJson, {
          status: 500,
          headers: {
            "Content-Type": "application/json",
          },
        });
      }
    }

    // 返回标准化错误响应
    const standardizedErrorResponse = {
      error: {
        err_code: errorCode,
        message: errorMessage,
        message_cn: "生成音频失败",
        message_en: "Failed to generate audio",
        message_ja: "音声生成に失敗しました",
        type: "AUDIO_GENERATION_ERROR",
      },
    };

    const standardizedResponseJson = JSON.stringify(standardizedErrorResponse);

    return new Response(standardizedResponseJson, {
      status: errorCode,
      headers: {
        "Content-Type": "application/json",
      },
    });
  }
}
