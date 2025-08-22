import { APICallError } from "ai";
import { createScopedLogger } from "@/utils";
import { env } from "@/env";
import ky from "ky";

const logger = createScopedLogger("translate-prompt");

interface DeepLTranslation {
  detected_source_language?: string;
  text: string;
}

interface DeepLResponse {
  translations: DeepLTranslation[];
}

export async function POST(request: Request) {
  try {
    const {
      language,
      apiKey,
      message,
    }: {
      language: "ZH" | "EN" | "JA";
      apiKey: string;
      message: string;
    } = await request.json();
    logger.info("translate-prompt", { language, apiKey, message });

    try {
      // Using a Record to type the payload while allowing string keys
      const payload: Record<string, unknown> = {
        text: [message],
        target_lang: language,
      };

      const response = await ky.post(
        `${env.NEXT_PUBLIC_API_URL}/deepl/v2/translate`,
        {
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          json: payload,
        }
      );

      const result = (await response.json()) as DeepLResponse;
      logger.info("translation-success", { result });

      if (result.translations && result.translations.length > 0) {
        const translatedText = result.translations[0].text;
        return Response.json({ translatedText });
      } else {
        throw new Error("No translations found in response");
      }
    } catch (parseError) {
      logger.error("Failed to translate text", parseError);
      return Response.json(
        {
          error: "Failed to translate text",
          details:
            parseError instanceof Error
              ? parseError.message
              : String(parseError),
        },
        { status: 500 }
      );
    }
  } catch (error) {
    logger.error(error);
    if (error instanceof APICallError) {
      const resp = error.responseBody;
      return Response.json(resp, { status: 500 });
    }

    // Handle different types of errors
    let errorMessage = "Failed to generate prompt";
    let errorCode = 500;

    if (error instanceof Error) {
      errorMessage = error.message;
      if ("code" in error && typeof (error as any).code === "number") {
        errorCode = (error as any).code;
      }
    }

    return Response.json(
      {
        error: {
          errCode: errorCode,
          message: errorMessage,
          messageCn: "翻译失败",
          messageEn: "Failed to translate",
          messageJa: "翻訳に失敗しました",
          type: "TRANSLATE_ERROR",
        },
      },
      { status: errorCode }
    );
  }
}
