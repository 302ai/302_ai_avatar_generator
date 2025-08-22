import { useEffect } from "react";
import { useAtom } from "jotai";
import ky from "ky";
import { env } from "@/env";
import { voiceStoreAtom } from "@/stores/slices/voice_store";
import { voices, VoiceOption } from "@/constants/voices";
import { appConfigAtom, store } from "@/stores";
import azureVoicesData from "@/data/azure_voices.json";

// Define types for the API response
interface VoiceInfo {
  voice: string;
  name: string;
  gender?: string;
  sample?: Record<string, string>;
  emotion?: string[];
  [key: string]: any;
}

// Azure voice data interface
interface AzureVoiceData {
  shortName: string;
  locale: string;
  properties: {
    Gender: string;
    DisplayName: string;
    LocalName: string;
    [key: string]: any;
  };
  samples: {
    styleSamples: Array<{
      styleName: string;
      audioFileEndpointWithSas: string;
    }>;
    [key: string]: any;
  };
  [key: string]: any;
}

interface ProviderInfo {
  provider: string;
  req_params_info: {
    voice_list: VoiceInfo[];
    [key: string]: any;
  };
  [key: string]: any;
}

interface ProviderResponse {
  provider_list: ProviderInfo[];
  [key: string]: any;
}

async function fetchTTSProviders(apiKey: string | undefined) {
  if (!apiKey) {
    console.warn("useTTSProviders: No API key provided");
    return;
  }

  try {
    const response = await ky.get(
      `${env.NEXT_PUBLIC_API_URL}/302/tts/provider`,
      {
        headers: { Authorization: `Bearer ${apiKey}` },
        timeout: false, // 30秒超时
        retry: 2, // 重试2次
      }
    );

    if (!response.ok) {
      throw new Error(`API调用失败: ${response.status}`);
    }

    const result = (await response.json()) as ProviderResponse;

    return result;
  } catch (err: any) {
    console.error("useTTSProviders: Error occurred:", err);

    // 更安全的错误处理
    try {
      if (err?.response) {
        const errorText = await err.response.text();
        console.error("useTTSProviders: Error response text:", errorText);

        if (errorText) {
          const errorData = JSON.parse(errorText);
          if (errorData?.error && errorData?.error?.err_code) {
            console.error(
              "useTTSProviders: API error code:",
              errorData.error.err_code
            );
            // toast.error(() => ErrorToast(errorData.error.err_code));
          }
        }
      } else if (err.name === "TimeoutError") {
        console.error("useTTSProviders: Request timeout");
        // toast.error("请求超时，请检查网络连接");
      } else {
        console.error("useTTSProviders: Network or other error:", err.message);
        // toast.error("获取供应商失败");
      }
    } catch (parseError) {
      console.error(
        "useTTSProviders: Error parsing error response:",
        parseError
      );
    }

    // 返回 null 而不是 undefined，更明确表示失败
    return null;
  }
}

function processDoubaoProvider(provider: ProviderInfo) {
  const doubaoVoiceList = provider.req_params_info.voice_list || [];
  const doubaoVoiceOptions = doubaoVoiceList.map((voice) => ({
    key: voice.voice,
    label: `${voice.name}`,
    value: voice.voice,
    originData: voice as any,
  }));

  const doubaoVoice = voices.find((v: any) => v.key === "Doubao");
  if (doubaoVoice) {
    doubaoVoice.children = doubaoVoiceOptions as VoiceOption[];
  }
}

function processFishProvider(provider: ProviderInfo) {
  const fishVoiceList = provider.req_params_info.voice_list || [];
  const fishVoiceOptions = fishVoiceList.map((voice) => ({
    key: voice.voice,
    label: voice.name || voice.voice,
    value: voice.voice,
    originData: voice as any,
  }));

  const fishVoice = voices.find((v: any) => v.key === "fish");
  if (fishVoice) {
    fishVoice.children = fishVoiceOptions as VoiceOption[];
  }
}

