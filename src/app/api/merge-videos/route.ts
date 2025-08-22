import { APICallError } from "ai";
import { createScopedLogger } from "@/utils";
import ky from "ky";
import { NextResponse } from "next/server";
import { fonts } from "@/constants/fonts";
import { env } from "@/env";

const logger = createScopedLogger("create-video");

export async function POST(request: Request) {
  const {
    apiKey,
    videos,
    operation,
  }: {
    apiKey: string;
    videos: string[];
    operation: "audio_separation" | "video_merge";
  } = await request.json();

  try {
    const response = await ky.post(
      `${env.NEXT_PUBLIC_API_URL}/302/video/toolkit/submit`,
      {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        json: {
          video: videos,
          operation: operation,
        },
        timeout: false,
      }
    );
    const res: any = await response.json();

    return NextResponse.json(res);
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Failed to merge videos" },
      { status: 500 }
    );
  }
}
