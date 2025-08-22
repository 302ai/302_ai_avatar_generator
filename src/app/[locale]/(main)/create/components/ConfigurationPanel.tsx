"use client";
import React, {
  useState,
  useRef,
  useCallback,
  useEffect,
  useMemo,
} from "react";

import { CustomSelect } from "@/components/ui/custom-select";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { appConfigAtom } from "@/stores";
import { useTranslations } from "next-intl";
import { VoiceOption, voices } from "@/constants/voices";
import { useAtom, useAtomValue } from "jotai";
import { voiceStoreAtom } from "@/stores/slices/voice_store";
import { CreateData } from "@/db/types";
import { useCustomVoiceDb } from "@/hooks/db/use-custom-voice";
import { useFavoriteVoice } from "@/hooks/db/use-favorite-voice";

type SubtitleConfig = NonNullable<CreateData["subtitleConfig"]>;

import { Play, Loader2, Square, X, Music, Languages } from "lucide-react";
import { toast } from "sonner";
import { createVideoStoreAtom } from "@/stores/slices/create_video";
import { genSpeech } from "@/services/gen-speech";
import ky from "ky";
import { uploadVideo } from "@/services/upload-video";
import SubtitleConfigModal from "./subtitle-config-modal";
import { createConfigAtom } from "@/stores/slices/create_config";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const ConfigurationPanel: React.FC<Omit<CreateData, "createdAt">> = ({
  id,
  platform,
  voice,
  // text,
}) => {
  const [voiceStore] = useAtom(voiceStoreAtom);
  const appConfig = useAtomValue(appConfigAtom);
  const { successVoices } = useCustomVoiceDb();
  const { favoriteVoices } = useFavoriteVoice();
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedText, setSelectedText] = useState("");
  const [localText, setLocalText] = useState(""); // 本地状态管理textarea值
  const [modalOpen, setModalOpen] = useState(false);
  const [uploadedAudio, setUploadedAudio] = useState<File | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [playingVoiceId, setPlayingVoiceId] = useState<string | null>(null); // 语音试听状态
  const [loadingVoiceId, setLoadingVoiceId] = useState<string | null>(null); // 语音试听loading状态
  const [isTranslating, setIsTranslating] = useState(false); // 翻译状态
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [createVideoStore, setCreateVideoStore] = useAtom(createVideoStoreAtom);
  const t = useTranslations();
  const [createConfig] = useAtom(createConfigAtom);
  const currentItem = createVideoStore.videoList.find((item) => item.id === id);
  const text = currentItem?.text || "";
  const mode = currentItem?.mode || "text";
  const googleModel = currentItem?.googleModel || "Gemini Flash";
  const azureLanguage = currentItem?.azureLanguage || "";

  // 默认字幕配置
  const defaultSubtitleConfig: SubtitleConfig = {
    show: false,
    font_size: 64,
    color: "#FFFFFF",
    stroke_color: "#000000",
    font_id: "55e7a4d323374b1686fc3330bbb00d0f", // MiSans 默认字体
    stroke_width: 7,
  };

  const [subtitleConfig, setSubtitleConfig] = useState<SubtitleConfig>(
    currentItem?.subtitleConfig || defaultSubtitleConfig
  );

  // 初始化本地状态
  useEffect(() => {
    setLocalText(text);
  }, [text]);

  // 同步字幕配置
  useEffect(() => {
    if (currentItem?.subtitleConfig) {
      setSubtitleConfig(currentItem.subtitleConfig);
    }
  }, [currentItem?.subtitleConfig]);

  // 防抖更新全局状态
  const updateGlobalText = useCallback(
    (newText: string) => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }

      debounceRef.current = setTimeout(() => {
        setCreateVideoStore((prevStore) => ({
          ...prevStore,
          videoList: prevStore.videoList.map((item) =>
            item.id === id ? { ...item, text: newText } : item
          ),
        }));
      }, 300); // 300ms防抖
    },
    [setCreateVideoStore, id]
  );

  // 清理防抖
  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, []);

  // 优化的平台更新函数
  const handlePlatformChange = useCallback(
    (value: string) => {
      setCreateVideoStore((prevStore) => ({
        ...prevStore,
        videoList: prevStore.videoList.map((item) =>
          item.id === id
            ? {
                ...item,
                platform: value,
                voice: "",
                azureLanguage: value === "Azure" ? "" : item.azureLanguage,
              }
            : item
        ),
      }));
    },
    [setCreateVideoStore, id]
  );

  // 优化的语音更新函数
  const handleVoiceChange = useCallback(
    (value: string) => {
      setCreateVideoStore((prevStore) => ({
        ...prevStore,
        videoList: prevStore.videoList.map((item) =>
          item.id === id ? { ...item, voice: value } : item
        ),
      }));
    },
    [setCreateVideoStore, id]
  );

  // Google模型更新函数
  const handleGoogleModelChange = useCallback(
    (value: "Gemini Flash" | "Gemini Pro") => {
      setCreateVideoStore((prevStore) => ({
        ...prevStore,
        videoList: prevStore.videoList.map((item) =>
          item.id === id ? { ...item, googleModel: value } : item
        ),
      }));
    },
    [setCreateVideoStore, id]
  );

  // Azure语言更新函数
  const handleAzureLanguageChange = useCallback(
    (value: string) => {
      setCreateVideoStore((prevStore) => ({
        ...prevStore,
        videoList: prevStore.videoList.map((item) =>
          item.id === id ? { ...item, azureLanguage: value, voice: "" } : item
        ),
      }));
    },
    [setCreateVideoStore, id]
  );

  // 获取指定音色的sample数据
  const getVoiceSample = useCallback((voice: VoiceOption) => {
    if (voice?.originData) {
      const originData = voice.originData as any;
      if (originData.sample) {
        // 获取sample中的第一个音频链接
        const sampleKeys = Object.keys(originData.sample);
        if (sampleKeys.length > 0) {
          return originData.sample[sampleKeys[0]];
        }
      }
    }
    return null;
  }, []);

  // 播放/停止语音示例
  const handlePlayVoiceSample = useCallback(
    async (e: React.MouseEvent, voice: VoiceOption) => {
      e.preventDefault();
      e.stopPropagation(); // 阻止选择项被触发

      const voiceId = `${platform}:${voice.value}`;

      // 如果正在播放相同的声音，则停止
      if (playingVoiceId === voiceId && audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
        setPlayingVoiceId(null);
        return;
      }

      // 停止当前播放的音频
      if (audioRef.current) {
        audioRef.current.pause();
      }

      // 特殊处理Google TTS
      if (platform === "google") {
        try {
          // 立即设置loading状态
          setLoadingVoiceId(voiceId);

          const previewText = `你好，我是${voice.value}，这是语音预览。`;

          const response = await fetch("/api/google-tts", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              text: previewText,
              apiKey: appConfig.apiKey!,
              platform: googleModel, // 使用googleModel而不是platform
              voice: voice.value,
            }),
          });

          const result = await response.json();

          if (!response.ok) {
            throw new Error(result.error?.message || "获取音频失败");
          }

          // 按照成功示例处理音频
          const audioUrl = result.audio_url;

          if (audioUrl) {
            // fetch音频数据并创建blob URL
            const audioResponse = await fetch(audioUrl);
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

              audioRef.current = audio;
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
      } else if (
        platform === "Azure" ||
        platform === "Doubao" ||
        platform === "fish"
      ) {
        // Azure、Doubao、Fish使用genSpeech接口
        try {
          // 立即设置loading状态
          setLoadingVoiceId(voiceId);

          const previewText = `你好，我是${voice.value}，这是语音预览。`;

          const res = await genSpeech({
            apiKey: appConfig.apiKey!,
            platform: (platform as any) === "google" ? googleModel : platform,
            voice: voice.value,
            text: previewText,
            googleModel:
              (platform as any) === "google" ? googleModel : undefined,
          });

          if (res?.audio_url) {
            const audio = new Audio(res.audio_url);
            audioRef.current = audio;

            audio.onplay = () => setPlayingVoiceId(voiceId);
            audio.onended = () => setPlayingVoiceId(null);
            audio.onerror = () => setPlayingVoiceId(null);

            await audio.play();
          } else {
            toast.error("获取音频失败");
          }
        } catch (error) {
          console.error(`${platform} TTS试听失败:`, error);
          toast.error("试听失败，请重试");
        } finally {
          // 清除loading状态
          setLoadingVoiceId(null);
        }
      } else {
        // 其他平台使用样本音频
        const sampleUrl = getVoiceSample(voice);
        if (!sampleUrl) return;

        const audio = new Audio(sampleUrl);
        audioRef.current = audio;

        audio.onplay = () => setPlayingVoiceId(voiceId);
        audio.onended = () => setPlayingVoiceId(null);
        audio.onerror = () => setPlayingVoiceId(null);

        audio.play().catch(console.error);
      }
    },
    [platform, getVoiceSample, playingVoiceId, appConfig.apiKey, googleModel]
  );

  // 更新字幕配置到store
  const updateSubtitleConfigInStore = useCallback(
    (newConfig: SubtitleConfig) => {
      setCreateVideoStore((prevStore) => ({
        ...prevStore,
        videoList: prevStore.videoList.map((item) =>
          item.id === id ? { ...item, subtitleConfig: newConfig } : item
        ),
      }));
    },
    [setCreateVideoStore, id]
  );

  // 获取当前选中平台的信息
  const selectedPlatform = voiceStore.voiceList.find(
    (group) => group.value === platform
  );

  // 检查当前选择的声音是否在当前平台中有效
  const isCurrentVoiceValid = useMemo(() => {
    if (platform === "favorites") {
      // 对于收藏声音，检查是否在 favoriteVoices 中
      return (
        favoriteVoices?.some(
          (favoriteVoice) => favoriteVoice.voiceValue === voice
        ) || false
      );
    }

    if (platform === "custom") {
      // 对于自定义声音，检查是否在 successVoices 中
      // 支持新旧两种格式：custom_{id} 和直接 audioId
      return (
        successVoices?.some(
          (customVoice) =>
            voice ===
              `custom_${customVoice.model_type}_${customVoice.audioId}` ||
            voice === customVoice.audioId
        ) || false
      );
    }

    if (platform === "Azure") {
      // 对于Azure，需要检查在选定的语言组中是否有效
      if (!azureLanguage || !selectedPlatform?.children) return false;

      const selectedLanguageGroup: any = selectedPlatform.children.find(
        (group: any) => group.value === azureLanguage
      );

      return (
        selectedLanguageGroup?.children?.some(
          (voiceOption: any) => voiceOption.value === voice
        ) || false
      );
    }

    // 检查是否是从收藏切换过来的音色（platform已经被更新为真实平台，但UI可能还没有同步）
    // 如果当前选择的voice在favoriteVoices中，说明可能是从收藏选择的
    const isFavoriteVoice = favoriteVoices?.some(
      (favoriteVoice) => favoriteVoice.voiceValue === voice
    );
    if (isFavoriteVoice) {
      // 找到对应的收藏音色，检查其在真实平台中是否有效
      const favoriteVoice = favoriteVoices?.find(
        (fav) => fav.voiceValue === voice
      );
      if (favoriteVoice) {
        const realPlatform = voiceStore.voiceList.find(
          (group) => group.value === favoriteVoice.groupKey
        );
        return (
          realPlatform?.children?.some(
            (voiceOption) => voiceOption.value === voice
          ) || false
        );
      }
    }

    return (
      selectedPlatform?.children.some(
        (voiceOption) => voiceOption.value === voice
      ) || false
    );
  }, [
    platform,
    voice,
    selectedPlatform,
    successVoices,
    azureLanguage,
    favoriteVoices,
    voiceStore.voiceList,
  ]);

  // 为语音选择准备选项
  const voiceSelectOptions = useMemo(() => {
    // 如果选择的是收藏平台，返回收藏声音选项
    if (platform === "favorites") {
      if (!favoriteVoices || favoriteVoices.length === 0) return [];

      return favoriteVoices.map((favoriteVoice) => {
        // 构建voiceId用于播放状态管理，需要匹配原始平台
        const voiceId = `${favoriteVoice.groupKey}:${favoriteVoice.voiceValue}`;

        // 根据原始平台查找voice option以获取sample
        const originalPlatform = voiceStore.voiceList.find(
          (group) => group.value === favoriteVoice.groupKey
        );
        const originalVoiceOption = originalPlatform?.children?.find(
          (voiceOption: VoiceOption) =>
            voiceOption.value === favoriteVoice.voiceValue
        );

        const hasSample = originalVoiceOption
          ? !!getVoiceSample(originalVoiceOption)
          : false;
        const isSpecialPlatform = [
          "google",
          "Azure",
          "Doubao",
          "fish",
        ].includes(favoriteVoice.groupKey);

        return {
          value: favoriteVoice.voiceValue,
          label: `${favoriteVoice.voiceName} (${favoriteVoice.groupKey})`,
          renderExtra:
            hasSample || isSpecialPlatform
              ? (isPlaying: boolean) => (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      if (originalVoiceOption) {
                        // 需要临时设置平台以匹配原始声音的平台
                        const originalPlatform = favoriteVoice.groupKey;
                        e.preventDefault();
                        e.stopPropagation();

                        // 创建临时的平台特定voiceId
                        const originalVoiceId = `${originalPlatform}:${favoriteVoice.voiceValue}`;

                        // 如果正在播放相同的声音，则停止
                        if (
                          playingVoiceId === originalVoiceId &&
                          audioRef.current
                        ) {
                          audioRef.current.pause();
                          audioRef.current.currentTime = 0;
                          setPlayingVoiceId(null);
                          return;
                        }

                        // 停止当前播放的音频
                        if (audioRef.current) {
                          audioRef.current.pause();
                        }

                        // 特殊处理Google TTS
                        if (originalPlatform === "google") {
                          (async () => {
                            try {
                              setLoadingVoiceId(originalVoiceId);
                              const previewText = `你好，我是${favoriteVoice.voiceName}，这是语音预览。`;
                              const response = await fetch("/api/google-tts", {
                                method: "POST",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({
                                  text: previewText,
                                  apiKey: appConfig.apiKey!,
                                  platform: googleModel,
                                  voice: favoriteVoice.voiceValue,
                                }),
                              });
                              const result = await response.json();
                              if (!response.ok)
                                throw new Error(
                                  result.error?.message || "获取音频失败"
                                );
                              const audioUrl = result.audio_url;
                              if (audioUrl) {
                                const audioResponse = await fetch(audioUrl);
                                const audioBlob = await audioResponse.blob();
                                if (audioBlob.size > 0) {
                                  const audioObjectUrl =
                                    URL.createObjectURL(audioBlob);
                                  const audio = new Audio(audioObjectUrl);
                                  audio.addEventListener("ended", () => {
                                    URL.revokeObjectURL(audioObjectUrl);
                                    setPlayingVoiceId(null);
                                  });
                                  audio.addEventListener("error", () => {
                                    URL.revokeObjectURL(audioObjectUrl);
                                    setPlayingVoiceId(null);
                                  });
                                  audioRef.current = audio;
                                  setPlayingVoiceId(originalVoiceId);
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
                              setLoadingVoiceId(null);
                            }
                          })();
                        } else if (
                          ["Azure", "Doubao", "fish"].includes(originalPlatform)
                        ) {
                          (async () => {
                            try {
                              setLoadingVoiceId(originalVoiceId);
                              const previewText = `你好，这是语音预览。`;
                              const res = await genSpeech({
                                apiKey: appConfig.apiKey!,
                                platform: originalPlatform,
                                voice: favoriteVoice.voiceValue,
                                text: previewText,
                              });
                              if (res?.audio_url) {
                                const audio = new Audio(res.audio_url);
                                audioRef.current = audio;
                                audio.onplay = () =>
                                  setPlayingVoiceId(originalVoiceId);
                                audio.onended = () => setPlayingVoiceId(null);
                                audio.onerror = () => setPlayingVoiceId(null);
                                await audio.play();
                              } else {
                                toast.error("获取音频失败");
                              }
                            } catch (error) {
                              console.error(
                                `${originalPlatform} TTS试听失败:`,
                                error
                              );
                              toast.error("试听失败，请重试");
                            } finally {
                              setLoadingVoiceId(null);
                            }
                          })();
                        } else {
                          // 其他平台使用样本音频
                          const sampleUrl = getVoiceSample(originalVoiceOption);
                          if (sampleUrl) {
                            const audio = new Audio(sampleUrl);
                            audioRef.current = audio;
                            audio.onplay = () =>
                              setPlayingVoiceId(originalVoiceId);
                            audio.onended = () => setPlayingVoiceId(null);
                            audio.onerror = () => setPlayingVoiceId(null);
                            audio.play().catch(console.error);
                          }
                        }
                      }
                    }}
                    className="h-6 w-6 p-0 hover:bg-gray-200"
                    disabled={loadingVoiceId === voiceId}
                  >
                    {loadingVoiceId === voiceId ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : playingVoiceId === voiceId ? (
                      <Square className="h-3 w-3" />
                    ) : (
                      <Play className="h-3 w-3" />
                    )}
                  </Button>
                )
              : undefined,
        };
      });
    }

    // 如果选择的是 custom 平台，返回自定义声音选项
    if (platform === "custom") {
      if (!successVoices || successVoices.length === 0) return [];

      return successVoices.map((customVoice) => ({
        value: `custom_${customVoice.model_type}_${customVoice.audioId}`,
        label: customVoice.name,
        renderExtra: customVoice.audioUrl
          ? (isPlaying: boolean) => (
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0 hover:bg-gray-200"
                onClick={async (e) => {
                  e.stopPropagation();

                  const voiceId = `custom:${customVoice.audioId}`;

                  // 如果正在播放相同的声音，则停止
                  if (playingVoiceId === voiceId && audioRef.current) {
                    audioRef.current.pause();
                    audioRef.current.currentTime = 0;
                    setPlayingVoiceId(null);
                    return;
                  }

                  // 停止其他正在播放的音频
                  if (audioRef.current) {
                    audioRef.current.pause();
                    audioRef.current.currentTime = 0;
                  }

                  // 检查是否为Fish Audio模型
                  const isFishAudio =
                    customVoice.cloneType === "fish_audio" ||
                    customVoice.model_type === "Fish Audio";

                  if (isFishAudio) {
                    // Fish Audio需要动态生成音频
                    try {
                      setLoadingVoiceId(voiceId);
                      const response = await ky
                        .post("/api/gen-fish-voice", {
                          json: {
                            text: "您好，这是声音预览测试。", // 默认预览文本
                            apiKey: appConfig.apiKey,
                            voice: customVoice.audioUrl, // 对于Fish Audio，audioUrl实际是voice ID
                            speed: 1.0,
                          },
                          timeout: 30000,
                        })
                        .json<{ audio_url: string }>();

                      // 播放生成的音频
                      const audio = new Audio(response.audio_url);
                      audioRef.current = audio;
                      audio.onplay = () => setPlayingVoiceId(voiceId);
                      audio.onended = () => setPlayingVoiceId(null);
                      audio.onerror = () => setPlayingVoiceId(null);
                      await audio.play();
                    } catch (error) {
                      console.error("Fish Audio生成失败:", error);
                      toast.error("音频生成失败，请重试");
                    } finally {
                      setLoadingVoiceId(null);
                    }
                  } else {
                    // 其他模型使用原有逻辑
                    const audio = new Audio(customVoice.audioUrl);
                    audioRef.current = audio;
                    audio.onplay = () => setPlayingVoiceId(voiceId);
                    audio.onended = () => setPlayingVoiceId(null);
                    audio.onerror = () => setPlayingVoiceId(null);
                    audio.play().catch(console.error);
                  }
                }}
                disabled={loadingVoiceId === `custom:${customVoice.audioId}`}
              >
                {loadingVoiceId === `custom:${customVoice.audioId}` ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : playingVoiceId === `custom:${customVoice.audioId}` ? (
                  <Square className="h-3 w-3" />
                ) : (
                  <Play className="h-3 w-3" />
                )}
              </Button>
            )
          : undefined,
      }));
    }

    // Azure平台的声音选项 - 需要先选择语言
    if (platform === "Azure") {
      if (!azureLanguage || !selectedPlatform?.children) return [];

      // 找到选中的语言组
      const selectedLanguageGroup: any = selectedPlatform.children.find(
        (group: any) => group.value === azureLanguage
      );

      if (!selectedLanguageGroup?.children) return [];

      return selectedLanguageGroup.children.map((voiceOption: VoiceOption) => {
        const voiceId = `${platform}:${voiceOption.value}`;

        // 为Azure音色显示LocalName
        const getAzureLabel = (voiceOption: VoiceOption) => {
          if (platform === "Azure" && voiceOption.originData) {
            const originData = voiceOption.originData as any;
            if (originData.properties && originData.properties.LocalName) {
              return originData.properties.LocalName;
            }
          }
          return voiceOption.label;
        };

        return {
          value: voiceOption.value,
          label: getAzureLabel(voiceOption),
          renderExtra: (isPlaying: boolean) => (
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => handlePlayVoiceSample(e, voiceOption)}
              className="h-6 w-6 p-0 hover:bg-gray-200"
              disabled={loadingVoiceId === voiceId}
            >
              {loadingVoiceId === voiceId ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : playingVoiceId === voiceId ? (
                <Square className="h-3 w-3" />
              ) : (
                <Play className="h-3 w-3" />
              )}
            </Button>
          ),
        };
      });
    }

    // 标准平台的声音选项
    if (!selectedPlatform?.children) return [];

    return selectedPlatform.children.map((voiceOption: VoiceOption) => {
      const voiceId = `${platform}:${voiceOption.value}`;
      const hasSample = !!getVoiceSample(voiceOption);
      const isGoogleTTS = platform === "google";

      return {
        value: voiceOption.value,
        label: voiceOption.label,
        renderExtra:
          hasSample || isGoogleTTS
            ? (isPlaying: boolean) => (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={(e) => handlePlayVoiceSample(e, voiceOption)}
                  className="h-6 w-6 p-0 hover:bg-gray-200"
                  disabled={loadingVoiceId === voiceId}
                >
                  {loadingVoiceId === voiceId ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : playingVoiceId === voiceId ? (
                    <Square className="h-3 w-3" />
                  ) : (
                    <Play className="h-3 w-3" />
                  )}
                </Button>
              )
            : undefined,
      };
    });
  }, [
    platform,
    selectedPlatform,
    successVoices,
    favoriteVoices,
    playingVoiceId,
    loadingVoiceId,
    getVoiceSample,
    handlePlayVoiceSample,
    azureLanguage,
    voiceStore.voiceList,
  ]);

  // 为平台选择准备选项
  const platformSelectOptions = useMemo(() => {
    const baseOptions = voiceStore.voiceList
      .filter((voiceGroup) => {
        // 如果是custom平台，只有在有自定义声音时才显示
        if (voiceGroup.value === "custom") {
          return successVoices && successVoices.length > 0;
        }
        return true;
      })
      .map((voiceGroup) => ({
        value: voiceGroup.value,
        label: voiceGroup.label,
      }));

    // 如果有收藏的声音，添加收藏选项
    if (favoriteVoices && favoriteVoices.length > 0) {
      return [
        { value: "favorites", label: t("voice.voiceClone.favorites") },
        ...baseOptions,
      ];
    }

    return baseOptions;
  }, [voiceStore.voiceList, successVoices, favoriteVoices]);

  // 处理文本选择
  const handleTextSelection = useCallback(() => {
    if (textareaRef.current) {
      const textarea = textareaRef.current;
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const selected = textarea.value.substring(start, end);
      setSelectedText(selected.trim());
    }
  }, []);

  // 播放音频
  const playAudio = async (audioUrl: string) => {
    try {
      // 停止当前播放的音频
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
      }

      // 创建新的音频对象
      const audio = new Audio(audioUrl);
      audioRef.current = audio;

      // 设置音频事件监听
      audio.onloadstart = () => setIsPlaying(true);
      audio.onended = () => setIsPlaying(false);
      audio.onerror = () => {
        setIsPlaying(false);
        toast.error("音频播放失败");
      };

      // 开始播放
      await audio.play();
    } catch (error) {
      console.error("播放音频失败:", error);
      setIsPlaying(false);
      toast.error("音频播放失败");
    }
  };

  // 停止播放
  const stopAudio = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      setIsPlaying(false);
    }
  };

  // 试听功能
  const handlePreview = async () => {
    if (!selectedText) {
      toast.error("请先选择要试听的文本");
      return;
    }

    if (!platform || !voice) {
      toast.error("请先选择语音平台和声音模型");
      return;
    }

    try {
      setIsLoading(true);

      // 所有平台都使用genSpeech接口
      const res = await genSpeech({
        apiKey: appConfig.apiKey!,
        platform: platform === "google" ? googleModel : platform,
        voice: voice,
        text: selectedText,
        googleModel: platform === "google" ? googleModel : undefined,
      });

      if (res?.audio_url) {
        await playAudio(res.audio_url);
      } else {
        toast.error("获取音频失败");
      }
    } catch (error) {
      console.error("试听失败:", error);
      toast.error("试听失败，请重试");
    } finally {
      setIsLoading(false);
    }
  };

  // 验证音频文件
  const validateAudioFile = (file: File): Promise<boolean> => {
    return new Promise((resolve) => {
      const audio = new Audio();
      const url = URL.createObjectURL(file);

      audio.onloadedmetadata = () => {
        const duration = audio.duration;
        URL.revokeObjectURL(url);

        if (duration < 5 || duration > 1800) {
          toast.error(
            `音频时长必须在5-1800秒之间，当前时长：${Math.round(duration)}秒`
          );
          resolve(false);
        } else {
          resolve(true);
        }
      };

      audio.onerror = () => {
        URL.revokeObjectURL(url);
        toast.error("无效的音频文件");
        resolve(false);
      };

      audio.src = url;
    });
  };

  // 处理音频文件上传
  const handleAudioUpload = async (file: File) => {
    const allowedTypes = [
      "audio/mp3",
      "audio/mpeg",
      "audio/wav",
      "audio/x-m4a",
      "audio/m4a",
    ];

    if (!allowedTypes.includes(file.type)) {
      toast.error("仅支持MP3、M4A、WAV格式的音频文件");
      return;
    }

    const isValid = await validateAudioFile(file);
    if (!isValid) return;

    try {
      setIsLoading(true);
      setUploadedAudio(file);

      // 调用上传接口
      const uploadResult = await uploadVideo({
        apiKey: appConfig.apiKey!,
        file,
      });

      // 更新到store中的audioFile和wavUrl字段
      setCreateVideoStore((prevStore) => ({
        ...prevStore,
        videoList: prevStore.videoList.map((item) =>
          item.id === id
            ? {
                ...item,
                audioFile: uploadResult.data || "", // 适配不同的返回字段名
                wavUrl: URL.createObjectURL(file), // 保留本地URL用于试听
              }
            : item
        ),
      }));

      // toast.success("音频上传成功");
    } catch (error) {
      console.error("音频上传失败:", error);
      toast.error("音频上传失败，请重试");
      setUploadedAudio(null);
    } finally {
      setIsLoading(false);
    }
  };

  // 文件拖拽处理
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);

    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      handleAudioUpload(files[0]);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  // 点击选择文件
  const handleFileSelect = () => {
    fileInputRef.current?.click();
  };

  // 删除已上传的音频
  const handleRemoveAudio = () => {
    setUploadedAudio(null);

    // 清空store中的wavUrl和audioFile
    setCreateVideoStore((prevStore) => ({
      ...prevStore,
      videoList: prevStore.videoList.map((item) =>
        item.id === id ? { ...item, wavUrl: "", audioFile: "" } : item
      ),
    }));
  };

  // 翻译文本
  const handleTranslate = async (targetLanguage: "ZH" | "EN" | "JA") => {
    if (!localText.trim()) {
      toast.error("请先输入要翻译的文本");
      return;
    }

    if (!appConfig.apiKey) {
      toast.error("请先配置API Key");
      return;
    }

    try {
      setIsTranslating(true);

      const response = await fetch("/api/translate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          language: targetLanguage,
          apiKey: appConfig.apiKey,
          message: localText.trim(),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error?.messageCn || data.error || "翻译失败");
      }

      if (data.translatedText) {
        // 更新本地文本状态
        setLocalText(data.translatedText);
        // 立即更新全局状态
        updateGlobalText(data.translatedText);
        // toast.success("翻译完成");
      } else {
        throw new Error("翻译结果为空");
      }
    } catch (error) {
      console.error("翻译失败:", error);
      toast.error(error instanceof Error ? error.message : "翻译失败，请重试");
    } finally {
      setIsTranslating(false);
    }
  };

  // 音频上传区域组件
  const AudioUploadArea = () => (
    <div className="flex-1 space-y-4">
      {!uploadedAudio ? (
        <div
          className={`cursor-pointer rounded-lg border-2 border-dashed p-8 text-center transition-colors ${
            isDragOver
              ? "border-primary bg-primary/5"
              : "border-gray-300 hover:border-primary/50 hover:bg-gray-50"
          } ${isLoading ? "pointer-events-none opacity-60" : ""}`}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onClick={handleFileSelect}
        >
          {isLoading ? (
            <>
              <Loader2 className="mx-auto mb-4 h-12 w-12 animate-spin text-primary" />
            </>
          ) : (
            <>
              <Music className="mx-auto mb-4 h-12 w-12 text-gray-400" />
              <div className="mb-2 font-medium text-gray-900">
                {t("create.uploadAudioPlaceholder")}
              </div>
              <div className="text-sm text-gray-500">
                {t("create.uploadAudioDescription")}
              </div>
            </>
          )}
        </div>
      ) : (
        <div className="rounded-lg border bg-gray-50 p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {/* 播放/停止图标替换音乐图标 */}
              <div className="flex h-8 w-8 items-center justify-center">
                {!isPlaying ? (
                  <button
                    className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-white transition-colors hover:bg-primary/90"
                    onClick={() => {
                      const audioUrl = URL.createObjectURL(uploadedAudio);
                      playAudio(audioUrl);
                    }}
                    disabled={isLoading}
                  >
                    {isLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Play className="h-4 w-4" />
                    )}
                  </button>
                ) : (
                  <button
                    className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-white transition-colors hover:bg-primary/90"
                    onClick={stopAudio}
                  >
                    <Square className="h-4 w-4" />
                  </button>
                )}
              </div>
              <div>
                <div className="font-medium text-gray-900">
                  {uploadedAudio.name}
                </div>
                <div className="text-sm text-gray-500">
                  {(uploadedAudio.size / 1024 / 1024).toFixed(2)} MB
                </div>
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleRemoveAudio}
              className="text-red-500 hover:bg-red-50 hover:text-red-700"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept=".mp3,.m4a,.wav"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleAudioUpload(file);
        }}
        className="hidden"
      />
    </div>
  );

  return (
    <div className="flex h-full flex-col gap-6">
      {/* 只在文本模式下显示语音选择 */}
      {mode === "text" && (
        <div className="flex flex-col gap-4 sm:flex-row">
          {/* 小下拉框 (30%宽度) - 语音平台选择 */}
          <div className="flex-none space-y-2 sm:w-[30%]">
            <CustomSelect
              value={platform}
              onValueChange={handlePlatformChange}
              placeholder={t("create.selectVoicePlatform")}
              options={platformSelectOptions}
            />
          </div>

          {/* Google TTS 模型选择 - 在平台和声音之间 */}
          {platform === "google" && (
            <div className="flex-none space-y-2 sm:w-[30%]">
              <CustomSelect
                value={googleModel}
                onValueChange={(value) =>
                  handleGoogleModelChange(
                    value as "Gemini Flash" | "Gemini Pro"
                  )
                }
                placeholder="选择Google模型"
                options={[
                  { value: "Gemini Flash", label: "Gemini Flash" },
                  { value: "Gemini Pro", label: "Gemini Pro" },
                ]}
              />
            </div>
          )}

          {/* Azure 语言选择 - 在平台和声音之间 */}
          {platform === "Azure" && (
            <div className="flex-none space-y-2 sm:w-[30%]">
              <CustomSelect
                value={azureLanguage}
                onValueChange={handleAzureLanguageChange}
                placeholder={t("avatar.pleaseSelectLanguage")}
                options={
                  selectedPlatform?.children?.map((group: any) => ({
                    value: group.value,
                    label: group.label,
                  })) || []
                }
              />
            </div>
          )}

          {/* 声音模型选择 - 根据是否为Google或Azure调整宽度 */}
          <div
            className={`flex-1 space-y-2 ${
              platform === "google" || platform === "Azure"
                ? "sm:w-[35%]"
                : "sm:w-[65%]"
            }`}
          >
            <CustomSelect
              value={isCurrentVoiceValid ? voice : ""}
              onValueChange={handleVoiceChange}
              placeholder={t("create.selectVoiceModel")}
              options={voiceSelectOptions}
              playingVoiceId={playingVoiceId}
              disabled={
                platform === "favorites"
                  ? !favoriteVoices?.length
                  : platform === "custom"
                    ? !successVoices?.length
                    : platform === "Azure"
                      ? !azureLanguage ||
                        !selectedPlatform ||
                        !selectedPlatform.children?.length
                      : !selectedPlatform || !selectedPlatform.children?.length
              }
            />
          </div>
        </div>
      )}

      {/* 根据模式显示不同内容 */}
      {mode === "text" ? (
        /* 文本驱动模式 - 原有的文本框 */
        <div className="flex-1 space-y-2">
          <div className="flex items-center justify-between"></div>
          <div className="relative">
            <Textarea
              ref={textareaRef}
              id="text-content"
              placeholder={t("create.createTextPlaceholder")}
              value={localText}
              onChange={(e) => {
                const newText = e.target.value;
                setLocalText(newText); // 立即更新本地状态
                updateGlobalText(newText); // 防抖更新全局状态
              }}
              onSelect={handleTextSelection}
              onMouseUp={handleTextSelection}
              onKeyUp={handleTextSelection}
              className="min-h-[120px] resize-y focus:border-transparent focus:ring-2 focus:ring-primary"
              rows={5}
            />
            {/* 翻译按钮 - 浮动在右下角 */}
            <div className="pointer-events-none absolute inset-0 flex items-end justify-end p-2">
              <div className="pointer-events-auto">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 border border-gray-200/50 p-0 shadow-sm backdrop-blur-sm hover:bg-gray-100/80"
                      disabled={isTranslating || !localText.trim()}
                    >
                      {isTranslating ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Languages className="h-4 w-4" />
                      )}
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem
                      onClick={() => handleTranslate("ZH")}
                      disabled={isTranslating}
                    >
                      {t("create.chinese")}
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => handleTranslate("EN")}
                      disabled={isTranslating}
                    >
                      {t("create.english")}
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => handleTranslate("JA")}
                      disabled={isTranslating}
                    >
                      {t("create.japanese")}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          </div>
          <div className="mt-3 flex flex-col gap-2">
            <div className="mt-1.5 flex justify-between gap-2">
              {!isPlaying ? (
                <Button
                  variant="outline"
                  size="sm"
                  className="flex items-center gap-2"
                  onClick={handlePreview}
                  disabled={!selectedText || isLoading || !platform || !voice}
                >
                  {isLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Play className="h-4 w-4" />
                  )}
                  {isLoading ? t("create.generating") : t("create.listen")}
                </Button>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  className="flex items-center gap-2"
                  onClick={stopAudio}
                >
                  <Square className="h-4 w-4" />
                </Button>
              )}
              {createConfig.createType === "chanjing" && (
                <div className="flex items-center gap-x-2">
                  <div className="flex items-center space-x-2">
                    <Switch
                      checked={subtitleConfig.show}
                      onCheckedChange={(checked) => {
                        const newConfig = { ...subtitleConfig, show: checked };
                        setSubtitleConfig(newConfig);
                        updateSubtitleConfigInStore(newConfig);
                      }}
                      id="switch-option"
                    />
                    <label
                      htmlFor="switch-option"
                      className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                    >
                      {t("create.showSubtitle")}
                    </label>
                  </div>
                  <Button
                    variant="link"
                    size="sm"
                    onClick={() => setModalOpen(true)}
                    disabled={!subtitleConfig.show}
                  >
                    {t("create.adjustSubtitle")}
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        /* 音频驱动模式 - 音频上传区域 */
        <AudioUploadArea />
      )}
      <SubtitleConfigModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        config={subtitleConfig}
        onConfigChange={(newConfig) => {
          setSubtitleConfig(newConfig);
          updateSubtitleConfigInStore(newConfig);
        }}
        avatarImage={currentItem?.avatarImage}
      />
    </div>
  );
};

export default React.memo(ConfigurationPanel);
