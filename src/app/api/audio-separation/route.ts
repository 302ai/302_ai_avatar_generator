import { APICallError } from "ai";
import { createScopedLogger } from "@/utils";
import ky from "ky";
import { NextResponse } from "next/server";
import { env } from "@/env";

const logger = createScopedLogger("audio-separation");

export async function POST(request: Request) {
  const {
    apiKey,
    videos,
  }: {
    apiKey: string;
    videos: string[];
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
          operation: "audio_separation",
        },
        timeout: false,
      }
    );
    const res: any = await response.json();

    return NextResponse.json(res);
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Failed to start audio separation" },
      { status: 500 }
    );
  }
}
