import { createScopedLogger } from "@/utils";
import ky from "ky";
import { NextResponse } from "next/server";

const logger = createScopedLogger("poll-chanjing-video-result");

export async function POST(request: Request) {
  const { id, apiKey }: { id: string; apiKey: string } = await request.json();

  try {
    let success = false;
    let result = null;

    while (!success) {
      const videoResponse = await ky.get(
        `https://api.302.ai/chanjing/open/v1/video?id=${id}`,
        {
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
          },
          timeout: false,
        }
      );
      const videoRes: any = await videoResponse.json();
      logger.info("videoRes轮询中", videoRes);

      // 检查是否有错误响应
      if (videoRes.code && videoRes.code !== 0) {
        // API返回了错误，停止轮询并返回错误
        return NextResponse.json(
          {
            error: videoRes.msg || "API调用失败",
            code: videoRes.code,
            trace_id: videoRes.trace_id,
          },
          { status: 400 }
        );
      }

      if (videoRes.data.status === 30) {
        success = true;
        result = videoRes.data;
      } else if (videoRes.data.status === -1 || videoRes.data.status === 40) {
        // 处理失败状态
        return NextResponse.json({ error: "视频处理失败" }, { status: 500 });
      } else {
        // 等待500毫秒后再次轮询
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
    }
    return NextResponse.json(result);
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Failed to poll video result" },
      { status: 500 }
    );
  }
}
