import {
  APICallError,
  experimental_generateSpeech as generateSpeech,
} from "ai";
import { createAI302 } from "@302ai/ai-sdk";
import { createScopedLogger } from "@/utils";
import ky from "ky";
import { env } from "@/env";

const logger = createScopedLogger("image-to-video");

export async function POST(request: Request) {
  try {
    const {
      apiKey,
      prompt,
      model,
      image,
      duration,
    }: {
      apiKey: string;
      prompt: string;
      model: string;
      image: string;
      duration: string;
    } = await request.json();

    logger.info("Image to video request:", { prompt, model, image });

    // 1. 发起视频生成请求
    const response = await ky.post(
      `${env.NEXT_PUBLIC_API_URL}/302/video/create`,
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
        timeout: false,
        json: {
          prompt,
          model,
          image,
          duration,
        },
      }
    );

    const initialData: any = await response.json();
    logger.info("Initial API Response:", initialData);

    // 2. 获取task_id并开始轮询
    const taskId = initialData?.task_id;
    if (!taskId) {
      throw new Error("No task_id received from API");
    }

    logger.info("Starting polling for task:", taskId);

    // 3. 轮询获取结果
    let attempts = 0;
    const maxAttempts = 60; // 最多轮询60次 (10分钟，每10秒一次)
    const pollInterval = 10000; // 10秒间隔

    while (attempts < maxAttempts) {
      await new Promise((resolve) => setTimeout(resolve, pollInterval));
      attempts++;

      logger.info(
        `Polling attempt ${attempts}/${maxAttempts} for task ${taskId}`
      );

      try {
        const pollResponse = await ky.get(
          `${env.NEXT_PUBLIC_API_URL}/302/video/fetch/${taskId}`,
          {
            headers: {
              Authorization: `Bearer ${apiKey}`,
            },
            timeout: false,
          }
        );

        const pollData: any = await pollResponse.json();
        logger.info("Poll response:", pollData);

        // 检查状态 - 根据实际的API响应结构
        if (pollData.status === "success" && pollData?.url) {
          logger.info("Video generation completed successfully");
          return Response.json(pollData);
        } else if (pollData.status === "fail" || pollData.status === "error") {
          logger.error("Video generation failed");
          throw new Error("Video generation failed");
        }

        // 如果状态是其他值，继续轮询
        logger.info(`Status: ${pollData.status}, continuing to poll...`);
      } catch (pollError) {
        logger.error(`Poll attempt ${attempts} failed:`, pollError);

        // 如果是HTTP错误，检查状态码
        if (pollError instanceof Error && (pollError as any).response) {
          const status = (pollError as any).response.status;

          // 对于某些错误状态码，应该立即停止轮询
          if (status === 404) {
            logger.error("Task not found, stopping polling");
            throw new Error("Task not found");
          } else if (status === 401 || status === 403) {
            logger.error(
              "Authentication/Authorization error, stopping polling"
            );
            throw new Error("Authentication error");
          } else if (status === 500) {
            logger.error("Server error, stopping polling");
            throw new Error("Server internal error");
          }
        }

        // 如果不是最后一次尝试，继续轮询
        if (attempts < maxAttempts) {
          logger.info("Retrying after error...");
          continue;
        } else {
          throw pollError;
        }
      }
    }

    // 轮询超时
    logger.error("Video generation timed out after maximum attempts");
    throw new Error("Video generation timed out");
  } catch (error) {
    logger.error("Video generation error:", error);

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
          message_cn: "生成视频失败",
          message_en: "Failed to generate video",
          message_ja: "视频生成に失敗しました",
          type: "VIDEO_GENERATION_ERROR",
        },
      },
      { status: errorCode }
    );
  }
}
