import { useState } from "react";
import ky from "ky";
import type {
  BackgroundChangeRequest,
  BackgroundChangeResponse,
  BackgroundApiErrorResponse,
} from "@/types/background-api";

interface UseBackgroundChangeOptions {
  onSuccess?: (result: BackgroundChangeResponse) => void;
  onError?: (error: BackgroundApiErrorResponse) => void;
}

export function useBackgroundChange(options?: UseBackgroundChangeOptions) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<BackgroundApiErrorResponse | null>(null);
  const [result, setResult] = useState<BackgroundChangeResponse | null>(null);
  // 为图片上传添加额外的状态
  const [isLoadingImage, setIsLoadingImage] = useState(false);

  const changeBackground = async (
    params: Omit<BackgroundChangeRequest, "apiKey"> & { apiKey?: string }
  ) => {
    setIsLoading(true);
    setError(null);
    setResult(null);

    try {
      // 如果没有提供apiKey，尝试从环境变量获取
      const apiKey = params.apiKey || process.env.NEXT_PUBLIC_302_API_KEY;

      if (!apiKey) {
        throw new Error("API key is required");
      }

      const requestData: BackgroundChangeRequest = {
        ...params,
        apiKey,
      };

      const response = await ky.post("/api/change-background", {
        json: requestData,
        timeout: false, // 60秒超时
      });

      const data = (await response.json()) as BackgroundChangeResponse;
      setResult(data);
      options?.onSuccess?.(data);
      return data;
    } catch (err) {
      let errorResponse: BackgroundApiErrorResponse;

      // 处理ky的HTTP错误
      if (err && typeof err === "object" && "response" in err) {
        try {
          const kyError = err as any;
          const errorData =
            (await kyError.response.json()) as BackgroundApiErrorResponse;
          errorResponse = errorData;
        } catch {
          // 如果无法解析错误响应，使用默认错误
          errorResponse = {
            error: {
              errCode: 500,
              message: "Network error",
              messageCn: "网络错误",
              messageEn: "Network error",
              messageJa: "ネットワークエラー",
              type: "NETWORK_ERROR",
            },
          };
        }
      } else {
        // 处理其他类型的错误
        errorResponse = {
          error: {
            errCode: 500,
            message: err instanceof Error ? err.message : "Unknown error",
            messageCn: "请求失败",
            messageEn: "Request failed",
            messageJa: "リクエストが失敗しました",
            type: "REQUEST_ERROR",
          },
        };
      }

      setError(errorResponse);
      options?.onError?.(errorResponse);
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  // 更新背景图片上传函数，直接使用File对象
  const changeBackgroundWithImage = async (params: {
    imageUrl: string; // 原图URL
    backgroundFile: File; // 背景图片文件
    apiKey?: string;
    prompt?: string; // 可选的提示词
    aspect_ratio: "16:9" | "9:16";
  }) => {
    setIsLoadingImage(true);
    setError(null);
    setResult(null);

    try {
      // 如果没有提供apiKey，尝试从环境变量获取
      const apiKey = params.apiKey || process.env.NEXT_PUBLIC_302_API_KEY;

      if (!apiKey) {
        throw new Error("API key is required");
      }

      // 创建FormData对象
      const formData = new FormData();

      // 从URL获取原图数据
      const subjectResponse = await fetch(params.imageUrl);
      if (!subjectResponse.ok) {
        throw new Error("Failed to fetch subject image");
      }
      const subjectBlob = await subjectResponse.blob();

      // 添加表单字段
      formData.append("subject_image", subjectBlob);
      formData.append("background_image", params.backgroundFile);
      formData.append("aspect_ratio", params.aspect_ratio);
      // 添加提示词（如果有）
      if (params.prompt) {
        formData.append("prompt", params.prompt);
      } else {
        formData.append("prompt", "");
      }

      // 添加API密钥
      formData.append("apiKey", apiKey);

      // 调用API
      const response = await ky.post("/api/change-background-with-image", {
        body: formData,
        timeout: false, // 90秒超时
      });

      const data = (await response.json()) as BackgroundChangeResponse;
      setResult(data);
      options?.onSuccess?.(data);
      return data;
    } catch (err) {
      // 错误处理
      let errorResponse: BackgroundApiErrorResponse;

      // 处理ky的HTTP错误
      if (err && typeof err === "object" && "response" in err) {
        try {
          const kyError = err as any;
          const errorData =
            (await kyError.response.json()) as BackgroundApiErrorResponse;
          errorResponse = errorData;
        } catch {
          // 如果无法解析错误响应，使用默认错误
          errorResponse = {
            error: {
              errCode: 500,
              message: "Network error",
              messageCn: "网络错误",
              messageEn: "Network error",
              messageJa: "ネットワークエラー",
              type: "NETWORK_ERROR",
            },
          };
        }
      } else {
        errorResponse = {
          error: {
            errCode: 500,
            message: err instanceof Error ? err.message : "Unknown error",
            messageCn: "图片背景更换失败",
            messageEn: "Failed to change background with image",
            messageJa: "画像による背景の変更に失敗しました",
            type: "IMAGE_BACKGROUND_ERROR",
          },
        };
      }

      setError(errorResponse);
      options?.onError?.(errorResponse);
      return null;
    } finally {
      setIsLoadingImage(false);
    }
  };

  const reset = () => {
    setError(null);
    setResult(null);
  };

  return {
    changeBackground,
    changeBackgroundWithImage,
    isLoading,
    isLoadingImage,
    error,
    result,
    reset,
  };
}
