import { emitter } from "@/utils/mitt";
import ky, { HTTPError } from "ky";

interface CreateOmnihumanVideoParams {
  imageUrl: string;
  audioUrl: string;
  apiKey: string;
}

interface CreateOmnihumanVideoResult {
  code: number;
  data: {
    task_id: string;
  };
  message: string;
  request_id: string;
  status: number;
  time_elapsed: string;
}

export const createOmnihumanVideo = async ({
  imageUrl,
  audioUrl,
  apiKey,
}: CreateOmnihumanVideoParams) => {
  try {
    const res = await ky.post("/api/doubao/omnihuman/video", {
      timeout: 300000,
      json: {
        image_url: imageUrl,
        audio_url: audioUrl,
        apiKey,
      },
    });
    return res.json<CreateOmnihumanVideoResult>();
  } catch (error) {
    if (error instanceof Error) {
      if (error instanceof HTTPError) {
        try {
          const errorData = JSON.parse((await error.response.json()) as string);
          emitter.emit("ToastError", {
            code: error.response.status,
            message:
              errorData.error ||
              errorData.message ||
              "Failed to create Omnihuman video",
          });
        } catch {
          emitter.emit("ToastError", {
            code: error.response.status,
            message: error.message,
          });
        }
      } else {
        emitter.emit("ToastError", {
          code: 500,
          message: error.message,
        });
      }
    }
    throw error;
  }
};

interface PollOmnihumanVideoRequest {
  taskId: string;
  apiKey: string;
}

interface PollOmnihumanVideoResult {
  video_url: string;
  status: string;
  code: number;
  data: {
    video_url: string;
    [key: string]: any;
  };
  [key: string]: any;
}

export const pollOmnihumanVideo = async ({
  taskId,
  apiKey,
}: PollOmnihumanVideoRequest) => {
  try {
    const response = await ky.post("/api/doubao/omnihuman/video_result", {
      timeout: false,
      json: {
        task_id: taskId,
        apiKey,
      },
    });
    return response.json<PollOmnihumanVideoResult>();
  } catch (error) {
    if (error instanceof Error) {
      if (error instanceof HTTPError) {
        try {
          const errorData = JSON.parse((await error.response.json()) as string);
          emitter.emit("ToastError", {
            code: error.response.status,
            message:
              errorData.error ||
              errorData.message ||
              "Failed to poll Omnihuman video result",
          });
        } catch {
          emitter.emit("ToastError", {
            code: error.response.status,
            message: error.message,
          });
        }
      } else {
        emitter.emit("ToastError", {
          code: 500,
          message: error.message,
        });
      }
    }
    throw error;
  }
};