function processMinimaxProvider(provider: ProviderInfo) {
  const minimaxVoiceList = provider.req_params_info.voice_list || [];
  const minimaxVoiceOptions = minimaxVoiceList.map((voice: any) => ({
    key: voice.voice,
    label: `${voice.name} ${voice.gender ? `` : ""}`,
    value: voice.voice,
    originData: voice as any,
  }));

  const minimaxVoice = voices.find((v: any) => v.key === "Minimaxi");
  if (minimaxVoice) {
    minimaxVoice.children = minimaxVoiceOptions as VoiceOption[];
  }
}

function processOpenAiProvider(provider: ProviderInfo) {
  const openAiVoiceList = provider.req_params_info.voice_list || [];
  // 只保留指定的几个音色
  const allowedVoices = ["alloy", "echo", "fable", "onyx", "nova", "shimmer"];
  const filteredOpenAiVoiceList = openAiVoiceList.filter((voice: any) =>
    allowedVoices.includes(voice.voice.toLowerCase())
  );

  const openAiVoiceOptions = filteredOpenAiVoiceList.map((voice: any) => ({
    key: voice.voice,
    label: voice.gender
      ? `${voice.name.charAt(0).toUpperCase() + voice.name.slice(1)} ${
          voice.gender ? `()` : ""
        }`
      : voice.name.charAt(0).toUpperCase() + voice.name.slice(1),
    value: voice.voice,
    originData: voice as any,
  }));

  const openAiVoice = voices.find((v: any) => v.key === "OpenAI");
  if (openAiVoice) {
    openAiVoice.children = openAiVoiceOptions as VoiceOption[];
  }
}

function processElevenlabsProvider(provider: ProviderInfo) {
  const elevenlabsVoiceList = provider.req_params_info.voice_list || [];
  const elevenlabsVoiceOptions = elevenlabsVoiceList.map((voice: any) => ({
    key: voice.voice,
    label: voice.name || voice.voice,
    value: voice.voice,
    originData: voice as any,
  }));

  const elevenlabsVoice = voices.find((v: any) => v.key === "elevenlabs");
  if (elevenlabsVoice) {
    elevenlabsVoice.children = elevenlabsVoiceOptions as VoiceOption[];
  }
}

function processAzureProvider(locale?: string) {
  try {
    // 处理Azure voices数据
    const azureVoices = azureVoicesData as AzureVoiceData[];

    // 按语言代码分组
    const languageGroups: Record<string, AzureVoiceData[]> = {};

    azureVoices.forEach((voice) => {
      const langCode = voice.locale.split("-")[0].toLowerCase(); // 提取语言代码，如 'zh-CN' -> 'zh'

      if (!languageGroups[langCode]) {
        languageGroups[langCode] = [];
      }
      languageGroups[langCode].push(voice);
    });

    // 简单的语言名称映射
    const languageNames: Record<string, string> = {
      zh: "中文",
      en: "English",
      ja: "日本語",
      ko: "한국어",
      fr: "Français",
      de: "Deutsch",
      es: "Español",
      it: "Italiano",
      pt: "Português",
      ru: "Русский",
      ar: "العربية",
      hi: "हिन्दी",
      th: "ไทย",
      vi: "Tiếng Việt",
      nl: "Nederlands",
      pl: "Polski",
      tr: "Türkçe",
      sv: "Svenska",
      da: "Dansk",
      no: "Norsk",
      fi: "Suomi",
    };

    // 创建语言组选项（第一级下拉）
    const languageGroupOptions = Object.entries(languageGroups).map(
      ([langCode, voiceList]) => {
        // 为每个语言下的声音创建选项（第二级下拉）
        const voiceOptions = voiceList.map((voice) => {
          const sampleUrl =
            voice.samples?.styleSamples?.[0]?.audioFileEndpointWithSas || "";

          return {
            key: voice.shortName,
            label: `${voice.properties.DisplayName} (${voice.properties.LocalName})`,
            value: voice.shortName,
            originData: {
              ...voice,
              gender:
                voice.properties.Gender?.toLowerCase() === "neutral"
                  ? undefined
                  : voice.properties.Gender?.toLowerCase(), // Map properties.Gender to gender field, exclude neutral
              sample: sampleUrl ? { default: sampleUrl } : undefined,
            },
          };
        });

        return {
          key: langCode,
          label: languageNames[langCode] || langCode.toUpperCase(),
          value: langCode,
          children: voiceOptions,
        };
      }
    );

    // 对语言选项进行排序，将中文、英文、日语放在最前面
    const priorityLanguages = ["zh", "en", "ja"];
    const sortedLanguageGroupOptions = languageGroupOptions.sort((a, b) => {
      const aIndex = priorityLanguages.indexOf(a.key);
      const bIndex = priorityLanguages.indexOf(b.key);

      // 如果两个都是优先语言，按照优先级排序
      if (aIndex !== -1 && bIndex !== -1) {
        return aIndex - bIndex;
      }

      // 如果只有一个是优先语言，优先语言排在前面
      if (aIndex !== -1) return -1;
      if (bIndex !== -1) return 1;

      // 如果都不是优先语言，按标签字母排序
      return a.label.localeCompare(b.label);
    });

    // 如果指定了locale为"zh"，只返回中文声音
    const finalChildren =
      locale === "zh"
        ? sortedLanguageGroupOptions.filter((group) => group.key === "zh")
        : sortedLanguageGroupOptions;

    // 更新Azure平台的children
    const azureVoice = voices.find((v: any) => v.key === "Azure");
    if (azureVoice) {
      azureVoice.children = finalChildren;
    }
  } catch (error) {
    console.error("useTTSProviders: Error processing Azure voices:", error);
  }
}

