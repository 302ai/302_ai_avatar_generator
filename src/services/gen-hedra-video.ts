import { languageAtom, store } from "@/stores";
import { langToCountry } from "@/utils/302";
import { emitter } from "@/utils/mitt";
import ky, { HTTPError } from "ky";

interface CreateHedraVideoParams {
  apiKey: string;
  imageFile: File;
  audioFile: File;
  text: string;
  resolution?: "720p" | "540p";
  originalPlatform?: string; // 保持原始平台信息
}

interface CreateHedraVideoResult {
  download_url: string;
  streaming_url?: string;
  video_url?: string;
  type: string;
  model: string;
  platform: string;
  hedra_data: {
    ai_model_id: string;
    audio_id: string;
    start_keyframe_id: string;
    image_url?: string;
    audio_url?: string;
    text_prompt: string;
  };
  videoResData: any;
  pollResData: any;
}

export const createHedraVideo = async ({
  apiKey,
  imageFile,
  audioFile,
  text,
  resolution = "720p",
  originalPlatform,
}: CreateHedraVideoParams) => {
  try {
    // 创建FormData对象
    const formData = new FormData();
    formData.append("text", text);
    formData.append("apiKey", apiKey);
    formData.append("imageFile", imageFile);
    formData.append("audioFile", audioFile);
    formData.append("resolution", resolution);
    if (originalPlatform) {
      formData.append("originalPlatform", originalPlatform);
    }

    const res = await ky.post("/api/create-hedra-video", {
      timeout: false,
      body: formData,
    });
    return res.json<CreateHedraVideoResult>();
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
