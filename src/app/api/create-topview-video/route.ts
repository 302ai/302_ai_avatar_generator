import { createScopedLogger } from "@/utils";
import ky from "ky";
import { NextResponse } from "next/server";

const logger = createScopedLogger("create-video");

export async function POST(request: Request) {
  const {
    apiKey,
    videoUrl,
    audioUrl,
  }: {
    videoUrl: string;
    audioUrl: string;
    apiKey: string;
  } = await request.json();

  if (!apiKey || !videoUrl || !audioUrl) {
    return NextResponse.json(
      {
        error:
          "Missing required parameters: apiKey, videoUrl, and audioUrl are required",
      },
      { status: 400 }
    );
  }

  try {
    // 先上传素材
    const videoRes = await ky.post(
      `${process.env.NEXT_PUBLIC_API_URL}/topview/upload`,
      {
        json: {
          file: videoUrl,
        },
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
      }
    );

    const audioRes = await ky.post(
      `${process.env.NEXT_PUBLIC_API_URL}/topview/upload`,
      {
        json: {
          file: audioUrl,
        },
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
      }
    );

    const [videoResData, audioResData] = await Promise.all([
      videoRes,
      audioRes,
    ]);

    const videoData: { fileId: string } = await videoResData.json();
    const audioData: { fileId: string } = await audioResData.json();
    const videoId = videoData.fileId;
    const audioId = audioData.fileId;

    const res = await ky.post(
      `${process.env.NEXT_PUBLIC_API_URL}/topview/v1/video_avatar/task/submit`,
      {
        json: {
          avatarSourceFrom: 0,
          audioSourceFrom: 0,
          audioFileId: audioId,
          videoFileId: videoId,
          isSave2CustomAiAvatar: true,
        },
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
      }
    );

    const data: any = await res.json();
    const taskId = data.result.taskId;

    return NextResponse.json({ taskId });
  } catch (error) {
    logger.error("Create topview video failed:", error);
    return NextResponse.json(
      {
        error: "Failed to create topview video",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
