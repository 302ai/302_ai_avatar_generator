import ky from "ky";

interface AudioSeparationRequest {
  apiKey: string;
  videos: string[];
}

interface AudioSeparationResponse {
  task_id: string;
  status: string;
  message?: string;
}

export async function audioSeparation(
  request: AudioSeparationRequest
): Promise<AudioSeparationResponse> {
  const response = await ky.post("/api/audio-separation", {
    json: request,
    timeout: false,
  });

  return response.json();
}
