import { languageAtom, store } from "@/stores";
import { langToCountry } from "@/utils/302";
import { emitter } from "@/utils/mitt";
import { error } from "console";
import ky, { HTTPError } from "ky";

interface CreateTextToImageParams {
  apiKey: string;
  prompt?: string;
  input_image: File | string;
  aspect_ratio: "16:9" | "9:16";
}

interface CreateTextToImageResult {
  data?: {
    video?: {
      url: string;
      content_type: string;
      file_size: number;
    };
    seed?: number;
    status?: string;
    request_id?: string;
    task_id?: string;
  };
  url?: string;
  status: string;
  task_id?: string;
  // 轮询结果可能的字段
  video?: {
    url: string;
  };
  // 新的API响应格式
  success?: boolean;
  video_url?: string;
  error?: string;
}

export const createImage2Video = async ({
  apiKey,
  prompt,
  input_image,
  aspect_ratio,
}: CreateTextToImageParams) => {
  try {
    let res: Response;

    if (input_image instanceof File) {
      // 如果input_image是File对象，使用FormData发送
      const formData = new FormData();
      formData.append("apiKey", apiKey);
      formData.append("input_image_file", input_image);
      if (prompt) {
        formData.append("prompt", prompt);
      }
      formData.append("aspect_ratio", aspect_ratio);

      res = await ky.post("/api/image-2-video", {
        timeout: false,
        body: formData,
      });
    } else {
      // 如果input_image是字符串URL，使用JSON发送
      res = await ky.post("/api/image-2-video", {
        timeout: false,
        json: {
          prompt,
          apiKey,
          input_image,
          aspect_ratio,
        },
      });
    }

    const data = (await res.json()) as CreateTextToImageResult;

    // 检查是否有错误
    if (data.error) {
      throw new Error(data.error);
    }

    // 检查响应状态
    if (
      data.status === "fail" ||
      data.status === "error" ||
      data.status === "failed"
    ) {
      throw new Error(data.error || "视频生成失败");
    }

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
