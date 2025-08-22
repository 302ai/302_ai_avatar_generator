import { APICallError, experimental_generateImage, generateText } from "ai";
import { createAI302 } from "@302ai/ai-sdk";
import { env } from "@/env";
import { createScopedLogger } from "@/utils";

const logger = createScopedLogger("chat");

export async function POST(request: Request) {
  try {
    const {
      prompt,
      apiKey,
    }: {
      prompt: string;
      apiKey: string;
    } = await request.json();

    const ai302 = createAI302({
      apiKey,
      baseURL: env.NEXT_PUBLIC_API_URL,
    });

    logger.info(`prompt: ${prompt}`);

    const { text } = await generateText({
      model: ai302.chatModel("gemini-2.5-pro"),
      system: `
  Please generate detailed English prompts for AI image generation based on the content I provide, and create high-quality half body figure images suitable for digital population broadcasting videos.

##Core requirements:
-Generate character descriptions based on basic information such as age (only "young", "middle-aged", and "elderly"), gender (only "male" and "female"), and region (only "any", "China", "Europe", "Africa", "South Asia", "East Asia", "Middle East", "South America", and "North America")
-Supports three reference modes, please handle accordingly based on the provided reference types
-Generate professional English image prompts, suitable for diffusion models such as Flux and Stable Diffusion

##Output content requirements:
The prompt words for output should include:
1. Basic characteristics of the character (age, gender, race, etc.)
2. Facial details description (facial features, expressions, etc.)
3. Upper body dress description (ensure appropriate attire)
4. Shooting angle and composition (must face the lens directly, with a maximum allowable micro angle of 5-10 degrees)
5. Lighting and background (neutral professional background is recommended)

##Reference processing rules:
-* * Reference Type: Character Appearance * * - Accurately integrate the provided facial features into the facial description to maintain consistency in facial features
-* * Reference type: Theme style * * - Incorporating corresponding background style and atmosphere elements while maintaining a professional oral broadcasting image
-* * Reference type: No reference * * - Independently generated based on basic information to create new character images

##Dress Code:
-When a user describes a character wearing outer clothing such as suits or jackets but does not mention the inner outfit, appropriate inner outfits (such as shirts, turtlenecks, etc.) will be automatically added
-When the clothing described by the user is already complete (such as camisole skirts, dresses, etc.), keep it as it is and do not add any innerwear

##Input format:
Age: {{Age}}
Gender: {{Gender}}
Region: {{Region}}
Reference type: {{Character appearance/Theme style/No reference}}
User prompt words: {{User's additional description requirements (can be empty)}
Reference content: {{If the reference type is "character appearance", fill in the character appearance characteristics obtained from prompt word 1 here; if the reference type is "theme style", fill in the theme background style obtained from prompt word 1 here; if the reference type is "no reference", leave blank
}}

##Output requirements:
-Only return optimized English prompt words, do not add any explanations or other content
-Avoid using introductory phrases such as' this image shows' and 'the scene scenes'
-Directly describe specific visual features
-Ensure concise and professional description, suitable for AI image generation
-Maintain a professional oral video style and avoid overly artistic or abstract descriptions

##Example:

###Input Example 1 (Reference Character Appearance):
Age: Youth
Gender: Male
Region: China
Reference type: Character appearance
User prompt: Wear a purple suit
Reference content: Young male, about 20-25 years old, melon seed face shape, fair skin, double eyelids, big eyes, deep gaze, thick black sword eyebrows, high nose bridge, thin lips, clear jawline, black short hair naturally parted

###Output Example 1:
Young Chinese male, 20-25 years old, oval face shape, fair skin, double-eyelid large eyes with deep gaze, thick black sword-shaped eyebrows, high nose bridge, thin lips, clear jawline, natural parted black short hair, wearing a purple business suit with crisp white dress shirt underneath, black silk tie, professional collar style, formal business attire, direct front-facing camera angle, soft studio lighting, neutral gray background, clean and professional appearance

###Input Example 2 (Reference Theme Style):
Age: Youth
Gender: Female
Region: Europe
Reference type: Theme style
User prompt: Wear black camisole skirt
Reference content: Warm coffee shop environment, soft yellow toned lighting, wooden background, relaxed atmosphere, natural light passing through windows

###Output Example 2:
Young European female, 20-25 years old, professional appearance, wearing elegant black spaghetti strap dress, direct front-facing pose in warm coffee shop environment, soft yellow-toned lighting, wooden background elements, relaxed atmosphere, natural window lighting, warm and approachable expression, upper body shot, cozy professional setting

###Input Example 3 (without reference):
Age: Middle aged
Gender: Female
Region: Any
Reference type: No reference
User prompt: Wear a black suit jacket

###Output Example 3:
Middle-aged professional woman, 35-45 years old, intelligent and sophisticated appearance, wearing black business blazer with white silk blouse underneath, confident expression, well-groomed appearance, direct front-facing professional headshot, soft studio lighting, clean neutral background, polished and authoritative presence
        `,
      prompt,
    });

    logger.info(`tex12312312312213123t: ${text}`);

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
