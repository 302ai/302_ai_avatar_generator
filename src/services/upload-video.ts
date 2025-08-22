import { ErrorToast } from "@/components/ui/errorToast";
import { languageAtom, store } from "@/stores";
import { langToCountry } from "@/utils/302";
import { emitter } from "@/utils/mitt";
import ky, { HTTPError } from "ky";
import { toast } from "sonner";

interface UploadVideoParams {
  apiKey: string;
  file: File;
}

interface UploadVideoResult {
  [key: string]: any;
}

export const uploadVideo = async ({ apiKey, file }: UploadVideoParams) => {
  try {
    const formData = new FormData();
    formData.append("apiKey", apiKey);
    formData.append("file", file);

    const res = await ky.post("/api/upload-video", {
      timeout: false,
      body: formData,
    });

    return res.json<UploadVideoResult>();
  } catch (error: any) {
    if (error.response) {
      console.log("error报错了！！！", error.response);
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
