import { ErrorToast } from "@/components/ui/errorToast";
import { languageAtom, store } from "@/stores";
import { langToCountry } from "@/utils/302";
import { emitter } from "@/utils/mitt";
import ky, { HTTPError } from "ky";
import { toast } from "sonner";

interface GenerateSpeechParams {
  apiKey: string;
  platform: string;
  voice: string;
  text: string;
  googleModel?: "Gemini Flash" | "Gemini Pro"; // Google TTS模型选择
}

interface GenerateSpeechResult {
  audio_url: string;
}

export const genSpeech = async ({
  apiKey,
  platform,
  voice,
  text,
  googleModel,
}: GenerateSpeechParams) => {
  try {
    const res = await ky.post("/api/gen-speech", {
      timeout: 300000,
      json: {
        platform,
        voice,
        text,
        apiKey,
        googleModel,
      },
    });
    return res.json<GenerateSpeechResult>();
  } catch (error: any) {
    if (error.response) {
      try {
        const errorText = await error.response.text();
        const errorData = JSON.parse(errorText);
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
