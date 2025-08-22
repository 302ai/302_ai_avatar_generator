import { APICallError, experimental_generateImage, generateText } from "ai";
import { createAI302 } from "@302ai/ai-sdk";
import { env } from "@/env";
import { createScopedLogger } from "@/utils";

const logger = createScopedLogger("chat");

export async function POST(request: Request) {
  try {
    const {
      image,
      apiKey,
      referenceType,
    }: {
      image: string;
      apiKey: string;
      referenceType: string;
    } = await request.json();

    const ai302 = createAI302({
      apiKey,
      baseURL: env.NEXT_PUBLIC_API_URL,
    });

    const { text } = await generateText({
      model: ai302.chatModel("gemini-2.5-pro"),
      messages: [
        {
          role: "system",
          content: `
          Please carefully analyze this image and provide detailed descriptions from the following two dimensions:
    
    ##Task requirements:
    1. * * Analysis of facial features * *: Focus on the facial features of individuals to generate consistent facial expressions in the future
    2. * * Theme Background Style Analysis * *: Describe the overall style, background environment, color matching, etc. of the image
    
    ##Output format:
    Please output strictly in the following format and do not add any other content:
    
    ###Character appearance characteristics:
    [Detailed facial features description of the main characters in the picture, including:
    -Age appearance (approximate age range)
    -Facial features (round face/square face/melon seed face/long face, etc.)
    -Eye features (eye size, shape, double eyelid condition, eye gaze characteristics)
    -Eyebrow features (intensity, shape, color)
    -Nasal features (height of nasal bridge, size of nasal wings, nasal shape)
    -Mouth features (lip thickness, mouth shape, corner of mouth characteristics)
    -Skin color characteristics
    -Hairstyle characteristics (color, length, texture, styling)
    -Mandibular line and overall facial contour
    
    ###Theme background style:
    A detailed description of the overall style and background of the image, including:
    -Description of shooting scene/background environment
    -Overall color tone and color scheme
    -Lighting conditions and atmosphere
    -Composition style and angle
    -Artistic style or visual characteristics
    -Emotional atmosphere and thematic feeling
    
    ##Attention:
    -The description of facial features should be detailed enough to ensure that it can be used to generate similar faces
    -Avoid describing variable factors such as clothing movements, and focus on fixed facial features
    -The theme background style should be described in sufficient detail to guide the subsequent stylized generation
    -Use accurate adjectives and avoid vague descriptions
    -If there are multiple characters in the picture, please select the most important or clear character for analysis
          `,
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `Reference type: ${referenceType}`,
            },
            {
              type: "image",
              image: image,
            },
          ],
        },
      ],
    });

    return Response.json({ result: text });
  } catch (error) {
    logger.error(error);
    if (error instanceof APICallError) {
      const resp = error.responseBody;

      return Response.json(resp, { status: 500 });
    }
    // Handle different types of errors
    let errorMessage = "Failed to generate chat";
    let errorCode = 500;

    if (error instanceof Error) {
      errorMessage = error.message;
      // You can add specific error code mapping here if needed
      if ("code" in error && typeof (error as any).code === "number") {
        errorCode = (error as any).code;
      }
    }

    return Response.json(
      {
        error: {
          err_code: errorCode,
          message: errorMessage,
          message_cn: "chat处理失败",
          message_en: "Failed to generate chat",
          message_ja: "chatの生成に失敗しました",
          type: "CHAT_ERROR",
        },
      },
      { status: errorCode }
    );
  }
}