export function useTTSProviders() {
  const [voiceStore, setVoiceStore] = useAtom(voiceStoreAtom);
  const { apiKey } = store.get(appConfigAtom);

  useEffect(() => {
    // 添加取消机制防止内存泄漏
    let isCancelled = false;

    const loadProviders = async () => {
      // 处理 Azure 数据 (静态数据，不依赖API)
      processAzureProvider();

      if (!apiKey) {
        // 即使没有API key，也更新voice store以包含Azure数据
        if (!isCancelled) {
          setVoiceStore((prev) => ({ ...prev, voiceList: voices }));
        }
        return;
      }

      try {
        const providerData = await fetchTTSProviders(apiKey);

        if (!providerData) {
          return;
        }

        const { provider_list } = providerData;

        // 处理 doubao 数据
        const doubaoProvider = provider_list.find(
          (p) => p.provider.toLowerCase() === "doubao"
        );
        if (doubaoProvider) {
          processDoubaoProvider(doubaoProvider);
        }

        // 处理 fish 数据
        const fishProvider = provider_list.find(
          (p) => p.provider.toLowerCase() === "fish"
        );
        if (fishProvider) {
          processFishProvider(fishProvider);
        }

        // 处理 minimax 数据
        const minimaxProvider = provider_list.find(
          (p) => p.provider.toLowerCase() === "minimaxi"
        );
        if (minimaxProvider) {
          processMinimaxProvider(minimaxProvider);
        }

        // 处理 openai 数据
        const openAiProvider = provider_list.find(
          (p) => p.provider.toLowerCase() === "openai"
        );
        if (openAiProvider) {
          processOpenAiProvider(openAiProvider);
        }

        // 处理 elevenlabs 数据
        const elevenlabsProvider = provider_list.find(
          (p) => p.provider.toLowerCase() === "elevenlabs"
        );
        if (elevenlabsProvider) {
          processElevenlabsProvider(elevenlabsProvider);
        }

        if (!isCancelled) {
          setVoiceStore((prev) => ({ ...prev, voiceList: voices }));
        }
      } catch (error) {
        if (!isCancelled) {
          // 即使API失败，也要确保Azure数据可用
          setVoiceStore((prev) => ({ ...prev, voiceList: voices }));
        }
      }
    };

    loadProviders();

    // 清理函数
    return () => {
      isCancelled = true;
    };
  }, [apiKey, setVoiceStore]);

  return {
    voiceList: voiceStore.voiceList,
    isLoading: !voiceStore.voiceList || voiceStore.voiceList.length === 0,
  };
}
