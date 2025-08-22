import { APICallError } from "ai";
import { createScopedLogger } from "@/utils";
import ky from "ky";
import { NextResponse } from "next/server";
import { fonts } from "@/constants/fonts";

const logger = createScopedLogger("create-video");

export async function POST(request: Request) {
  const {
    personId,
    text,
    audioId,
    apiKey,
    wavUrl,
    driveMode,
    backway,
    subtitleConfig,
    type,
  }: {
    personId: string;
    text: string;
    audioId: string;
    apiKey: string;
    wavUrl: string;
    driveMode?: string;
    backway?: 1 | 2;
    subtitleConfig?: {
      show: boolean;
      font_size: number;
      color: string;
      stroke_color: string;
      font_id: string;
      stroke_width: number;
    };
    type: string;
  } = await request.json();

  try {
    const response = await ky.post(
      "https://api.302.ai/chanjing/open/v1/create_video",
      {
        json: {
          person: {
            id: personId,
            x: 0,
            y: 0,
            width: 1080,
            height: 1920,
            figure_type: "sit_body",
            drive_mode: driveMode || "",
            backway: backway || 2,
          },
          audio: {
            tts: {
              text: [text],
              speed: 1,
              audio_man: audioId,
            },
            wav_url: wavUrl,
            type: type,
            volume: 100,
            language: "cn",
          },
          bg_color: "#d92127",
          screen_width: 1080,
          screen_height: 1920,
          subtitle_config: {
            ...subtitleConfig,
            x: 31,
            y: 1521,
          },
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
    if (res.code && res.code !== 0) {
      return NextResponse.json(res, { status: res.code });
    }

    return NextResponse.json(res);
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Failed to create video" },
      { status: 500 }
    );
  }
}
