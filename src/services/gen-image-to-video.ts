import { languageAtom, store } from "@/stores";
import { langToCountry } from "@/utils/302";
import { emitter } from "@/utils/mitt";
import { error } from "console";
import ky, { HTTPError } from "ky";

interface CreateTextToImageParams {
  apiKey: string;
  prompt: string;
  model: string;
  image: string;
  duration?: string;
}

interface CreateTextToImageResult {
  data: {
    video: {
      url: string;
      content_type: string;
      file_size: number;
    };
    seed: number;
    status: string;
    request_id: string;
  };
  url: string;
  status: string;
}

export const createImageToVideo = async ({
  apiKey,
  prompt,
  model,
  image,
  duration,
}: CreateTextToImageParams) => {
  try {
    const res = await ky.post<CreateTextToImageResult>("/api/image-to-video", {
      timeout: 300000,
      json: {
        prompt,
        model,
        apiKey,
        image,
        duration,
      },
    });
    const data = await res.json();
    return data;
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
