import { createScopedLogger } from "@/utils";
import ky from "ky";
import { NextResponse } from "next/server";

const logger = createScopedLogger("create-video");

export async function POST(request: Request) {
  const {
    apiKey,
    taskId,
  }: {
    taskId: string;
    apiKey: string;
  } = await request.json();

  if (!apiKey || !taskId) {
    return NextResponse.json(
      { error: "Missing required parameters: apiKey and taskId are required" },
      { status: 400 }
    );
  }

  try {
    const result = await pollVideoStatus(taskId, apiKey);
    return NextResponse.json(result);
  } catch (error) {
    logger.error("Poll video status failed:", error);
    return NextResponse.json(
      {
        error: "Failed to poll video status",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

async function pollVideoStatus(taskId: string, apiKey: string): Promise<any> {
  const MAX_POLLING_TIME = 20 * 60 * 1000; // 20分钟超时
  const POLLING_INTERVAL = 5000; // 3秒轮询间隔
  const startTime = Date.now();

  return new Promise((resolve, reject) => {
    const poll = async () => {
      try {
        // 检查是否超时
        if (Date.now() - startTime > MAX_POLLING_TIME) {
          reject(new Error("Polling timeout: video generation took too long"));
          return;
        }

        const res = await ky.get(
          `${process.env.NEXT_PUBLIC_API_URL}/302/submit/stable-avatar?request_id=${taskId}`,
          {
            headers: {
              Authorization: `Bearer ${apiKey}`,
            },
            timeout: false,
          }
        );

        const response: any = await res.json();
        logger.info("Poll response:", response);

        // if (!response.result || !response.result.status) {
        //   reject(new Error("Invalid response format"));
        //   return;
        // }

        const { status, video } = response;

        switch (status) {
          case "running":
            // 继续轮询
            setTimeout(poll, POLLING_INTERVAL);
            break;

          case "COMPLETED":
            if (video.url) {
              resolve({
                success: true,
                video_url: video.url,
                taskId: taskId,
                status: "completed",
              });
            } else {
              reject(new Error("Success status but no video URL provided"));
            }
            break;

          case "failed":
            reject(new Error("Video generation failed"));
            break;

          default:
            // 未知状态，继续轮询
            logger.warn(`Unknown status: ${status}, continuing to poll`);
            setTimeout(poll, POLLING_INTERVAL);
            break;
        }
      } catch (error) {
        logger.error("Polling error:", error);

        // 如果是网络错误，继续重试
        if (error instanceof Error && error.message.includes("network")) {
          setTimeout(poll, POLLING_INTERVAL);
        } else {
          reject(error);
        }
      }
    };

    // 开始轮询
    poll();
  });
}
