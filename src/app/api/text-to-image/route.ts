import {
  APICallError,
  experimental_generateSpeech as generateSpeech,
} from "ai";
import { createAI302 } from "@302ai/ai-sdk";
import { createScopedLogger } from "@/utils";
import ky from "ky";
import { env } from "@/env";

const logger = createScopedLogger("text-to-image");

export async function POST(request: Request) {
  try {
    const {
      apiKey,
      prompt,
      model,
      image,
      aspectRatio,
    }: {
      apiKey: string;
      prompt: string;
      model: string;
      image: string;
      aspectRatio: string;
    } = await request.json();
    let width = 0;
    let height = 0;
    // console.log(model, aspectRatio);
    if (model === "302ai-flux-v1.1-pro-t2i") {
      // 仅支持指定图片尺寸， 宽高范围在256到1440之间，而且要求是32的整数倍
      // 1024×576（16：9），576×1024（9：16）
      // newAspectRatio = aspectRatio === "16:9" ? "1024:576" : "576:1024";
      if (aspectRatio === "16:9") {
        width = 1280;
        height = 576;
      } else {
        width = 768;
        height = 1344;
      }
    }
    if (model === "doubao-v3-t2i") {
      if (aspectRatio === "16:9") {
        width = 1280;
        height = 576;
      } else {
        width = 768;
        height = 1344;
      }
    }

    const response = await ky.post(
      `${env.NEXT_PUBLIC_API_URL}/302/image/generate`,
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
        timeout: false,
        json: {
          prompt,
          model,
          ...(image !== "" ? { image } : {}),
          aspect_ratio: aspectRatio,
          width,
          height,
        },
      }
    );

    const responseData: any = await response.json();

    console.log("API Response:", responseData);

    return Response.json(responseData);
  } catch (error) {
    logger.error("Speech generation error");

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
          message_cn: "生成图像失败",
          message_en: "Failed to generate image",
          message_ja: "画像生成に失敗しました",
          type: "IMAGE_GENERATION_ERROR",
        },
      },
      { status: errorCode }
    );
  }
}
