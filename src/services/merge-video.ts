import { fonts } from "@/constants/fonts";
import { languageAtom, store } from "@/stores";
import { langToCountry } from "@/utils/302";
import { emitter } from "@/utils/mitt";
import ky, { HTTPError } from "ky";

interface MergeVideoParams {
  apiKey: string;
  videos: string[];
  operation: "audio_separation" | "video_merge";
}

interface MergeVideoResult {
  task_id: string;
  status: "pending" | "processing" | "completed" | "failed";
}

export const mergeVideo = async ({
  apiKey,
  videos,
  operation,
}: MergeVideoParams) => {
  try {
    const res = await ky.post("/api/merge-videos", {
      timeout: false,
      json: {
        videos,
        operation,
        apiKey,
      },
    });
    return res.json<MergeVideoResult>();
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
