import { APICallError } from "ai";
import { createScopedLogger } from "@/utils";
import ky from "ky";
import { env } from "@/env";

const logger = createScopedLogger("voice-clone");

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    // 从FormData中提取参数
    const apiKey = formData.get("apiKey") as string;
    const file = formData.get("file") as File;
    const name = formData.get("name") as string;
    const model_type = (formData.get("model_type") as string) || "cicada1.0";
    const text = (formData.get("text") as string) || "";

    // 第一步：直接上传音频文件到外部API获取URL
    const uploadFormData = new FormData();
    uploadFormData.append("file", file);

    let audioUrl: string;
    try {
      console.log("Uploading audio file to get URL...");
      const uploadResp = await ky
        .post(`${env.NEXT_PUBLIC_API_URL}/302/upload-file`, {
          headers: {
            Authorization: `Bearer ${apiKey}`,
          },
          body: uploadFormData,
          timeout: 120000,
        })
        .json<any>();

      console.log("Upload response:", JSON.stringify(uploadResp, null, 2));

      // 从响应中获取URL - data字段直接包含URL字符串
      audioUrl =
        uploadResp.data ||
        uploadResp.url ||
        uploadResp.file_url ||
        uploadResp.link;

      if (!audioUrl) {
        console.error("No URL found in upload response:", uploadResp);
        throw new Error("上传成功但未获取到文件URL");
      }

      console.log("File uploaded successfully, URL:", audioUrl);
    } catch (uploadError: any) {
      logger.error("File upload failed:", uploadError);
      throw new Error("音频文件上传失败");
    }

    // 第二步：调用声音定制API - url参数是声音的URL链接
    const customAudioData = {
      name,
      url: audioUrl, // 这是声音的URL链接（上传后获得的）
      model_type,
      text: text.length > 50 ? text.substring(0, 50) : text, // 限制文案长度
    };

    console.log("Calling create_customised_audio API with:", customAudioData);

    try {
      // 创建声音克隆任务
      console.log("Creating voice clone task...");
      const createResp = await ky
        .post(
          `${env.NEXT_PUBLIC_API_URL}/chanjing/open/v1/create_customised_audio`,
          {
            headers: {
              Authorization: `Bearer ${apiKey}`,
              "Content-Type": "application/json",
            },
            json: customAudioData,
            timeout: 120000,
          }
        )
        .json<{
          code: number;
          data: string; // 任务ID
          msg: string;
          trace_id: string;
        }>();

      console.log("Voice clone task created:", createResp);

      if (createResp.code !== 0) {
        throw new Error(`创建声音克隆任务失败: ${createResp.msg}`);
      }

      const taskId = createResp.data;

      // 返回任务创建结果，不进行轮询
      return Response.json({
        _id: taskId,
        title: name,
        type: model_type,
        visibility: "unlist",
        taskId: taskId,
        status: "pending",
        audio_path: null,
      });
    } catch (apiError: any) {
      logger.error("Voice clone API call failed:", apiError);

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
  } catch (error: unknown) {
    logger.error("Voice clone error");
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
          message_cn: "声音克隆失败",
          message_en: "Voice cloning failed",
          message_ja: "音声クローンに失敗しました",
          type: "VOICE_CLONING_ERROR",
        },
      },
      { status: errorCode }
    );
  }
}
