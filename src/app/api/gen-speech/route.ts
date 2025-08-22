import { APICallError } from "ai";
import { createScopedLogger } from "@/utils";
import ky from "ky";
import {
  AzureTTSSpeaker,
  DoubaoVoice,
  DubbingxiVoice,
  ElevenlabsVoice,
  FishVoice,
  MinimaxVoice,
} from "@/constants/voices";
import { db } from "@/db";

const logger = createScopedLogger("gen-speech");

interface VoiceParseResult {
  platform: string;
  locale?: string;
  voiceName: string;
}

// Google TTS API 响应类型定义
interface GoogleTTSResponse {
  candidates: Array<{
    content: {
      parts: Array<{
        inlineData: {
          data: string;
          mimeType: string;
        };
      }>;
      role: string;
    };
    finishReason: string;
    index: number;
  }>;
  modelVersion: string;
  responseId: string;
  usageMetadata: {
    candidatesTokenCount: number;
    candidatesTokensDetails: Array<{
      modality: string;
      tokenCount: number;
    }>;
    promptTokenCount: number;
    promptTokensDetails: Array<{
      modality: string;
      tokenCount: number;
    }>;
    totalTokenCount: number;
  };
}

export async function POST(request: Request) {
  try {
    const {
      text,
      apiKey,
      platform,
      voice,
      speed,
      googleModel,
    }: {
      text: string;
      apiKey: string;
      platform: string;
      voice: string;
      speed: number;
      googleModel?: "Gemini Flash" | "Gemini Pro";
      speakerData?:
        | AzureTTSSpeaker
        | DoubaoVoice
        | FishVoice
        | MinimaxVoice
        | DubbingxiVoice
        | ElevenlabsVoice;
    } = await request.json();

    // 特殊处理Google平台
    if (
      platform.toLowerCase() === "google" ||
      platform === "Gemini Flash" ||
      platform === "Gemini Pro"
    ) {
      return await handleGoogleTTS(
        text,
        apiKey,
        voice,
        googleModel || (platform as "Gemini Flash" | "Gemini Pro")
      );
    }

    const newPlatform = platform.toLowerCase();

    try {
      const response = await ky.post(`https://api.302.ai/302/tts/generate`, {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          Accept: "application/json",
        },
        json: {
          text,
          provider: newPlatform,
          voice,
          speed,
          ...(newPlatform === "openai" && { model: "tts-1-hd" }),
          output_format: "mp3",
        },
        timeout: 6000000,
      });

      // 解析 JSON 响应
      const result = (await response.json()) as {
        audio_url: string;
        data: string;
      };

      // 返回音频 URL
      return Response.json({
        audio_url: result.audio_url,
        data: result.data || {},
      });
    } catch (apiError: any) {
      logger.error("API call failed:", apiError.message);

      // Check if error has response with error code for ErrorToast
      if (apiError.response) {
        try {
          const errorText = await apiError.response.text();
          const errorData = JSON.parse(errorText);
          if (errorData.error && errorData.error.err_code) {
            // If we have a structured error with err_code, return it directly
            return Response.json(errorData, {
              status: apiError.response.status || 500,
            });
          }
        } catch (parseError) {
          // If parsing fails, continue to default error handling
        }
      }

      throw apiError;
    }
  } catch (error: any) {
    // logger.error("Error in gen-style-reference-image:", error);
    // console.log(error, error.message);

    if (error instanceof APICallError) {
      const resp = error.responseBody;
      return Response.json(resp, { status: 500 });
    }

    // Handle different types of errors
    const errorMessage = "Failed to generate speech";
    const errorCode = 500;

    if (error instanceof Error) {
      // console.log("error", error);

      const resp = (error as any)?.responseBody as any;
      if (resp) {
        return Response.json(resp, { status: 500 });
      }
    }

    return Response.json(
      {
        error: {
          err_code: errorCode,
          message: errorMessage,
          message_cn: "生成语音失败",
          message_en: "Failed to generate speech",
          message_ja: "音声の生成に失敗しました",
          type: "SPEECH_GENERATION_ERROR",
        },
      },
      { status: errorCode }
    );
  }
}

async function handleGoogleTTS(
  text: string,
  apiKey: string,
  voice: string,
  googleModel?: "Gemini Flash" | "Gemini Pro"
): Promise<Response> {
  const modelType = googleModel || "Gemini Flash";

  if (modelType === "Gemini Flash") {
    try {
      const response = await ky.post(
        `https://api.302.ai/google/v1/models/gemini-2.5-flash-preview-tts`,
        {
          headers: {
            Authorization: `Bearer ${apiKey}`,
          },
          searchParams: {
            response_format: "url",
          },
          json: {
            contents: [
              {
                parts: [
                  {
                    text,
                  },
                ],
              },
            ],
            generationConfig: {
              responseModalities: ["AUDIO"],
              speechConfig: {
                voiceConfig: {
                  prebuiltVoiceConfig: {
                    voiceName: voice,
                  },
                },
              },
            },
            model: "gemini-2.5-flash-preview-tts",
          },
          timeout: false,
        }
      );

      // 解析 JSON 响应
      const result = (await response.json()) as GoogleTTSResponse;
      console.log("result", result);

      // 提取音频 URL
      const audioUrl =
        result.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;

      if (!audioUrl) {
        throw new Error("No audio URL found in response");
      }

      // 直接返回音频URL，让前端处理
      return Response.json({
        audio_url: audioUrl,
        data: result,
      });
    } catch (apiError: any) {
      logger.error("Google TTS Flash API call failed:", apiError.message);

      // Check if error has response with error code for ErrorToast
      if (apiError.response) {
        try {
          const errorText = await apiError.response.text();
          const errorData = JSON.parse(errorText);
          if (errorData.error && errorData.error.err_code) {
            // If we have a structured error with err_code, return it directly
            return Response.json(errorData, {
              status: apiError.response.status || 500,
            });
          }
        } catch (parseError) {
          // If parsing fails, continue to default error handling
        }
      }

      throw apiError;
    }
  } else {
    try {
      const response = await ky.post(
        `https://api.302.ai/google/v1/models/gemini-2.5-pro-preview-tts`,
        {
          headers: {
            Authorization: `Bearer ${apiKey}`,
          },
          searchParams: {
            response_format: "url",
          },
          json: {
            contents: [
              {
                parts: [
                  {
                    text,
                  },
                ],
              },
            ],
            generationConfig: {
              responseModalities: ["AUDIO"],
              speechConfig: {
                voiceConfig: {
                  prebuiltVoiceConfig: {
                    voiceName: voice,
                  },
                },
              },
            },
            model: "gemini-2.5-pro-preview-tts",
          },
          timeout: false,
        }
      );

      // 解析 JSON 响应
      const result = (await response.json()) as GoogleTTSResponse;
      console.log("result", result);

      // 提取音频 URL
      const audioUrl =
        result.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;

      if (!audioUrl) {
        throw new Error("No audio URL found in response");
      }

      // 直接返回音频URL，让前端处理
      return Response.json({
        audio_url: audioUrl,
        data: result,
      });
    } catch (apiError: any) {
      logger.error("Google TTS Pro API call failed:", apiError.message);

      // Check if error has response with error code for ErrorToast
      if (apiError.response) {
        try {
          const errorText = await apiError.response.text();
          const errorData = JSON.parse(errorText);
          if (errorData.error && errorData.error.err_code) {
            // If we have a structured error with err_code, return it directly
            return Response.json(errorData, {
              status: apiError.response.status || 500,
            });
          }
        } catch (parseError) {
          // If parsing fails, continue to default error handling
        }
      }

      throw apiError;
    }
  }
}
