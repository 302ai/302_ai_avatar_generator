import { createScopedLogger } from "@/utils";
import ky from "ky";
import { NextResponse } from "next/server";

const logger = createScopedLogger("create-stable-video");

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
          "Missing required parameters: apiKey, image_url, and audioUrl are required",
      },
      { status: 400 }
    );
  }

  try {
    const res = await ky.post(
      `${process.env.NEXT_PUBLIC_API_URL}/302/submit/latentsync`,
      {
        json: {
          video_url: videoUrl,
          audio_url: audioUrl,
        },
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
      }
    );

    const data: any = await res.json();
    const taskId = data.request_id;

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
