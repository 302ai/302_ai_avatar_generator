import {
  APICallError,
  experimental_generateSpeech as generateSpeech,
} from "ai";
import { createAI302 } from "@302ai/ai-sdk";
import { createScopedLogger } from "@/utils";
import ky from "ky";
import { env } from "@/env";
import {
  AzureTTSSpeaker,
  DoubaoVoice,
  FishVoice,
  MinimaxVoice,
  DubbingxiVoice,
  ElevenlabsVoice,
} from "@/constants/voices";

const logger = createScopedLogger("gen-voice-to-voice");

export async function POST(request: Request) {
  try {
    // 接收FormData格式的请求
    const formData = await request.formData();

    // 从FormData中提取参数
    const apiKey = formData.get("apiKey") as string;
    const platform = formData.get("platform") as string;
    const voice = formData.get("voice") as string;
    const speed = parseFloat(formData.get("speed") as string);
    const file = formData.get("file") as File;

    if (!apiKey || !platform || !voice || !file || isNaN(speed)) {
      return Response.json(
        {
          error: {
            message: "缺少必要参数",
            message_cn: "缺少必要参数",
            message_en: "Missing required parameters",
            message_ja: "必要なパラメータがありません",
          },
        },
        { status: 400 }
      );
    }

    const newPlatform = platform.toLowerCase();

    // 创建新的FormData对象用于语音识别API
    const transcriptionFormData = new FormData();
    transcriptionFormData.append("file", file);
    transcriptionFormData.append("model", "whisper-1");
    transcriptionFormData.append("response_format", "json");
    transcriptionFormData.append("temperature", "0");

    // 使用FormData发送请求进行语音识别
    const transcriptionResponse = await ky
      .post(`${env.NEXT_PUBLIC_API_URL}/v1/audio/transcriptions`, {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          Accept: "application/json",
        },
        body: transcriptionFormData,
        timeout: 6000000,
      })
      .json<{ text: string }>();

    const text = transcriptionResponse.text;
    logger.info("识别到的文本", text);

    // 再根据文本生成语音
    const response = await ky.post(
      `${env.NEXT_PUBLIC_API_URL}/302/tts/generate`,
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        json: {
          provider: newPlatform,
          voice,
          speed,
          text,
          ...(newPlatform === "openai" && { model: "tts-1-hd" }),
        },
        timeout: 6000000,
      }
    );

    // 解析 JSON 响应
    const result = (await response.json()) as {
      audio_url: string;
      data: string;
    };

    // 返回音频 URL
    return Response.json({
      audio_url: result.audio_url,
      data: result.data || {},
      text, // 返回识别出的文本
    });
  } catch (error: unknown) {
    logger.error("Speech generation error");
    const errorMessage = error instanceof Error ? error.message : "未知错误";
    console.log(errorMessage, "错误信息");

    // 处理 API 调用错误
    if (error instanceof APICallError) {
      const resp = error.responseBody;
      return Response.json(resp, { status: 500 });
    }

    // 处理一般错误
    const errorCode = 500;

    // 检查是否有响应体
    if (error instanceof Error) {
      const resp = (error as any)?.responseBody;
      if (resp) {
        return Response.json(resp, { status: 500 });
      }
    }

    // 返回标准化错误响应
    return Response.json(
      {
        error: {
          err_code: errorCode,
          message: errorMessage,
          message_cn: "生成音频失败",
          message_en: "Failed to generate audio",
          message_ja: "音声生成に失敗しました",
          type: "AUDIO_GENERATION_ERROR",
        },
      },
      { status: errorCode }
    );
  }
}
