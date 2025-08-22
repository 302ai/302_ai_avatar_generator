import ky from "ky";

interface PollAudioSeparationRequest {
  apiKey: string;
  taskId: string;
}

interface AudioSeparationResult {
  audio_url: string;
  audio_file: {
    url: string;
    file_name: string;
    file_size: number;
    mime_type: string;
    prefix: string;
  };
  source_video: string;
  format: string;
  metadata: {
    file_size: number;
    mime_type: string;
  };
}

interface PollAudioSeparationResponse {
  task_id: string;
  status: "success" | "failed" | "timeout";
  data?: {
    id: string;
  };
  audio_path?: string;
  audio_url?: string;
  result?: AudioSeparationResult;
  err_msg?: string;
  attempts: number;
}

export async function pollAudioSeparation(
  request: PollAudioSeparationRequest
): Promise<PollAudioSeparationResponse> {
  const response = await ky.post("/api/poll-audio-separation", {
    json: request,
    timeout: false,
  });

  return response.json();
}
