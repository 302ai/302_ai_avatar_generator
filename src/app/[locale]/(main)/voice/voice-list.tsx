"use client";
import { useAtom } from "jotai";
import { useState, useMemo, useEffect } from "react";
import { voiceStoreAtom } from "@/stores/slices/voice_store";
import { VoiceGroup, VoiceOption } from "@/constants/voices";
import {
  Volume2,
  Play,
  Pause,
  RotateCcw,
  Search,
  Star,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectValue,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";
import { useFavoriteVoice } from "@/hooks/db/use-favorite-voice";
// import { useAvatarDb } from "@/hooks/db/use-avatar-db";
import { useTranslations } from "next-intl";
import { useRouter, useParams } from "next/navigation";
import { createVideoStoreAtom } from "@/stores/slices/create_video";
import { openWelcomeModalAtom } from "@/stores/slices/welcome_modal";
import { appConfigAtom } from "@/stores";
import { genSpeech } from "@/services/gen-speech";
import { toast } from "sonner";
import { avatars } from "@/constants/avatars";

// 单独的声音项目组件，用于正确处理hooks
const VoiceItem = ({
  voiceItem,
  groupKey,
  playingVoiceId,
  loadingVoiceId,
  onPlayVoice,
}: {
  voiceItem: VoiceOption;
  groupKey: string;
  playingVoiceId: string | null;
  loadingVoiceId: string | null;
  onPlayVoice: (
    voiceId: string,
    audioUrl: string,
    groupKey: string,
    voiceValue: string
  ) => void;
}) => {
  const { toggleFavorite, useFavoriteStatus } = useFavoriteVoice();
  // const { avatarData } = useAvatarDb();
  const router = useRouter();
  const params = useParams();
  const [, setCreateVideoStore] = useAtom(createVideoStoreAtom);
  const [, openWelcomeModal] = useAtom(openWelcomeModalAtom);
  const t = useTranslations();
  // 获取收藏状态 - hooks必须在早期返回之前调用
  const isFavorited = useFavoriteStatus(voiceItem.key, voiceItem.value);

  if (!voiceItem.originData) return null;

  const { originData } = voiceItem;
  const voiceId = `${voiceItem.key}-${voiceItem.value}`;

  // 获取音频URL
  let audioUrl: string | undefined;

  // 检查Azure格式的samples
  if ("samples" in originData && originData.samples) {
    const samples = originData.samples as any;
    // 优先使用styleSamples中的general样本
    if (
      Array.isArray(samples.styleSamples) &&
      samples.styleSamples.length > 0
    ) {
      const generalSample = samples.styleSamples.find(
        (s: any) => s.styleName === "general"
      );
      audioUrl =
        generalSample?.audioFileEndpointWithSas ||
        samples.styleSamples[0]?.audioFileEndpointWithSas;
    }
    // 如果没有styleSamples，尝试使用languageSamples的第一个
    else if (
      Array.isArray(samples.languageSamples) &&
      samples.languageSamples.length > 0
    ) {
      audioUrl = samples.languageSamples[0]?.audioFileEndpointWithSas;
    }
  }
  // 非Azure格式（原有逻辑）
  else if ("sample" in originData && originData.sample) {
    if (Array.isArray(originData.sample)) {
      audioUrl = originData.sample[0];
    } else if (typeof originData.sample === "object") {
      // 如果sample是对象，取第一个值
      audioUrl = Object.values(originData.sample)[0];
    }
  }

  // 根据性别选择图片
  const getVoiceImage = () => {
    let gender = "";
    // Azure格式
    if (
      "properties" in originData &&
      originData.properties &&
      "Gender" in (originData.properties as any)
    ) {
      gender = (originData.properties as any).Gender.toLowerCase();
    }
    // 非Azure格式
    else if ("gender" in originData && originData.gender) {
      gender = originData.gender;
    }
    // OpenAI格式：硬编码gender映射（因为voiceStore中的数据不正确）
    else if (groupKey === "OpenAI") {
      const openAIGenderMap: Record<string, string> = {
        fable: "male",
        alloy: "female",
        echo: "male",
        nova: "female",
        shimmer: "female",
      };
      gender = openAIGenderMap[voiceItem.value] || "";
    }
    // Google格式：硬编码gender映射
    else if (groupKey === "google") {
      const googleGenderMap: Record<string, string> = {
        Zephyr: "female",
        Puck: "male",
        Charon: "male",
        Kore: "female",
        Fenrir: "male",
        Leda: "male",
        Aoede: "female",
        Callirhoe: "female",
        Aura: "male",
        Iapetus: "male",
        Umbriel: "male",
        Alma: "female",
        Erinome: "female",
        Algenib: "male",
        Rasalas: "female",
        Achernar: "female",
        Alnilam: "male",
        Sirius: "female",
        Pulcherrima: "male",
        Achird: "male",
        Zindematrix: "female",
        Sadachbia: "male",
        Sadaltagat: "female",
        Schedar: "male",
        Sulafat: "male",
        Benelgenubi: "male",
        Gacrux: "male",
        Altgethi: "male",
        Laomedon: "male",
        Cassiopia: "female",
        Despina: "female",
        Autonoe: "female",
        Enceladus: "female",
        Thorus: "male",
        Aaron: "male",
      };
      gender = googleGenderMap[voiceItem.value] || "";
    }

    if (gender === "female") {
      return "https://file.302.ai/gpt/imgs/20250723/compressed_46d00fbe6fb54a81bf860bb4f910e38e.jpeg";
    } else if (gender === "male") {
      return "https://file.302.ai/gpt/imgs/20250723/compressed_e479e8fa4af9488aa095c27cb078b462.jpeg";
    } else {
      // 默认使用原来的图片
      return "https://file.302.ai/gpt/imgs/20250723/compressed_066bd9011dda4583beba98f53417b7c1.jpeg";
    }
  };

  // 处理收藏切换
  const handleToggleFavorite = async () => {
    let voiceName = voiceItem.label;
    let voiceGender: string | undefined;

    // Azure格式
    if ("properties" in originData && originData.properties) {
      const props = originData.properties as any;
      if ("DisplayName" in props && props.DisplayName) {
        voiceName = props.DisplayName;
      }
      if ("Gender" in props && props.Gender) {
        voiceGender = props.Gender;
      }
    }
    // 非Azure格式
    else if ("name" in originData && originData.name) {
      voiceName = originData.name;
    }

    if ("gender" in originData && originData.gender) {
      voiceGender = originData.gender;
    }
    // OpenAI格式：硬编码gender映射（因为voiceStore中的数据不正确）
    else if (groupKey === "OpenAI") {
      const openAIGenderMap: Record<string, string> = {
        fable: "male",
        alloy: "female",
        echo: "male",
        nova: "female",
        shimmer: "female",
      };
      voiceGender = openAIGenderMap[voiceItem.value] || "";
    }
    // Google格式：硬编码gender映射
    else if (groupKey === "google") {
      const googleGenderMap: Record<string, string> = {
        Zephyr: "female",
        Puck: "male",
        Charon: "male",
        Kore: "female",
        Fenrir: "male",
        Leda: "male",
        Aoede: "female",
        Callirhoe: "female",
        Aura: "male",
        Iapetus: "male",
        Umbriel: "male",
        Alma: "female",
        Erinome: "female",
        Algenib: "male",
        Rasalas: "female",
        Achernar: "female",
        Alnilam: "male",
        Sirius: "female",
        Pulcherrima: "male",
        Achird: "male",
        Zindematrix: "female",
        Sadachbia: "male",
        Sadaltagat: "female",
        Schedar: "male",
        Sulafat: "male",
        Benelgenubi: "male",
        Gacrux: "male",
        Altgethi: "male",
        Laomedon: "male",
        Cassiopia: "female",
        Despina: "female",
        Autonoe: "female",
        Enceladus: "female",
        Thorus: "male",
        Aaron: "male",
      };
      voiceGender = googleGenderMap[voiceItem.value] || "";
    }

    await toggleFavorite(
      voiceItem.key,
      voiceItem.value,
      groupKey,
      voiceName,
      voiceGender
    );
  };

  // 处理去创作
  const handleGoToCreate = (voiceItem?: VoiceOption) => {
    let language = "";
    if (voiceItem) {
      const data = voiceItem.value.split("-");
      language = data[0];
      console.log("language", language);
    }
    // 获取第一个数字人的图片（仅当来源是声音库时使用）
    const getFirstAvatarImage = () => {
      if (avatars && avatars.length > 0) {
        const firstAvatar = avatars[0];
        if (
          Array.isArray(firstAvatar.imageUrl) &&
          firstAvatar.imageUrl.length > 0
        ) {
          return firstAvatar.imageUrl[0];
        } else if (typeof firstAvatar.imageUrl === "string") {
          return firstAvatar.imageUrl;
        }
      }
      return "";
    };

    const getFirstAvatarVideo = () => {
      if (avatars && avatars.length > 0) {
        const firstAvatar = avatars[0];
        if (Array.isArray(firstAvatar.video) && firstAvatar.video.length > 0) {
          return firstAvatar.video[0];
        } else if (typeof firstAvatar.video === "string") {
          return firstAvatar.video;
        }
      }
      return "";
    };

    const defaultAvatarImage = getFirstAvatarImage();
    const defaultAvatarVideo = getFirstAvatarVideo();
    // 更新create store，回填平台和音色信息

    setCreateVideoStore((prevStore) => ({
      ...prevStore,
      videoList: prevStore.videoList.map((item, index) =>
        index === 0
          ? {
              ...item,
              platform: groupKey,
              voice: voiceItem?.value || "",
              avatarImage: defaultAvatarImage, // 使用第一个数字人的图片作为默认
              videoUrl: defaultAvatarVideo, // 使用第一个数字人的视频作为默认
              azureLanguage: language,
            }
          : item
      ),
    }));

    // 打开welcome弹框，传递预设数据
    const presetData = {
      platform: groupKey,
      voice: voiceItem?.value || "",
      avatarImage: defaultAvatarImage, // 使用第一个数字人的图片作为默认
      source: "voice", // 标识来源为声音库,
      videoUrl: defaultAvatarVideo, // 使用第一个数字人的视频作为默认
      azureLanguage: language,
    };

    console.log(
      "🎯 Voice 去创作 clicked, opening welcome modal with preset data:",
      presetData
    );
    openWelcomeModal(presetData as any);
    console.log("📞 openWelcomeModal called with voice data");
  };

  return (
    <div
      key={voiceId}
      className="group relative flex min-h-[100px] flex-row items-center gap-3 rounded-lg border p-1.5 transition-shadow hover:shadow-sm"
    >
      {/* 左侧：声音图标（可点击播放） */}
      <button
        className="relative flex h-10 w-10 flex-shrink-0 items-center justify-center overflow-hidden rounded-full transition-all hover:scale-105 disabled:cursor-not-allowed disabled:opacity-50"
        onClick={() =>
          onPlayVoice(voiceId, audioUrl || "", groupKey, voiceItem.value)
        }
        disabled={
          loadingVoiceId === voiceId ||
          (!audioUrl &&
            groupKey !== "google" &&
            groupKey !== "OpenAI" &&
            groupKey !== "Azure" &&
            groupKey !== "Doubao" &&
            groupKey !== "fish")
        }
      >
        <img
          src={getVoiceImage()}
          alt="声音图标"
          className="h-full w-full object-cover"
        />
        {/* 播放状态覆盖层 - 悬浮时显示 */}
        <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-40 opacity-0 transition-opacity hover:opacity-100">
          {loadingVoiceId === voiceId ? (
            <Loader2 className="h-6 w-6 animate-spin text-white" />
          ) : audioUrl ||
            groupKey === "google" ||
            groupKey === "OpenAI" ||
            groupKey === "Azure" ||
            groupKey === "Doubao" ||
            groupKey === "fish" ? (
            playingVoiceId === voiceId ? (
              <Pause className="h-6 w-6 text-white" />
            ) : (
              <Play className="ml-0.5 h-6 w-6 text-white" />
            )
          ) : (
            <Volume2 className="h-6 w-6 text-white" />
          )}
        </div>
      </button>

      {/* 中间：声音信息 */}
      <div className="mr-4 min-w-0 max-w-none flex-1">
        <div className="truncate text-lg font-medium">
          {(() => {
            // Azure格式
            if (
              "properties" in originData &&
              originData.properties &&
              "DisplayName" in (originData.properties as any)
            ) {
              return (
                (originData.properties as any)?.LocalName || voiceItem.label
              );
            }
            // 非Azure格式
            if ("name" in originData && originData.name) {
              return originData.name;
            }
            return voiceItem.label;
          })()}
        </div>

        {/* 平台、语言、性别信息标签 */}
        <div className="mt-4 flex flex-wrap items-center gap-x-1 gap-y-1">
          {/* 平台标签 */}
          <span className="inline-flex flex-shrink-0 items-center whitespace-nowrap rounded bg-blue-100 px-1.5 py-0.5 text-xs font-medium text-blue-800">
            {groupKey}
          </span>

          {/* 性别标签 */}
          {(() => {
            let gender = "";
            // Azure格式
            if (
              "properties" in originData &&
              originData.properties &&
              "Gender" in (originData.properties as any)
            ) {
              gender = (originData.properties as any).Gender || "";
            }
            // 非Azure格式
            else if ("gender" in originData && originData.gender) {
              gender = originData.gender;
            }
            // OpenAI格式：硬编码gender映射（因为voiceStore中的数据不正确）
            else if (groupKey === "OpenAI") {
              const openAIGenderMap: Record<string, string> = {
                fable: "male",
                alloy: "female",
                echo: "male",
                nova: "female",
                shimmer: "female",
              };
              gender = openAIGenderMap[voiceItem.value] || "";
            }
            // Google格式：硬编码gender映射
            else if (groupKey === "google") {
              const googleGenderMap: Record<string, string> = {
                Zephyr: "female",
                Puck: "male",
                Charon: "male",
                Kore: "female",
                Fenrir: "male",
                Leda: "male",
                Aoede: "female",
                Callirhoe: "female",
                Aura: "male",
                Iapetus: "male",
                Umbriel: "male",
                Alma: "female",
                Erinome: "female",
                Algenib: "male",
                Rasalas: "female",
                Achernar: "female",
                Alnilam: "male",
                Sirius: "female",
                Pulcherrima: "male",
                Achird: "male",
                Zindematrix: "female",
                Sadachbia: "male",
                Sadaltagat: "female",
                Schedar: "male",
                Sulafat: "male",
                Benelgenubi: "male",
                Gacrux: "male",
                Altgethi: "male",
                Laomedon: "male",
                Cassiopia: "female",
                Despina: "female",
                Autonoe: "female",
                Enceladus: "female",
                Thorus: "male",
                Aaron: "male",
              };
              gender = googleGenderMap[voiceItem.value] || "";
            }
            return (
              gender && (
                <span
                  className={`inline-flex flex-shrink-0 items-center whitespace-nowrap rounded px-1.5 py-0.5 text-xs font-medium ${
                    gender.toLowerCase() === "female"
                      ? "bg-pink-100 text-pink-800"
                      : "bg-green-100 text-green-800"
                  }`}
                >
                  {gender.toLowerCase() === "female"
                    ? t("voice.voiceClone.female")
                    : t("voice.voiceClone.male")}
                </span>
              )
            );
          })()}

          {/* 语言标签 */}
          {(() => {
            let languages: string[] = [];
            let isMultiLanguage = false;

            // 检查Azure格式的多语言声音
            if ("samples" in originData && originData.samples) {
              const samples = originData.samples as any;
              if (
                Array.isArray(samples.languageSamples) &&
                samples.languageSamples.length > 0
              ) {
                // Azure多语言声音：从languageSamples提取语言
                languages = samples.languageSamples.map((sample: any) => {
                  const locale = sample.locale;
                  if (locale.startsWith("zh-")) return "zh";
                  if (locale.startsWith("en-")) return "en";
                  if (locale.startsWith("ja-")) return "ja";
                  return locale.split("-")[0];
                });
                // 去重
                languages = [...new Set(languages)];
                isMultiLanguage = languages.length >= 2;
              } else if (originData) {
                // 单语言声音：从locale推断语言
                const locale = (originData as any).locale;
                if (locale) {
                  if (locale.startsWith("zh-")) languages = ["zh"];
                  else if (locale.startsWith("en-")) languages = ["en"];
                  else if (locale.startsWith("ja-")) languages = ["ja"];
                  else languages = [locale.split("-")[0]];
                }
              }
            } else if ("sample" in originData && originData.sample) {
              // 非Azure格式（原有逻辑）
              if (
                typeof originData.sample === "object" &&
                !Array.isArray(originData.sample)
              ) {
                languages = Object.keys(originData.sample);
                isMultiLanguage = languages.length >= 2;
              }
            }

            // Google格式：所有Google声音都是多语言
            if (groupKey === "google") {
              languages = ["zh", "en"];
              isMultiLanguage = true;
            }

            if (isMultiLanguage) {
              return (
                <span className="inline-flex flex-shrink-0 items-center whitespace-nowrap rounded bg-purple-100 px-1.5 py-0.5 text-xs font-medium text-purple-800">
                  {t("voice.voiceClone.multiLanguage")}
                </span>
              );
            } else if (languages.length === 1) {
              const lang = languages[0];
              if (lang === "zh") {
                return (
                  <span className="inline-flex flex-shrink-0 items-center whitespace-nowrap rounded bg-gray-100 px-1.5 py-0.5 text-xs font-medium text-gray-800">
                    {t("voice.voiceClone.chinese")}
                  </span>
                );
              } else if (lang === "en") {
                return (
                  <span className="inline-flex flex-shrink-0 items-center whitespace-nowrap rounded bg-gray-100 px-1.5 py-0.5 text-xs font-medium text-gray-800">
                    {t("voice.voiceClone.english")}
                  </span>
                );
              } else {
                // 其他单语言都显示为多语言
                return (
                  <span className="inline-flex flex-shrink-0 items-center whitespace-nowrap rounded bg-purple-100 px-1.5 py-0.5 text-xs font-medium text-purple-800">
                    {t("voice.voiceClone.multiLanguage")}
                  </span>
                );
              }
            }
            return null;
          })()}
        </div>
      </div>

      {/* 右侧：收藏和去创作按钮 */}
      <div className="flex flex-shrink-0 items-center">
        {/* 收藏按钮 */}
        <button
          onClick={handleToggleFavorite}
          className="flex h-8 w-8 items-center justify-center transition-colors"
          title={isFavorited ? "取消收藏" : "添加到收藏"}
        >
          <Star
            className={`h-4 w-4 transition-colors ${
              isFavorited ? "fill-yellow-400 text-yellow-400" : "text-gray-400"
            }`}
          />
        </button>

        {/* 去创作按钮 */}
        <Button
          size="sm"
          variant="outline"
          className="h-8 px-3 text-xs"
          onClick={() => handleGoToCreate(voiceItem)}
        >
          {t("voice.voiceClone.goToCreate")}
        </Button>
      </div>

      {/* 隐藏的音频元素 */}
      {audioUrl && (
        <audio id={`voice-audio-${voiceId}`} preload="none" className="hidden">
          <source src={audioUrl} type="audio/mpeg" />
        </audio>
      )}
    </div>
  );
};

const VoiceList = () => {
  const [voiceStore] = useAtom(voiceStoreAtom);
  const [appConfig] = useAtom(appConfigAtom);
  const [playingVoiceId, setPlayingVoiceId] = useState<string | null>(null);
  const [loadingVoiceId, setLoadingVoiceId] = useState<string | null>(null);
  const t = useTranslations();

  // 过滤状态
  const [selectedPlatform, setSelectedPlatform] = useState<string>("all");
  const [selectedGender, setSelectedGender] = useState<string>("all");
  const [searchText, setSearchText] = useState<string>("");
  const [language, setLanguage] = useState<string>("all");

  // 分页状态
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize] = useState<number>(12); // 每页显示12个声音

  // 处理音频播放
  const handlePlayVoice = async (
    voiceId: string,
    audioUrl: string,
    groupKey: string,
    voiceValue: string
  ) => {
    if (playingVoiceId === voiceId) {
      // 如果正在播放同一个声音，则暂停
      const audio = document.getElementById(
        `voice-audio-${voiceId}`
      ) as HTMLAudioElement;
      audio?.pause();
      setPlayingVoiceId(null);
      return;
    }

    // 先暂停所有正在播放的音频
    if (playingVoiceId) {
      const currentAudio = document.getElementById(
        `voice-audio-${playingVoiceId}`
      ) as HTMLAudioElement;
      currentAudio?.pause();
    }

    // 特殊处理Google TTS
    if (groupKey === "google") {
      try {
        // 立即设置loading状态
        setLoadingVoiceId(voiceId);

        const previewText = `你好，我是${voiceValue}，这是语音预览。`;

        const response = await fetch("/api/google-tts", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            text: previewText,
            apiKey: appConfig.apiKey!,
            platform: "Gemini Flash", // 默认使用Gemini Flash
            voice: voiceValue,
          }),
        });

        const result = await response.json();

        if (!response.ok) {
          throw new Error(result.error?.message || "获取音频失败");
        }

        const resultAudioUrl = result.audio_url;

        if (resultAudioUrl) {
          // fetch音频数据并创建blob URL
          const audioResponse = await fetch(resultAudioUrl);
          const audioBlob = await audioResponse.blob();

          if (audioBlob.size > 0) {
            const audioObjectUrl = URL.createObjectURL(audioBlob);
            const audio = new Audio(audioObjectUrl);

            audio.addEventListener("ended", () => {
              URL.revokeObjectURL(audioObjectUrl);
              setPlayingVoiceId(null);
            });

            audio.addEventListener("error", () => {
              URL.revokeObjectURL(audioObjectUrl);
              setPlayingVoiceId(null);
            });

            setPlayingVoiceId(voiceId);
            await audio.play();
          } else {
            toast.error("获取音频失败");
          }
        } else {
          toast.error("获取音频失败");
        }
      } catch (error) {
        console.error("Google TTS试听失败:", error);
        toast.error("试听失败，请重试");
      } finally {
        // 清除loading状态
        setLoadingVoiceId(null);
      }
    } else if (groupKey === "OpenAI") {
      // OpenAI使用genSpeech接口
      try {
        // 立即设置loading状态
        setLoadingVoiceId(voiceId);

        const previewText = `你好，这是语音预览。`;

        const res = await genSpeech({
          apiKey: appConfig.apiKey!,
          platform: groupKey,
          voice: voiceValue,
          text: previewText,
        });

        if (res?.audio_url) {
          const audio = new Audio(res.audio_url);

          audio.onplay = () => setPlayingVoiceId(voiceId);
          audio.onended = () => setPlayingVoiceId(null);
          audio.onerror = () => setPlayingVoiceId(null);

          await audio.play();
        } else {
          toast.error("获取音频失败");
        }
      } catch (error) {
        console.error(`${groupKey} TTS试听失败:`, error);
        toast.error("试听失败，请重试");
      } finally {
        // 清除loading状态
        setLoadingVoiceId(null);
      }
    } else if (
      groupKey === "Azure" ||
      groupKey === "Doubao" ||
      groupKey === "fish"
    ) {
      // Azure、Doubao、Fish使用genSpeech接口
      try {
        // 立即设置loading状态
        setLoadingVoiceId(voiceId);

        const previewText = `你好，这是语音预览。`;

        const res = await genSpeech({
          apiKey: appConfig.apiKey!,
          platform: groupKey,
          voice: voiceValue,
          text: previewText,
        });

        if (res?.audio_url) {
          const audio = new Audio(res.audio_url);

          audio.onplay = () => setPlayingVoiceId(voiceId);
          audio.onended = () => setPlayingVoiceId(null);
          audio.onerror = () => setPlayingVoiceId(null);

          await audio.play();
        } else {
          toast.error("获取音频失败");
        }
      } catch (error) {
        console.error(`${groupKey} TTS试听失败:`, error);
        toast.error("试听失败，请重试");
      } finally {
        // 清除loading状态
        setLoadingVoiceId(null);
      }
    } else {
      // 其他平台使用样本音频
      if (!audioUrl) return;

      const audio = document.getElementById(
        `voice-audio-${voiceId}`
      ) as HTMLAudioElement;
      if (audio) {
        audio.play();
        setPlayingVoiceId(voiceId);

        // 监听播放结束事件
        audio.onended = () => {
          setPlayingVoiceId(null);
        };
      }
    }
  };

  // 获取所有声音项目（扁平化）
  const getAllVoiceItems = useMemo(() => {
    const voiceItems: Array<{
      voice: VoiceOption;
      groupKey: string;
      isMultiLanguage: boolean;
      languages: string[];
    }> = [];

    const processGroup = (group: VoiceGroup, parentKey?: string) => {
      group.children.forEach((child) => {
        if ("children" in child) {
          // 对于有children的子组，传递当前组的key作为parentKey
          processGroup(child, parentKey || group.key);
        } else {
          // 处理所有声音项目，包括有和没有originData的

          // 检测是否为多语言voice
          let isMultiLanguage = false;
          let languages: string[] = [];

          // 检查Azure格式的多语言声音
          if (
            child.originData &&
            "samples" in child.originData &&
            child.originData.samples
          ) {
            const samples = child.originData.samples as any;
            if (
              Array.isArray(samples.languageSamples) &&
              samples.languageSamples.length > 0
            ) {
              // Azure多语言声音：从languageSamples提取语言
              languages = samples.languageSamples.map((sample: any) => {
                const locale = sample.locale;
                if (locale.startsWith("zh-")) return "zh";
                if (locale.startsWith("en-")) return "en";
                if (locale.startsWith("ja-")) return "ja";
                return locale.split("-")[0];
              });
              // 去重
              languages = [...new Set(languages)];
              isMultiLanguage = languages.length > 1;
            } else if (child.originData) {
              // 单语言声音：从locale推断语言
              const locale = (child.originData as any).locale;
              if (locale) {
                if (locale.startsWith("zh-")) languages = ["zh"];
                else if (locale.startsWith("en-")) languages = ["en"];
                else if (locale.startsWith("ja-")) languages = ["ja"];
                else languages = [locale.split("-")[0]];
              }
            }
          } else if (
            child.originData &&
            "sample" in child.originData &&
            child.originData.sample
          ) {
            // 非Azure格式（原有逻辑）
            if (
              typeof child.originData.sample === "object" &&
              !Array.isArray(child.originData.sample)
            ) {
              languages = Object.keys(child.originData.sample);
              isMultiLanguage = languages.length > 1;
            }
          }

          // Google格式：所有Google声音都是多语言
          if ((parentKey || group.key) === "google") {
            languages = ["zh", "en"]; // 设置为支持中英文
            isMultiLanguage = true;
          }

          // 使用parentKey（如果存在），否则使用当前组的key
          voiceItems.push({
            voice: child,
            groupKey: parentKey || group.key,
            isMultiLanguage,
            languages,
          });
        }
      });
    };

    voiceStore.voiceList.forEach((group) => processGroup(group));
    return voiceItems;
  }, [voiceStore.voiceList]);

  // 获取所有可用的过滤选项
  const filterOptions = useMemo(() => {
    const platforms = new Set<string>();
    const genders = new Set<string>();
    const languages = new Set<string>();

    getAllVoiceItems.forEach(
      ({ voice, groupKey, isMultiLanguage, languages: voiceLanguages }) => {
        platforms.add(groupKey);

        const { originData } = voice;
        let gender = "";

        // Azure格式
        if (
          originData &&
          "properties" in originData &&
          originData.properties &&
          "Gender" in (originData.properties as any)
        ) {
          gender = (originData.properties as any).Gender.toLowerCase();
        }
        // 非Azure格式
        else if (originData && "gender" in originData && originData.gender) {
          gender = originData.gender;
        }
        // OpenAI格式：硬编码gender映射（因为voiceStore中的数据不正确）
        else if (groupKey === "OpenAI") {
          const openAIGenderMap: Record<string, string> = {
            fable: "male",
            alloy: "female",
            echo: "male",
            nova: "female",
            shimmer: "female",
          };
          gender = openAIGenderMap[voice.value] || "";
        }
        // Google格式：硬编码gender映射
        else if (groupKey === "google") {
          const googleGenderMap: Record<string, string> = {
            Zephyr: "female",
            Puck: "male",
            Charon: "male",
            Kore: "female",
            Fenrir: "male",
            Leda: "male",
            Aoede: "female",
            Callirhoe: "female",
            Aura: "male",
            Iapetus: "male",
            Umbriel: "male",
            Alma: "female",
            Erinome: "female",
            Algenib: "male",
            Rasalas: "female",
            Achernar: "female",
            Alnilam: "male",
            Sirius: "female",
            Pulcherrima: "male",
            Achird: "male",
            Zindematrix: "female",
            Sadachbia: "male",
            Sadaltagat: "female",
            Schedar: "male",
            Sulafat: "male",
            Benelgenubi: "male",
            Gacrux: "male",
            Altgethi: "male",
            Laomedon: "male",
            Cassiopia: "female",
            Despina: "female",
            Autonoe: "female",
            Enceladus: "female",
            Thorus: "male",
            Aaron: "male",
          };
          gender = googleGenderMap[voice.value] || "";
        }

        if (gender && gender !== "neutral") {
          genders.add(gender);
        }
        // 根据声音的语言支持情况添加语言选项
        if (isMultiLanguage) {
          languages.add("multi"); // 多语言
          voiceLanguages.forEach((lang) => languages.add(lang)); // 各个具体语言
        } else if (voiceLanguages.length === 1) {
          languages.add(voiceLanguages[0]); // 单语言
        } else if (originData && "Locale" in originData) {
          // 备用逻辑：从 Locale 字段获取
          languages.add((originData as any).Locale);
        }
      }
    );

    return {
      platforms: Array.from(platforms),
      genders: Array.from(genders),
      languages: Array.from(languages).sort(),
    };
  }, [getAllVoiceItems]);

  // 过滤声音选项
  const isVoiceFiltered = (
    voiceItem: VoiceOption,
    groupKey: string,
    isMultiLanguage: boolean,
    voiceLanguages: string[]
  ) => {
    // OpenAI声音可能没有originData，但仍需要过滤
    const { originData } = voiceItem;

    // 平台过滤
    if (selectedPlatform !== "all" && groupKey !== selectedPlatform) {
      return false;
    }

    // 性别过滤
    if (selectedGender !== "all") {
      let gender = "";

      // Azure格式
      if (
        originData &&
        "properties" in originData &&
        originData.properties &&
        "Gender" in (originData.properties as any)
      ) {
        gender = (originData.properties as any).Gender.toLowerCase();
      }
      // 非Azure格式
      else if (originData && "gender" in originData && originData.gender) {
        gender = originData.gender;
      }
      // OpenAI格式：硬编码gender映射（因为voiceStore中的数据不正确）
      else if (groupKey === "OpenAI") {
        const openAIGenderMap: Record<string, string> = {
          fable: "male",
          alloy: "female",
          echo: "male",
          nova: "female",
          shimmer: "female",
        };
        gender = openAIGenderMap[voiceItem.value] || "";
      }
      // Google格式：硬编码gender映射
      else if (groupKey === "google") {
        const googleGenderMap: Record<string, string> = {
          Zephyr: "female",
          Puck: "male",
          Charon: "male",
          Kore: "female",
          Fenrir: "male",
          Leda: "male",
          Aoede: "female",
          Callirhoe: "female",
          Aura: "male",
          Iapetus: "male",
          Umbriel: "male",
          Alma: "female",
          Erinome: "female",
          Algenib: "male",
          Rasalas: "female",
          Achernar: "female",
          Alnilam: "male",
          Sirius: "female",
          Pulcherrima: "male",
          Achird: "male",
          Zindematrix: "female",
          Sadachbia: "male",
          Sadaltagat: "female",
          Schedar: "male",
          Sulafat: "male",
          Benelgenubi: "male",
          Gacrux: "male",
          Altgethi: "male",
          Laomedon: "male",
          Cassiopia: "female",
          Despina: "female",
          Autonoe: "female",
          Enceladus: "female",
          Thorus: "male",
          Aaron: "male",
        };
        gender = googleGenderMap[voiceItem.value] || "";
      }

      if (gender !== selectedGender) {
        return false;
      }
    }

    // 语言过滤
    if (language !== "all") {
      if (language === "multi") {
        // 只显示真正的多语言声音（支持2种或以上语言）
        if (!isMultiLanguage || voiceLanguages.length < 2) {
          return false;
        }
      } else if (language === "zh") {
        // 只显示纯中文声音（排除多语言声音）
        if (isMultiLanguage) {
          return false; // 排除多语言声音
        }
        if (voiceLanguages.length === 1) {
          // 单语言声音：检查是否为中文
          if (voiceLanguages[0] !== "zh") {
            return false;
          }
        } else {
          // 备用逻辑：从 Locale 字段检查
          const locale =
            originData && "Locale" in originData
              ? (originData as any).Locale
              : "";
          if (
            !locale.toLowerCase().includes("zh") &&
            !locale.toLowerCase().includes("cn")
          ) {
            return false;
          }
        }
      } else if (language === "en") {
        // 只显示纯英文声音（排除多语言声音）
        if (isMultiLanguage) {
          return false; // 排除多语言声音
        }
        if (voiceLanguages.length === 1) {
          // 单语言声音：检查是否为英文
          if (voiceLanguages[0] !== "en") {
            return false;
          }
        } else {
          // 备用逻辑：从 Locale 字段检查
          const locale =
            originData && "Locale" in originData
              ? (originData as any).Locale
              : "";
          if (!locale.toLowerCase().includes("en")) {
            return false;
          }
        }
      }
    }

    // 搜索文本过滤
    if (searchText.trim()) {
      let name = voiceItem.label;
      // Azure格式
      if (
        originData &&
        "properties" in originData &&
        originData.properties &&
        "DisplayName" in (originData.properties as any)
      ) {
        name = (originData.properties as any).DisplayName || voiceItem.label;
      }
      // 非Azure格式
      else if (originData && "name" in originData && originData.name) {
        name = originData.name || voiceItem.label;
      }

      const searchLower = searchText.toLowerCase();
      if (!name.toLowerCase().includes(searchLower)) {
        return false;
      }
    }

    return true;
  };

  // 过滤后的声音列表
  const filteredVoices = useMemo(() => {
    return getAllVoiceItems.filter(
      ({ voice, groupKey, isMultiLanguage, languages: voiceLanguages }) =>
        isVoiceFiltered(voice, groupKey, isMultiLanguage, voiceLanguages)
    );
  }, [
    getAllVoiceItems,
    selectedPlatform,
    selectedGender,
    searchText,
    language,
  ]);

  // 分页相关计算
  const totalPages = Math.ceil(filteredVoices.length / pageSize);
  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = startIndex + pageSize;
  const currentPageVoices = filteredVoices.slice(startIndex, endIndex);

  // 当过滤条件改变时重置到第一页
  useEffect(() => {
    setCurrentPage(1);
  }, [selectedPlatform, selectedGender, language, searchText]);

  // 重置所有过滤器
  const resetFilters = () => {
    setSelectedPlatform("all");
    setSelectedGender("all");
    setLanguage("all");
    setSearchText("");
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold">{t("voice.voiceClone.voiceList")}</h2>
      </div>

      {/* 过滤器区域 */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        {/* 左侧：过滤器组 */}
        <div className="flex flex-wrap items-center gap-4">
          {/* 平台过滤 */}
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">
              {t("voice.voiceClone.platform")}:
            </span>
            <Select
              value={selectedPlatform}
              onValueChange={setSelectedPlatform}
            >
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("voice.voiceClone.all")}</SelectItem>
                {filterOptions.platforms.map((platform) => (
                  <SelectItem key={platform} value={platform}>
                    {platform.charAt(0).toUpperCase() + platform.slice(1)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* 语言过滤 */}
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">
              {t("voice.voiceClone.language")}:
            </span>
            <Select value={language} onValueChange={setLanguage}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("voice.voiceClone.all")}</SelectItem>
                <SelectItem value="zh">
                  {t("voice.voiceClone.chinese")}
                </SelectItem>
                <SelectItem value="en">
                  {t("voice.voiceClone.english")}
                </SelectItem>
                <SelectItem value="multi">
                  {t("voice.voiceClone.multiLanguage")}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* 性别过滤 */}
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">
              {t("voice.voiceClone.gender")}:
            </span>
            <Select value={selectedGender} onValueChange={setSelectedGender}>
              <SelectTrigger className="w-24">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("voice.voiceClone.all")}</SelectItem>
                {filterOptions.genders.map((gender) => (
                  <SelectItem key={gender} value={gender}>
                    {gender === "male"
                      ? t("voice.voiceClone.male")
                      : gender === "female"
                        ? t("voice.voiceClone.female")
                        : gender}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* 重置按钮 */}
          <Button
            variant="outline"
            size="sm"
            onClick={resetFilters}
            className="h-9"
          >
            <RotateCcw className="mr-1 h-4 w-4" />
            {t("voice.voiceClone.reset")}
          </Button>
        </div>

        {/* 右侧：搜索框 */}
        <div className="relative w-64">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder={t("voice.voiceClone.searchVoice")}
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      {/* 声音卡片网格 */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {currentPageVoices.map(({ voice, groupKey }) => (
          <>
            <VoiceItem
              key={`${voice.key}-${voice.value}`}
              voiceItem={voice}
              groupKey={groupKey}
              playingVoiceId={playingVoiceId}
              loadingVoiceId={loadingVoiceId}
              onPlayVoice={handlePlayVoice}
            />
          </>
        ))}
      </div>

      {/* 分页控件 */}
      {totalPages > 1 && (
        <div className="mt-8 flex items-center justify-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
            disabled={currentPage === 1}
          >
            {t("voice.voiceClone.previousPage")}
          </Button>

          <div className="flex items-center gap-1">
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => {
              // 显示当前页前后2页，以及首尾页
              const shouldShow =
                page === 1 ||
                page === totalPages ||
                (page >= currentPage - 2 && page <= currentPage + 2);

              if (!shouldShow) {
                // 显示省略号
                if (page === currentPage - 3 || page === currentPage + 3) {
                  return (
                    <span key={page} className="px-2 text-muted-foreground">
                      ...
                    </span>
                  );
                }
                return null;
              }

              return (
                <Button
                  key={page}
                  variant={currentPage === page ? "default" : "outline"}
                  size="sm"
                  onClick={() => setCurrentPage(page)}
                  className="min-w-[40px]"
                >
                  {page}
                </Button>
              );
            })}
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              setCurrentPage(Math.min(totalPages, currentPage + 1))
            }
            disabled={currentPage === totalPages}
          >
            {t("voice.voiceClone.nextPage")}
          </Button>
        </div>
      )}
    </div>
  );
};

export default VoiceList;
