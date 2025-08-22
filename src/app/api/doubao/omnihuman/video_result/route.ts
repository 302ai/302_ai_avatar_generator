import { createScopedLogger } from "@/utils";
import ky from "ky";
import { NextResponse } from "next/server";

const logger = createScopedLogger("doubao-omnihuman-video-result");

export async function POST(request: Request) {
  const { task_id, apiKey }: { task_id: string; apiKey: string } =
    await request.json();

  try {
    let pollResData: any;
    let attempts = 0;
    const maxAttempts = 120; // 最多轮询120次（10分钟）
    const pollInterval = 5000; // 5秒间隔

    do {
      await new Promise((resolve) => setTimeout(resolve, pollInterval));

      const pollRes = await ky.post(
        "https://api.302.ai/doubao/omnihuman/video_result",
        {
          json: {
            task_id,
          },
          headers: {
            "Content-Type": "application/json",
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
        `Polling attempt ${attempts + 1}: status=${pollResData.status}, code=${pollResData.code}`
      );

      attempts++;

      // 检查是否成功完成 (data.status为"done"表示成功)
      if (pollResData.data && pollResData.data.status === "done") {
        break; // 成功完成，退出轮询
      }

      // 检查是否有错误
      if (pollResData.code && pollResData.code !== 10000) {
        return NextResponse.json(
          {
            error: `Omnihuman video generation failed: ${pollResData.message}`,
          },
          { status: 500 }
        );
      }
    } while (attempts < maxAttempts);

    // 检查是否超时
    if (attempts >= maxAttempts) {
      return NextResponse.json(
        { error: "Omnihuman video generation timeout after 10 minutes" },
        { status: 500 }
      );
    }

    // 检查是否成功完成
    logger.info(
      `Final check - status: ${pollResData.status}, data.status: ${pollResData.data?.status}`
    );

    if (!pollResData.data || pollResData.data.status !== "done") {
      logger.error(
        `Status check failed - expected data.status "done", got: ${pollResData.data?.status}`
      );
      return NextResponse.json(
        {
          error: `Omnihuman video generation failed with status: ${pollResData.data?.status}`,
        },
        { status: 500 }
      );
    }

    // 检查是否有结果数据
    if (!pollResData.data || !pollResData.data.video_url) {
      logger.error(
        `Result data check failed - pollResData: ${JSON.stringify(pollResData)}`
      );
      return NextResponse.json(
        {
          error: `Omnihuman video generation completed but no video URL available`,
        },
        { status: 500 }
      );
    }

    logger.info(
      `Omnihuman video generation successful! Video URL: ${pollResData.data.video_url}`
    );

    return NextResponse.json({
      video_url: pollResData.data.video_url,
      status: pollResData.status,
      code: pollResData.code,
      data: pollResData.data,
      ...pollResData,
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Failed to poll Omnihuman video result" },
      { status: 500 }
    );
  }
}
