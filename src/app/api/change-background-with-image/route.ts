import { APICallError } from "ai";
import { createScopedLogger } from "@/utils";
import { env } from "@/env";
import ky from "ky";
import type { BackgroundApiResponse } from "@/types/background-api";

const logger = createScopedLogger("change-background");

export async function POST(request: Request) {
  try {
    // 解析FormData
    const formData = await request.formData();

    // 获取表单字段
    const subjectImage = formData.get("subject_image") as File | null;
    const backgroundImage = formData.get("background_image") as File | null;
    const prompt = formData.get("prompt") as string | null;
    const apiKey = formData.get("apiKey") as string | null;
    const aspectRatio = formData.get("aspect_ratio") as string | null;

    // 验证必需参数
    if (!subjectImage || !backgroundImage || !apiKey) {
      return Response.json(
        {
          error: {
            errCode: 400,
            message:
              "Missing required parameters: subject_image, background_image and apiKey",
            messageCn: "缺少必需参数：主体图片、背景图片和API密钥",
            messageEn:
              "Missing required parameters: subject_image, background_image and apiKey",
            messageJa:
              "必要なパラメータが不足しています：主体画像、背景画像とAPIキー",
            type: "VALIDATION_ERROR",
          },
        },
        { status: 400 }
      );
    }

    try {
      // 首先上传背景图片获取URL
      logger.info("uploading-background-image", {
        backgroundImageName: backgroundImage.name,
        backgroundImageSize: backgroundImage.size,
      });

      const uploadFormData = new FormData();
      uploadFormData.append("file", backgroundImage);
      uploadFormData.append("apiKey", apiKey);

      const uploadResponse = await ky.post(
        `${env.NEXT_PUBLIC_API_URL}/302/upload-file`,
        {
          headers: {
            Authorization: `Bearer ${apiKey}`,
          },
          body: uploadFormData,
          timeout: false,
        }
      );

      const uploadResult: any = await uploadResponse.json();
      const backgroundImageUrl =
        uploadResult.data || uploadResult.url || uploadResult.file_url;

      if (!backgroundImageUrl) {
        throw new Error("Failed to upload background image: no URL returned");
      }

      logger.info("background-image-uploaded", {
        backgroundImageUrl: backgroundImageUrl.substring(0, 100) + "...",
      });

      // 然后上传主体图片获取URL
      logger.info("uploading-subject-image", {
        subjectImageName: subjectImage.name,
        subjectImageSize: subjectImage.size,
      });

      const subjectUploadFormData = new FormData();
      subjectUploadFormData.append("file", subjectImage);
      subjectUploadFormData.append("apiKey", apiKey);

      const subjectUploadResponse = await ky.post(
        `${env.NEXT_PUBLIC_API_URL}/302/upload-file`,
        {
          headers: {
            Authorization: `Bearer ${apiKey}`,
          },
          body: subjectUploadFormData,
          timeout: false,
        }
      );

      const subjectUploadResult: any = await subjectUploadResponse.json();
      const subjectImageUrl =
        subjectUploadResult.data ||
        subjectUploadResult.url ||
        subjectUploadResult.file_url;

      if (!subjectImageUrl) {
        throw new Error("Failed to upload subject image: no URL returned");
      }

      logger.info("subject-image-uploaded", {
        subjectImageUrl: subjectImageUrl.substring(0, 100) + "...",
      });

      // 现在调用relight-background API，使用URL而不是文件
      const apiFormData = new FormData();

      // 使用URL而不是文件对象
      apiFormData.append("subject_image", subjectImageUrl);
      apiFormData.append("background_image", backgroundImageUrl);

      // 添加提示词，如果有的话
      if (prompt) {
        apiFormData.append("prompt", prompt);
      } else {
        apiFormData.append("prompt", ""); // 添加空提示词
      }
      if (aspectRatio === "16:9") {
        apiFormData.append("width", "1024");
        apiFormData.append("height", "576");
      } else if (aspectRatio === "9:16") {
        apiFormData.append("width", "576");
        apiFormData.append("height", "1024");
      }

      logger.info("calling-302ai-api", {
        url: `${env.NEXT_PUBLIC_API_URL}/302/submit/relight-background`,
        hasAuthorization: !!apiKey,
        formDataKeys: Array.from(apiFormData.keys()),
        subjectImageUrl: subjectImageUrl.substring(0, 100) + "...",
        backgroundImageUrl: backgroundImageUrl.substring(0, 100) + "...",
      });

      // 调用302.ai的背景合成API
      const response = await ky.post(
        `${env.NEXT_PUBLIC_API_URL}/302/submit/relight-background`,
        {
          headers: {
            Authorization: `Bearer ${apiKey}`,
          },
          body: apiFormData,
          timeout: false, // 90秒超时，考虑到API文档说明的运行时长40-80s
        }
      );

      logger.info("302ai-api-response", {
        status: response.status,
        statusText: response.statusText,
        headers: Object.fromEntries(response.headers.entries()),
      });

      const result = (await response.json()) as BackgroundApiResponse;
      logger.info("initial-api-response", { result });

      // 如果任务正在处理中，需要轮询获取结果
      if (result.status === "starting" || result.status === "processing") {
        const taskId = result.id;
        logger.info("task-submitted-polling-started", {
          taskId,
          status: result.status,
        });

        // 轮询获取结果
        let attempts = 0;
        let consecutiveErrors = 0;
        const maxAttempts = 60; // 最多轮询60次（5分钟）
        const maxConsecutiveErrors = 3; // 最多连续错误3次
        const pollInterval = 5000; // 每5秒轮询一次

        while (attempts < maxAttempts) {
          attempts++;
          await new Promise((resolve) => setTimeout(resolve, pollInterval));

          try {
            logger.info("polling-attempt", {
              attempt: attempts,
              taskId,
              consecutiveErrors,
            });

            const pollResponse = await ky.get(
              `${env.NEXT_PUBLIC_API_URL}/302/submit/relight-background/${taskId}`,
              {
                headers: {
                  Authorization: `Bearer ${apiKey}`,
                },
                timeout: false,
              }
            );

            const pollResult =
              (await pollResponse.json()) as BackgroundApiResponse;
            logger.info("poll-result", {
              attempt: attempts,
              status: pollResult.status,
              hasOutput: !!pollResult.output,
              hasError: !!pollResult.error,
            });

            // 重置连续错误计数
            consecutiveErrors = 0;

            // 任务完成
            if (pollResult.status === "succeeded" && pollResult.output) {
              logger.info("task-completed-successfully", {
                taskId,
                output: pollResult.output,
              });

              // 解析输出URL
              try {
                let imageUrl = pollResult.output;
                if (
                  typeof imageUrl === "string" &&
                  (imageUrl.startsWith("[") || imageUrl.includes('\\"'))
                ) {
                  const parsed = JSON.parse(imageUrl);
                  if (Array.isArray(parsed) && parsed.length > 0) {
                    imageUrl = parsed[0];
                  }
                }

                return Response.json({
                  success: true,
                  newImageUrl: imageUrl,
                });
              } catch (parseError) {
                logger.warn("Failed to parse output URL, using as-is", {
                  output: pollResult.output,
                  error: parseError,
                });
                return Response.json({
                  success: true,
                  newImageUrl: pollResult.output,
                });
              }
            }

            // 任务失败
            if (pollResult.status === "failed") {
              logger.error("task-failed", {
                taskId,
                error: pollResult.error,
                attempts,
              });
              throw new Error(
                pollResult.error || "Background change task failed"
              );
            }

            // 任务仍在处理中，继续轮询
            if (
              pollResult.status === "starting" ||
              pollResult.status === "processing"
            ) {
              logger.info("task-still-processing", {
                taskId,
                status: pollResult.status,
                attempt: attempts,
              });
              continue;
            }

            // 未知状态
            logger.warn("unknown-task-status", {
              taskId,
              status: pollResult.status,
              pollResult,
            });
          } catch (pollError) {
            consecutiveErrors++;
            logger.error("polling-error", {
              attempt: attempts,
              taskId,
              consecutiveErrors,
              maxConsecutiveErrors,
              error: pollError,
              errorType: pollError?.constructor?.name,
              errorMessage:
                pollError instanceof Error
                  ? pollError.message
                  : String(pollError),
            });

            // 如果连续错误次数达到上限，立即失败
            if (consecutiveErrors >= maxConsecutiveErrors) {
              logger.error("too-many-consecutive-polling-errors", {
                taskId,
                consecutiveErrors,
                totalAttempts: attempts,
              });
              throw new Error(
                `Too many consecutive polling errors (${consecutiveErrors}). Last error: ${pollError instanceof Error ? pollError.message : String(pollError)}`
              );
            }

            // 如果是最后一次尝试，抛出错误
            if (attempts >= maxAttempts) {
              throw pollError;
            }

            // 连续错误时增加延迟时间，避免过于频繁的重试
            if (consecutiveErrors > 2) {
              const backoffDelay = Math.min(consecutiveErrors * 2000, 10000); // 最多延迟10秒
              logger.info("applying-backoff-delay", {
                consecutiveErrors,
                backoffDelay,
              });
              await new Promise((resolve) => setTimeout(resolve, backoffDelay));
            }
          }
        }

        // 轮询超时
        logger.error("polling-timeout", { taskId, attempts });
        throw new Error(`Task polling timeout after ${attempts} attempts`);
      } else if (result.output) {
        // 同步返回结果的情况（兼容性处理）
        logger.info("synchronous-result-received", { output: result.output });

        try {
          let imageUrl = result.output;
          if (
            typeof imageUrl === "string" &&
            (imageUrl.startsWith("[") || imageUrl.includes('\\"'))
          ) {
            const parsed = JSON.parse(imageUrl);
            if (Array.isArray(parsed) && parsed.length > 0) {
              imageUrl = parsed[0];
            }
          }

          return Response.json({
            success: true,
            newImageUrl: imageUrl,
          });
        } catch (parseError) {
          logger.warn("Failed to parse output URL, using as-is", {
            output: result.output,
            error: parseError,
          });
          return Response.json({
            success: true,
            newImageUrl: result.output,
          });
        }
      } else {
        logger.error("unexpected-api-response", {
          result,
          hasOutput: !!result.output,
          hasError: !!result.error,
          status: result.status,
          resultKeys: Object.keys(result || {}),
        });
        throw new Error(result.error || "Unexpected API response format");
      }
    } catch (apiError) {
      logger.error("Failed to change background - detailed error", {
        error: apiError,
        errorName: apiError?.constructor?.name,
        errorMessage:
          apiError instanceof Error ? apiError.message : String(apiError),
        errorStack: apiError instanceof Error ? apiError.stack : undefined,
        hasResponse:
          apiError &&
          typeof apiError === "object" &&
          "response" in apiError &&
          !!apiError.response,
      });

      let errorMessage = "Failed to change background";
      let errorCode = 500;

      if (apiError instanceof Error) {
        errorMessage = apiError.message;

        // 处理HTTP错误
        if ("response" in apiError && apiError.response) {
          const response = apiError.response as any;
          errorCode = response.status || 500;

          logger.error("HTTP error details", {
            status: response.status,
            statusText: response.statusText,
            url: response.url,
            headers: response.headers
              ? Object.fromEntries(response.headers.entries())
              : null,
          });

          try {
            const errorData = await response.json();
            logger.error("HTTP error response body", { errorData });
            errorMessage = errorData.error || errorData.message || errorMessage;
          } catch (parseError) {
            logger.error("Failed to parse error response", { parseError });
            // 忽略JSON解析错误，但记录日志
          }
        }
      }

      // 针对特定错误类型添加更多信息
      if (apiError && typeof apiError === "object") {
        if ("code" in apiError) {
          logger.error("Error has code property", { code: apiError.code });
        }
        if ("cause" in apiError) {
          logger.error("Error has cause property", { cause: apiError.cause });
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
    logger.error("Unexpected error in change-background API - detailed info", {
      error: error,
      errorName: error?.constructor?.name,
      errorMessage: error instanceof Error ? error.message : String(error),
      errorStack: error instanceof Error ? error.stack : undefined,
      errorType: typeof error,
      isAPICallError: error instanceof APICallError,
    });

    if (error instanceof APICallError) {
      logger.error("APICallError details", {
        responseBody: error.responseBody,
        cause: error.cause,
        // request: error.request as any,
      });
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
        logger.error("Error has numeric code", { code: errorCode });
      }
    }

    // 记录环境信息，帮助调试
    logger.error("Environment info", {
      apiUrl: env.NEXT_PUBLIC_API_URL,
      nodeVersion: process.version,
      nodeEnv: process.env.NODE_ENV,
    });

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
