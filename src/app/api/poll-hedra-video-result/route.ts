import { createScopedLogger } from "@/utils";
import ky from "ky";
import { NextResponse } from "next/server";
import { env } from "@/env";

const logger = createScopedLogger("poll-hedra-video-result");

export async function POST(request: Request) {
  const { id, apiKey }: { id: string; apiKey: string } = await request.json();

  try {
    let pollResData: any;
    let attempts = 0;
    const maxAttempts = 120; // 最多轮询120次（10分钟）
    const pollInterval = 5000; // 5秒间隔

    do {
      await new Promise((resolve) => setTimeout(resolve, pollInterval));

      const pollRes = await ky.get(
        `${env.NEXT_PUBLIC_API_URL}/hedra/web-app/public/generations/${id}/status`,
        {
          headers: {
            Authorization: `Bearer ${apiKey}`,
          },
          timeout: false,
        }
      );

      const pollResText = await pollRes.text();
      logger.info(`Polling attempt ${attempts + 1}`, pollResText);

      try {
        pollResData = JSON.parse(pollResText);
      } catch (error) {
        logger.error(
          `Failed to parse polling response as JSON: ${pollResText}`
        );
        return NextResponse.json(
          { error: `Invalid JSON response from polling API: ${pollResText}` },
          { status: 400 }
        );
      }

      logger.info(
        `Polling attempt ${attempts + 1}: status=${pollResData.status}, progress=${pollResData.progress}`
      );

      attempts++;

      // 如果有错误，立即返回
      if (pollResData.error_message) {
        return NextResponse.json(
          { error: `Video generation failed: ${pollResData.error_message}` },
          { status: 500 }
        );
      }
    } while (
      (pollResData.status === "processing" ||
        pollResData.status === "queued" ||
        pollResData.status === "finalizing") &&
      attempts < maxAttempts
    );

    // 检查是否超时
    if (attempts >= maxAttempts) {
      return NextResponse.json(
        { error: "Video generation timeout after 10 minutes" },
        { status: 500 }
      );
    }

    // 检查是否成功完成
    logger.info(
      `Final check - status: ${pollResData.status}, download_url exists: ${!!pollResData.download_url}`
    );

    if (
      pollResData.status !== "complete" &&
      pollResData.status !== "completed"
    ) {
      logger.error(
        `Status check failed - expected 'complete' or 'completed', got: ${pollResData.status}`
      );
      return NextResponse.json(
        { error: `Video generation failed with status: ${pollResData.status}` },
        { status: 500 }
      );
    }

    if (!pollResData.download_url) {
      logger.error(
        `Download URL check failed - pollResData: ${JSON.stringify(pollResData)}`
      );
      return NextResponse.json(
        { error: `Video generation completed but no download URL available` },
        { status: 500 }
      );
    }

    logger.info(
      `Video generation successful! Download URL: ${pollResData.download_url}`
    );

    return NextResponse.json({
      download_url: pollResData.download_url,
      streaming_url: pollResData.streaming_url,
      video_url: pollResData.url,
      status: pollResData.status,
      progress: pollResData.progress,
      ...pollResData,
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Failed to poll hedra video result" },
      { status: 500 }
    );
  }
}
