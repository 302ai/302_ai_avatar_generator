import {
  APICallError,
  experimental_generateSpeech as generateSpeech,
} from "ai";
import { createAI302 } from "@302ai/ai-sdk";
import { createScopedLogger } from "@/utils";
import { env } from "@/env";

const logger = createScopedLogger("image-to-video");

export async function POST(request: Request) {
  try {
    // 检查请求内容类型
    const contentType = request.headers.get("content-type");
    let apiKey: string;
    let prompt: string | undefined;
    let input_image: File | string;
    let aspect_ratio: "16:9" | "9:16";

    if (contentType?.includes("multipart/form-data")) {
      // 处理 FormData
      const formData = await request.formData();
      apiKey = formData.get("apiKey") as string;
      prompt = formData.get("prompt") as string | undefined;
      input_image = formData.get("input_image_file") as File;
      aspect_ratio = formData.get("aspect_ratio") as "16:9" | "9:16";
    } else {
      // 处理 JSON
      const data = await request.json();
      apiKey = data.apiKey;
      prompt = data.prompt;
      input_image = data.input_image;
      aspect_ratio = data.aspect_ratio;
    }

    // 确保有必要的参数
    if (!apiKey || !input_image || !aspect_ratio) {
      return Response.json(
        {
          error: {
            err_code: 400,
            message: "Missing required parameters",
            message_cn: "缺少必要参数",
            type: "MISSING_PARAMETERS",
          },
        },
        { status: 400 }
      );
    }

    // 2. 创建 FormData 并发起视频生成请求
    const formData = new FormData();

    // 处理不同类型的input_image
    if (typeof input_image === "string") {
      // 字符串URL的情况，需要先获取文件
      logger.info("Input is URL, fetching image:", input_image);
      try {
        const imageResponse = await fetch(input_image);
        if (!imageResponse.ok) {
          throw new Error(`Failed to fetch image: ${imageResponse.status}`);
        }
        const imageBlob = await imageResponse.blob();

        // 检查是否为图片类型
        if (!imageBlob.type.startsWith("image/")) {
          logger.error("Invalid file type from URL:", { type: imageBlob.type });
          return Response.json(
            {
              error: {
                err_code: 400,
                message: "URL does not point to an image file",
                message_cn: "URL指向的不是图片文件",
                type: "INVALID_IMAGE_URL",
              },
            },
            { status: 400 }
          );
        }

        formData.append("input_image", imageBlob, "input_image.jpg");
        logger.info("Successfully fetched image from URL:", {
          size: imageBlob.size,
          type: imageBlob.type,
        });
      } catch (fetchError) {
        logger.error("Failed to fetch image from URL:", fetchError);
        return Response.json(
          {
            error: {
              err_code: 400,
              message: "Failed to fetch image from URL",
              message_cn: "无法从URL获取图片",
              type: "IMAGE_FETCH_ERROR",
            },
          },
          { status: 400 }
        );
      }
    } else {
      // File对象的情况
      formData.append("input_image", input_image);

      // 验证图片文件类型
      if (input_image && !input_image.type.startsWith("image/")) {
        logger.error("Invalid file type:", { type: input_image.type });
        return Response.json(
          {
            error: {
              err_code: 400,
              message: "Invalid file type, expected image file",
              message_cn: "无效的文件类型，期望图片文件",
              type: "INVALID_FILE_TYPE",
            },
          },
          { status: 400 }
        );
      }
    }

    if (prompt) {
      formData.append("prompt", prompt);
    }
    formData.append("aspect_ratio", aspect_ratio);

    logger.info("Sending request with parameters:", {
      hasImage: !!input_image,
      imageType: typeof input_image === "string" ? "URL" : input_image?.type,
      imageSize: typeof input_image === "string" ? "URL" : input_image?.size,
      imageName: typeof input_image === "string" ? "URL" : input_image?.name,
      prompt,
      aspect_ratio,
    });
    // formData.append("prompt", prompt || "");
    // formData.append("negative_prompt", "");
    // formData.append("cfg", "0.5");
    // formData.append("aspect_ratio", aspect_ratio === "16:9" ? "16:9" : aspect_ratio === "9:16" ? "9:16" : "1:1");
    // formData.append("enable_audio", "");

    // 使用 fetch 发送请求（完全按照示例代码格式）
    const myHeaders = new Headers();
    myHeaders.append("Authorization", `Bearer ${apiKey}`);

    const requestOptions: RequestInit = {
      method: "POST",
      headers: myHeaders,
      body: formData,
      redirect: "follow",
    };

    const response = await fetch(
      `${env.NEXT_PUBLIC_API_URL}/klingai/m2v_21_img2video_hq_10s`,
      requestOptions
    );

    if (!response.ok) {
      const errorText = await response.text();
      logger.error("API request failed", {
        status: response.status,
        statusText: response.statusText,
        body: errorText,
        url: `${env.NEXT_PUBLIC_API_URL}/klingai/m2v_21_img2video_hq_10s`,
      });

      // 尝试解析错误响应
      let errorResponse;
      try {
        errorResponse = JSON.parse(errorText);
      } catch {
        errorResponse = {
          error: {
            err_code: response.status,
            message: errorText || response.statusText,
            message_cn: `API请求失败: ${response.status}`,
            type: "API_ERROR",
          },
        };
      }

      return Response.json(errorResponse, { status: response.status });
    }

    const responseText = await response.text();
    logger.info("Raw API Response12312312:", responseText);

    let initialResult;
    try {
      initialResult = JSON.parse(responseText);
    } catch (parseError) {
      logger.error("Failed to parse API response as JSON:", {
        responseText: responseText.substring(0, 1000),
        parseError,
      });

      return Response.json(
        {
          error: {
            err_code: 500,
            message: "Invalid JSON response from API",
            message_cn: "API返回了无效的JSON格式",
            type: "JSON_PARSE_ERROR",
            raw_response: responseText.substring(0, 500),
          },
        },
        { status: 500 }
      );
    }

    logger.info("Initial video generation API Response:", initialResult);

    // 2. 获取task_id并开始轮询
    const taskId =
      initialResult?.task_id ||
      initialResult?.data?.task_id ||
      initialResult?.data?.task?.id;
    if (!taskId) {
      // 如果没有task_id，可能是同步响应，直接返回
      logger.info("No task_id found, assuming synchronous response");
      return Response.json(initialResult);
    }

    logger.info("Starting polling for video task:", taskId);

    // 3. 轮询获取结果
    let attempts = 0;
    const maxAttempts = 120; // 最多轮询120次 (20分钟，每10秒一次)
    const pollInterval = 10000; // 10秒间隔

    while (attempts < maxAttempts) {
      await new Promise((resolve) => setTimeout(resolve, pollInterval));
      attempts++;

      logger.info(
        `Polling attempt ${attempts}/${maxAttempts} for video task ${taskId}`
      );

      try {
        const pollResponse = await fetch(
          `${env.NEXT_PUBLIC_API_URL}/klingai/task/${taskId}/fetch`,
          {
            method: "GET",
            headers: {
              Authorization: `Bearer ${apiKey}`,
            },
          }
        );

        if (!pollResponse.ok) {
          logger.error("Poll request failed:", {
            status: pollResponse.status,
            statusText: pollResponse.statusText,
          });

          // 对于某些错误状态码，应该立即停止轮询
          if (pollResponse.status === 404) {
            logger.error("Task not found, stopping polling");
            throw new Error("Task not found");
          } else if (
            pollResponse.status === 401 ||
            pollResponse.status === 403
          ) {
            logger.error(
              "Authentication/Authorization error, stopping polling"
            );
            throw new Error("Authentication error");
          }

          // 对于其他错误，如果不是最后一次尝试，继续轮询
          if (attempts < maxAttempts) {
            logger.info("Poll request failed, retrying...");
            continue;
          } else {
            throw new Error(`Poll request failed: ${pollResponse.status}`);
          }
        }

        const pollText = await pollResponse.text();
        let pollData;

        try {
          pollData = JSON.parse(pollText);
        } catch (pollParseError) {
          logger.error("Failed to parse poll response:", {
            pollText: pollText.substring(0, 1000),
            pollParseError,
          });

          if (attempts < maxAttempts) {
            continue;
          } else {
            throw new Error("Failed to parse poll response");
          }
        }

        logger.info("Poll response:", JSON.stringify(pollData, null, 2));

        // 检查状态 - 根据KlingAI API的响应结构调整
        // KlingAI 使用数字状态码：10=处理中，50=失败，99=成功
        const taskStatus = pollData?.data?.task?.status || pollData?.status;

        if (
          taskStatus === 99 ||
          pollData.status === "success" ||
          pollData.status === "completed"
        ) {
          // 成功状态，检查是否有视频URL
          const videoUrl =
            pollData?.data?.works?.[0]?.resource?.resource ||
            pollData?.data?.video?.url ||
            pollData?.url;
          if (videoUrl) {
            logger.info(
              "Video generation completed successfully, video URL:",
              videoUrl
            );
            // 返回简化的响应，只包含视频URL
            return Response.json({
              success: true,
              video_url: videoUrl,
              task_id: taskId,
              full_response: pollData,
            });
          } else {
            logger.warn("Task completed but no video URL found");
          }
        } else if (
          taskStatus === 50 ||
          pollData.status === "fail" ||
          pollData.status === "error" ||
          pollData.status === "failed"
        ) {
          logger.error("Video generation failed:", pollData);
          return Response.json(
            {
              error: {
                err_code: 500,
                message: pollData.error || "Video generation failed",
                message_cn: "视频生成失败",
                type: "VIDEO_GENERATION_FAILED",
              },
            },
            { status: 500 }
          );
        }

        // 如果状态是其他值（如10=processing），继续轮询
        logger.info(
          `Task status: ${taskStatus}, API status: ${pollData.status}, continuing to poll...`
        );
      } catch (pollError) {
        logger.error(`Poll attempt ${attempts} failed:`, pollError);

        // 如果不是最后一次尝试，继续轮询
        if (attempts < maxAttempts) {
          logger.info("Retrying after poll error...");
          continue;
        } else {
          throw pollError;
        }
      }
    }

    // 轮询超时
    logger.error("Video generation timed out after maximum attempts");
    return Response.json(
      {
        error: {
          err_code: 408,
          message: "Video generation timed out",
          message_cn: "视频生成超时",
          type: "VIDEO_GENERATION_TIMEOUT",
        },
      },
      { status: 408 }
    );
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
