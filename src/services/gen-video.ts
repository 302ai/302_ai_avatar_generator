import { fonts } from "@/constants/fonts";
import { languageAtom, store } from "@/stores";
import { langToCountry } from "@/utils/302";
import { emitter } from "@/utils/mitt";
import ky, { HTTPError } from "ky";

interface CreateVideoParams {
  apiKey: string;
  personId: string;
  audioId: string;
  text: string;
  wavUrl: string;
  driveMode?: string;
  backway?: 1 | 2;
  subtitleConfig?: {
    show: boolean;
    font_size: number;
    color: string;
    stroke_color: string;
    font_id: string;
    stroke_width: number;
  };
  type: string;
}

interface CreateVideoResult {
  data: string;
  msg: string;
}

export const createVideo = async ({
  apiKey,
  personId,
  audioId,
  text,
  wavUrl,
  driveMode,
  backway,
  subtitleConfig,
  type,
}: CreateVideoParams) => {
  try {
    const res = await ky.post("/api/create-video", {
      timeout: 300000,
      json: {
        personId,
        audioId,
        text,
        wavUrl,
        apiKey,
        driveMode,
        backway,
        subtitleConfig,
        type,
      },
    });
    return res.json<CreateVideoResult>();
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
