import { APICallError } from "ai";
import { createScopedLogger } from "@/utils";
import ky from "ky";
import { env } from "@/env";

const logger = createScopedLogger("create-video");

export async function POST(request: Request) {
  const data: {
    id: string;
    apiKey: string;
    videoUrl: string;
    name: string;
  } = await request.json();
  const { id, apiKey, videoUrl, name } = data;

  const results: {
    id: string;
    name: string;
    avatarId: string | null;
    preview_url: string | null;
    pic_url: string | null;
    error?: string;
  } = {
    id,
    name,
    avatarId: null,
    preview_url: null,
    pic_url: null,
    error: "",
  };

  try {
    const response = await ky.post<{
      code: number;
      data: string;
      msg: string;
      trace_id: string;
    }>("https://api.302.ai/chanjing/open/v1/create_customised_person", {
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      json: {
        name: "302test",
        material_video: videoUrl,
        callback: "",
        train_type: "figure",
      },
      timeout: false,
      throwHttpErrors: false,
    });

    const res: any = await response.json();

    // Check if the external API returned an error status
    if (!response.ok) {
      // If the response has an error object structure, return the entire error object wrapped in error field
      if (res.error) {
        return Response.json(
          { error: res.error },
          {
            status: response.status || 400,
          }
        );
      }

      // If the response has code structure (older API format)
      if (res.code && res.code !== 10000) {
        return Response.json(
          {
            error:
              res.msg || `Request failed with status code ${response.status}`,
          },
          {
            status: response.status || 400,
          }
        );
      }

      // Fallback error handling
      return Response.json(
        {
          error: `Request failed with status code ${response.status}`,
        },
        {
          status: response.status || 400,
        }
      );
    }

    let avatarId = res.data;

    if (avatarId) {
      let success = false;
      while (!success) {
        const statusResponse = await ky.get<{
          data: {
            status: number;
            pic_url: string;
            preview_url: string;
            progress: number;
            id: string;
          };
        }>(
          `https://api.302.ai/chanjing/open/v1/customised_person?id=${avatarId}`,
          {
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${apiKey}`,
            },
            timeout: false,
            throwHttpErrors: false,
          }
        );
        const statusRes = await statusResponse.json();

        // Check if status request failed
        if (!statusResponse.ok) {
          throw new Error(`Status check failed: ${statusResponse.status}`);
        }

        if (statusRes.data.status === 2) {
          success = true;
          avatarId = statusRes.data.id;
          results.preview_url = statusRes.data.preview_url;
          results.pic_url = statusRes.data.pic_url;
        }
        // 添加延迟避免过于频繁的请求
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }
      results.avatarId = avatarId;
    } else {
      // TODO: 旁边avatId是否为空
      results.error = "Failed to create avatar";
    }
  } catch (error) {
    console.error(`Error creating avatar for ${name}:`, error);
    results.error = error instanceof Error ? error.message : "Unknown error";
  }
  return Response.json({ results });
}
