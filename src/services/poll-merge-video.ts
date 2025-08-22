import { fonts } from "@/constants/fonts";
import { languageAtom, store } from "@/stores";
import { langToCountry } from "@/utils/302";
import { emitter } from "@/utils/mitt";
import ky, { HTTPError } from "ky";

interface PollMergeVideoParams {
  apiKey: string;
  taskId: string;
}

interface PollMergeVideoResult {
  data: {
    id: string;
  };
}

export const pollMergeVideo = async ({
  apiKey,
  taskId,
}: PollMergeVideoParams) => {
  try {
    const res = await ky.post(`/api/poll-merge-videos`, {
      timeout: false,
      json: {
        apiKey,
        taskId,
      },
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer sk-Uj04ziVrImxwMz0YpaNF5RWL9dkmCTcyZzuDexYLmNs1QKFw`,
      },
    });
    return res.json<PollMergeVideoResult>();
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
