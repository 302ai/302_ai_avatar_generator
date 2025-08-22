import { createScopedLogger } from "@/utils";
import ky from "ky";
import { NextResponse } from "next/server";

const logger = createScopedLogger("doubao-omnihuman-video");

export async function POST(request: Request) {
  const {
    image_url,
    audio_url,
    apiKey,
  }: { image_url: string; audio_url: string; apiKey: string } =
    await request.json();

  try {
    const response = await ky.post(
      "https://api.302.ai/doubao/omnihuman/video",
      {
        json: {
          image_url,
          audio_url,
        },
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        timeout: false,
      }
    );

    const res: any = await response.json();

    // Check if the external API returned an error
    if (res.code && res.code !== 10000) {
      return NextResponse.json(res, { status: 400 });
    }

    return NextResponse.json(res);
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Failed to create Omnihuman video" },
      { status: 500 }
    );
  }
}
