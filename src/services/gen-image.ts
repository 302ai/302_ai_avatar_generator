import ky, { HTTPError } from "ky";
import { emitter } from "@/utils/mitt";
import { store, languageAtom } from "@/stores";
import { langToCountry } from "@/utils/302";

interface GenerateImageParams {
  prompt: string;
  shouldOptimize: boolean;
  shouldTranslate: boolean;
  aspectRatio: `${number}:${number}`;
  model: string[];
  apiKey: string;
}

interface GenerateImageResult {
  images: Array<{
    image: string;
    prompt: string;
    model: string;
  }>;
}

export const generateImage = async ({
  prompt,
  shouldOptimize,
  shouldTranslate,
  aspectRatio,
  model,
  apiKey,
}: GenerateImageParams) => {
  try {
    const res = await ky.post("/api/gen-image", {
      timeout: 300000,
      json: {
        prompt,
        shouldOptimize,
        shouldTranslate,
        aspectRatio,
        model,
        apiKey,
      },
    });
    return res.json<GenerateImageResult>();
  } catch (error) {
    if (error instanceof Error) {
      const uiLanguage = store.get(languageAtom);

      if (error instanceof HTTPError) {
        try {
          const errorData = JSON.parse((await error.response.json()) as string);
          if (errorData.error && uiLanguage) {
            const countryCode = langToCountry(uiLanguage);
            const messageKey =
              countryCode === "en" ? "message" : `message_${countryCode}`;
            const message = errorData.error[messageKey];
            emitter.emit("ToastError", {
              code: errorData.error.err_code,
              message,
            });
          }
        } catch {
          // If we can't parse the error response, show a generic error
          emitter.emit("ToastError", {
            code: error.response.status,
            message: error.message,
          });
        }
      } else {
        // For non-HTTP errors
        emitter.emit("ToastError", {
          code: 500,
          message: error.message,
        });
      }
    }
    throw error; // Re-throw the error for the caller to handle if needed
  }
};
