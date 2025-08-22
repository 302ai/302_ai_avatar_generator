import { APICallError, experimental_generateImage, generateText } from "ai";
import { createAI302 } from "@302ai/ai-sdk";
import { env } from "@/env";
import { createScopedLogger } from "@/utils";

const logger = createScopedLogger("gen-image");

export async function POST(request: Request) {
  try {
    const {
      prompt,
      aspectRatio,
      model,
      apiKey,
    }: {
      prompt: string;
      aspectRatio: string;
      model: string[];
      apiKey: string;
    } = await request.json();

    const ai302 = createAI302({
      apiKey,
      baseURL: env.NEXT_PUBLIC_API_URL,
    });

    // Generate images for all models in parallel
    const results = await Promise.all(
      model.map(async (modelId) => {
        const { image } = await experimental_generateImage({
          model: ai302.image(modelId),
          prompt,
          aspectRatio: aspectRatio as `${number}:${number}`,
        });
        return {
          image: image.base64,
          prompt,
          model: modelId,
        };
      })
    );

    return Response.json({ images: results });
  } catch (error) {
    logger.error(error);
    if (error instanceof APICallError) {
      const resp = error.responseBody;

      return Response.json(resp, { status: 500 });
    }
    // Handle different types of errors
    let errorMessage = "Failed to generate image";
    let errorCode = 500;

    if (error instanceof Error) {
      errorMessage = error.message;
      // You can add specific error code mapping here if needed
      if ("code" in error && typeof (error as any).code === "number") {
        errorCode = (error as any).code;
      }
    }

    return Response.json(
      {
        error: {
          err_code: errorCode,
          message: errorMessage,
          message_cn: "生成图片失败",
          message_en: "Failed to generate image",
          message_ja: "画像の生成に失敗しました",
          type: "IMAGE_GENERATION_ERROR",
        },
      },
      { status: errorCode }
    );
  }
}
