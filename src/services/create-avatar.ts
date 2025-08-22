import ky, { HTTPError } from "ky";
import { emitter } from "@/utils/mitt";
import { store, languageAtom } from "@/stores";
import { langToCountry } from "@/utils/302";
import { ErrorToast } from "@/components/ui/errorToast";
import { toast } from "sonner";

interface CreateAvatarParams {
  apiKey: string;
  platform: string;
  voice: string;
  videoUrl: string;
  googleModel?: string;
}

interface CreateAvatarResult {
  results: {
    avatarId: string;
    preview_url: string;
    pic_url: string;
  };
}

export const createAvatar = async ({
  apiKey,
  platform,
  voice,
  videoUrl,
  googleModel,
}: CreateAvatarParams) => {
  try {
    const uiLanguage = store.get(languageAtom);

    const res = await ky.post("/api/create-avatar", {
      timeout: false,
      json: {
        platform,
        voice,
        videoUrl,
        apiKey,
        ...(googleModel && { googleModel }),
      },
    });

    const result: any = await res.json<CreateAvatarResult>();
    if (!result || !result.results || !result.results.avatarId) {
      console.error("Invalid avatar creation response:", result);
      throw new Error(result?.results?.error?.msg || "Avatar creation failed");
    }
    return result;
  } catch (error: any) {
    if (error instanceof HTTPError) {
      try {
        const errorText = await error.response.text();
        const errorData = JSON.parse(errorText);
        console.log("error", errorData);
        if (errorData.error && errorData.error.err_code) {
          toast.error(() => ErrorToast(errorData.error.err_code));
          throw error;
        }
      } catch (parseError) {
        // If parsing fails, continue to default error handling
      }
      throw error;
    }

    throw error; // Re-throw the error for the caller to handle if needed
  }
};
