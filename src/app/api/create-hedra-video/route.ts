import { APICallError } from "ai";
import { createScopedLogger } from "@/utils";
import ky from "ky";
import { NextResponse } from "next/server";
import { env } from "@/env";

const logger = createScopedLogger("create-video");

export async function POST(request: Request) {
  let text: string;
  let apiKey: string;
  let imageFile: File;
  let audioFile: File;
  let resolution: string;
  let originalPlatform: string;

  try {
    const formData = await request.formData();
    text = formData.get("text") as string;
    apiKey = formData.get("apiKey") as string;
    imageFile = formData.get("imageFile") as File;
    audioFile = formData.get("audioFile") as File;
    resolution = (formData.get("resolution") as string) || "720p";
    originalPlatform = (formData.get("originalPlatform") as string) || "hedra";

    // if (!text || !apiKey || !imageFile || !audioFile) {
    //   logger.error("Missing required fields in form data");
    //   return NextResponse.json(
    //     { error: "Missing required fields" },
    //     { status: 400 }
    //   );
    // }

    logger.info(
      `Received request - text: ${text}, imageFile: ${imageFile.name}, audioFile: ${audioFile.name}, resolution: ${resolution}, originalPlatform: ${originalPlatform}`
    );
  } catch (error) {
    logger.error(`Failed to parse form data: ${error}`);
    return NextResponse.json({ error: "Invalid form data" }, { status: 400 });
  }

  // 对于hedra类型，需要先资源创建
  logger.info(`Starting video creation process for text: ${text}`);
  logger.info(`API URL: ${env.NEXT_PUBLIC_API_URL}`);

  // 先创建image资源
  logger.info("Creating image asset...");
  const res = await ky.post(
    `${env.NEXT_PUBLIC_API_URL}/hedra/web-app/public/assets`,
    {
      json: {
        name: "string",
        type: "image",
      },
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
      timeout: false,
    }
  );

  let imageResId: any = await res.json();
  logger.info(`Image asset created with ID: ${imageResId.id}`);
  imageResId = imageResId.id;

  // 创建audio资源
  logger.info("Creating audio asset...");
  const audioRes = await ky.post(
    `${env.NEXT_PUBLIC_API_URL}/hedra/web-app/public/assets`,
    {
      json: {
        name: "string",
        type: "audio",
      },
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
      timeout: false,
    }
  );
  let audioResId: any = await audioRes.json();
  logger.info(`Audio asset created with ID: ${audioResId.id}`);
  audioResId = audioResId.id;

  // 图片资源上传
  logger.info("Uploading image asset...");

  // 将File转换为base64或直接使用FormData上传
  const imageFormData = new FormData();
  imageFormData.append("file", imageFile);

  const imageUploadRes = await ky.post(
    `${env.NEXT_PUBLIC_API_URL}/hedra/web-app/public/assets/${imageResId}/upload`,
    {
      body: imageFormData,
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
      timeout: false,
    }
  );

  const imageUploadData = await imageUploadRes.json();
  logger.info("Image asset uploaded successfully", imageUploadData);

  // 音频资源上传
  logger.info("Uploading audio asset...");

  const audioFormData = new FormData();
  audioFormData.append("file", audioFile);

  const audioUploadRes = await ky.post(
    `${env.NEXT_PUBLIC_API_URL}/hedra/web-app/public/assets/${audioResId}/upload`,
    {
      body: audioFormData,
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
      timeout: false,
    }
  );

  const audioUploadData = await audioUploadRes.json();
  logger.info("Audio asset uploaded successfully", audioUploadData);

  // 资源合并生成视频
  logger.info("Starting video generation...");
  const videoRes = await ky.post(
    `${env.NEXT_PUBLIC_API_URL}/hedra/web-app/public/generations`,
    {
      json: {
        type: "video",
        ai_model_id: "d1dd37a3-e39a-4854-a298-6510289f9cf2",
        start_keyframe_id: imageResId,
        audio_id: audioResId,
        generated_video_inputs: {
          text_prompt: text,
          resolution: resolution,
          aspect_ratio: "16:9",
          duration_ms: 5000,
        },
      },
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
      timeout: false,
    }
  );

  let videoResData: any;
  const videoResText = await videoRes.text();
  try {
    videoResData = JSON.parse(videoResText);
  } catch (error) {
    logger.error(
      `Failed to parse video generation response as JSON: ${videoResText}`
    );
    throw new Error(
      `Invalid JSON response from video generation API: ${videoResText}`
    );
  }

  logger.info(`Video generation started with ID: ${videoResData.id}`);

  return NextResponse.json({
    // 返回任务ID用于轮询
    taskId: videoResData.id,
    // 原始数据
    videoResData,
    // hedra特有数据用于重新生成
    hedra_data: {
      ai_model_id: videoResData.ai_model_id,
      audio_id: videoResData.audio_id,
      start_keyframe_id: videoResData.start_keyframe_id,
      image_url: (imageUploadData as any)?.url || null,
      audio_url: (audioUploadData as any)?.url || null,
      text_prompt: text,
    },
    // 标识类型
    type: "hedra",
    model: "hedra",
    platform: originalPlatform, // 使用原始平台信息而不是固定的"hedra"
  });
}
