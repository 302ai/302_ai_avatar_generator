import { APICallError } from "ai";
import { createScopedLogger } from "@/utils";
import ky from "ky";
import { NextResponse } from "next/server";

const logger = createScopedLogger("create-video");

export async function POST(request: Request) {
  const {
    apiKey,
    audioUrl,
    name = "302test",
  }: {
    apiKey: string;
    audioUrl: string;
    name?: string;
  } = await request.json();

  try {
    const response = await ky.post(
      "https://api.302.ai/chanjing/open/v1/create_customised_audio",
      {
        json: {
          name,
          url: audioUrl,
        },
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        timeout: false,
      }
    );
    const res: any = await response.json();
    console.log("res-audio", res);
    // 轮询获取音频状态
    let success = false;
    while (!success) {
      const audioResponse = await ky.get(
        `https://api.302.ai/chanjing/open/v1/customised_audio?id=${res.data}`,
        {
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
          },
          timeout: false,
        }
      );
      const audioRes: any = await audioResponse.json();
      logger.info("audioRes轮询中", audioRes);

      // 检查是否有错误响应
      if (audioRes.code && audioRes.code !== 0) {
        // API返回了错误，停止轮询并返回错误
        return NextResponse.json(
          {
            error: audioRes.msg || "API调用失败",
            code: audioRes.code,
            trace_id: audioRes.trace_id,
          },
          { status: 400 }
        );
      }

      // 处理不同的状态
      if (audioRes.data && audioRes.data.status === 2) {
        // 成功状态
        success = true;
        res.data = audioRes.data;
      } else if (audioRes.data && audioRes.data.status === -1) {
        // 处理失败状态
        return NextResponse.json({ error: "音频处理失败" }, { status: 500 });
      } else if (audioRes.data && audioRes.data.status === 4) {
        // 处理任务失败状态（如音频有效长度不足5秒）
        const errorMsg = audioRes.data.err_msg || "任务失败";
        logger.error("音频任务失败", { status: 4, err_msg: errorMsg });
        return NextResponse.json(
          {
            error: errorMsg,
            status: 4,
            trace_id: audioRes.trace_id,
          },
          { status: 400 }
        );
      } else {
        // 等待500毫秒后再次轮询
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
    }
    return NextResponse.json(res);
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Failed to create video" },
      { status: 500 }
    );
  }
}
