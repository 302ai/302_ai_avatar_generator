import ky, { HTTPError } from "ky";
import { emitter } from "@/utils/mitt";
import { store, languageAtom } from "@/stores";
import { langToCountry } from "@/utils/302";

interface GenerateChatParams {
  prompt: string;
  gender: string;
  age: string;
  region: string;
  apiKey: string;
  referenceType: string;
  referenceContent: string;
}

interface GenerateChatResult {
  result: string;
}

export const chat = async ({
  prompt,
  gender,
  age,
  region,
  apiKey,
  referenceType,
  referenceContent,
}: GenerateChatParams) => {
  try {
    const finalPrompt = `
    Age: ${age}
    Gender: ${gender}
    Region: ${region}
    Reference type: ${referenceType}
    User prompt words: ${prompt}
    Reference content: ${referenceContent}
    `;
    const res = await ky.post("/api/gen-chat", {
      timeout: 300000,
      json: {
        prompt: finalPrompt,
        apiKey,
      },
    });
    return res.json<GenerateChatResult>();
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
