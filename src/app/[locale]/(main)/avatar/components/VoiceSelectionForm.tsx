"use client";

import React, {
  useMemo,
  useCallback,
  useState,
  useRef,
  useEffect,
} from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { CustomSelect } from "@/components/ui/custom-select";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { useAtom } from "jotai";
import { voiceStoreAtom } from "@/stores/slices/voice_store";
import { VoiceOption, voices } from "@/constants/voices";
import { useTranslations } from "next-intl";
import { useCustomVoiceDb } from "@/hooks/db/use-custom-voice";
import { useFavoriteVoice } from "@/hooks/db/use-favorite-voice";
import { Play, Square, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { appConfigAtom } from "@/stores";
import { genSpeech } from "@/services/gen-speech";

interface VoiceSelectionFormProps {
  voiceSelectionType: "library" | "clone" | null;
  onVoiceSelectionTypeChange: (type: "library" | "clone" | null) => void;
  selectedPlatform: string;
  onSelectedPlatformChange: (platform: string) => void;
  selectedVoice: string;
  onSelectedVoiceChange: (voice: string) => void;
  cloneInputText: string;
  onCloneInputTextChange: (text: string) => void;
  cloneModel: string;
  onCloneModelChange: (model: string) => void;
  googleModel?: string;
  onGoogleModelChange?: (model: string) => void;
  azureLanguage?: string;
  onAzureLanguageChange?: (language: string) => void;
}

export const VoiceSelectionForm: React.FC<VoiceSelectionFormProps> = ({
  voiceSelectionType,
  onVoiceSelectionTypeChange,
  selectedPlatform,
  onSelectedPlatformChange,
  selectedVoice,
  onSelectedVoiceChange,
  cloneInputText,
  onCloneInputTextChange,
  cloneModel,
  onCloneModelChange,
  googleModel = "Gemini Flash",
  onGoogleModelChange,
  azureLanguage = "",
  onAzureLanguageChange,
}) => {
  const [voiceStore] = useAtom(voiceStoreAtom);
  const [appConfig] = useAtom(appConfigAtom);
  const { successVoices } = useCustomVoiceDb();
  const { favoriteVoices } = useFavoriteVoice();
  const t = useTranslations();
  const [playingVoiceId, setPlayingVoiceId] = useState<string | null>(null);
  const [loadingVoiceId, setLoadingVoiceId] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const currentPlatform = voiceStore.voiceList.find(
    (group) => group.value === selectedPlatform
  );

  // 设置默认值
  useEffect(() => {
    // 只在初始状态为空时设置默认值
    if (!voiceSelectionType && !selectedPlatform && !selectedVoice) {
      onVoiceSelectionTypeChange("library");
      onSelectedPlatformChange("Doubao");
      onSelectedVoiceChange("zh_female_cancan_mars_bigtts");
    }
  }, [
    voiceSelectionType,
    selectedPlatform,
    selectedVoice,
    onVoiceSelectionTypeChange,
    onSelectedPlatformChange,
    onSelectedVoiceChange,
  ]);

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

      const voiceId = `${selectedPlatform}:${voice.value}`;

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
      if (selectedPlatform === "google") {
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
        selectedPlatform === "Azure" ||
        selectedPlatform === "Doubao" ||
        selectedPlatform === "fish"
      ) {
        // Azure、Doubao、Fish使用genSpeech接口
        try {
          // 立即设置loading状态
          setLoadingVoiceId(voiceId);

          const previewText = `你好，这是语音预览。`;

          const res = await genSpeech({
            apiKey: appConfig.apiKey!,
            platform: selectedPlatform,
            voice: voice.value,
            text: previewText,
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
          console.error(`${selectedPlatform} TTS试听失败:`, error);
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
    [
      selectedPlatform,
      getVoiceSample,
      playingVoiceId,
      appConfig.apiKey,
      googleModel,
    ]
  );

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

  // 为语音选择准备选项
  const voiceSelectOptions = useMemo(() => {
    // 如果选择的是 custom 平台，返回自定义声音选项
    if (selectedPlatform === "custom") {
      if (!successVoices || successVoices.length === 0) return [];

      return successVoices.map((customVoice) => ({
        value: `custom_${customVoice.id}`,
        label: customVoice.name,
        renderExtra: customVoice.audioUrl
          ? (isPlaying: boolean) => {
              const voiceId = `custom_${customVoice.id}`;
              return (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0 hover:bg-gray-200"
                  onClick={(e) => {
                    e.stopPropagation();
                    // 播放/停止自定义声音样本
                    const isFishAudio =
                      customVoice.cloneType === "fish_audio" ||
                      customVoice.model_type === "Fish Audio";

                    if (playingVoiceId === voiceId && audioRef.current) {
                      // 如果正在播放同一个声音，则停止
                      audioRef.current.pause();
                      audioRef.current.currentTime = 0;
                      setPlayingVoiceId(null);
                      return;
                    }

                    // 停止当前播放的音频
                    if (audioRef.current) {
                      audioRef.current.pause();
                      audioRef.current.currentTime = 0;
                    }

                    if (isFishAudio) {
                      // Fish Audio需要使用API生成音频
                      const playFishAudio = async () => {
                        setLoadingVoiceId(voiceId);
                        try {
                          const response = await fetch("/api/gen-fish-voice", {
                            method: "POST",
                            headers: {
                              "Content-Type": "application/json",
                            },
                            body: JSON.stringify({
                              text: "你好，这是语音预览。",
                              apiKey: appConfig.apiKey,
                              voice: customVoice.audioUrl, // 对于Fish Audio，audioUrl实际是voice ID
                              speed: 1.0,
                            }),
                          });

                          const result = await response.json();

                          if (!response.ok) {
                            throw new Error(
                              result.error?.message || "获取音频失败"
                            );
                          }

                          const audio = new Audio(result.audio_url);
                          audioRef.current = audio;
                          setPlayingVoiceId(voiceId);

                          audio.onended = () => {
                            setPlayingVoiceId(null);
                          };
                          audio.onerror = () => {
                            setPlayingVoiceId(null);
                          };

                          await audio.play();
                        } catch (error) {
                          console.error("Fish Audio试听失败:", error);
                          toast.error("试听失败，请重试");
                        } finally {
                          setLoadingVoiceId(null);
                        }
                      };

                      playFishAudio();
                    } else {
                      // 其他自定义声音直接播放
                      const audio = new Audio(customVoice.audioUrl);
                      audioRef.current = audio;
                      setPlayingVoiceId(voiceId);

                      audio.onended = () => {
                        setPlayingVoiceId(null);
                      };
                      audio.onerror = () => {
                        setPlayingVoiceId(null);
                      };

                      audio.play().catch(console.error);
                    }
                  }}
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
              );
            }
          : undefined,
      }));
    }

    // Azure平台的声音选项 - 需要先选择语言
    if (selectedPlatform === "Azure") {
      if (!azureLanguage || !currentPlatform?.children) return [];

      // 找到选中的语言组
      const selectedLanguageGroup: any = currentPlatform.children.find(
        (group: any) => group.value === azureLanguage
      );

      if (!selectedLanguageGroup?.children) return [];

      return selectedLanguageGroup.children.map((voiceOption: VoiceOption) => {
        const voiceId = `${selectedPlatform}:${voiceOption.value}`;
        const hasSample = !!getVoiceSample(voiceOption);
        const isSpecialPlatform = ["Azure", "Doubao", "fish"].includes(
          selectedPlatform
        );

        // 为Azure音色显示LocalName
        const getAzureLabel = (voiceOption: VoiceOption) => {
          if (selectedPlatform === "Azure" && voiceOption.originData) {
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
          renderExtra:
            hasSample || isSpecialPlatform
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
    }

    // 标准平台的声音选项
    if (!currentPlatform?.children) return [];

    return currentPlatform.children.map((voiceOption: VoiceOption) => {
      const voiceId = `${selectedPlatform}:${voiceOption.value}`;
      const hasSample = !!getVoiceSample(voiceOption);
      const isGoogleTTS = selectedPlatform === "google";
      const isSpecialPlatform =
        selectedPlatform === "Azure" ||
        selectedPlatform === "Doubao" ||
        selectedPlatform === "fish";

      return {
        value: voiceOption.value,
        label: voiceOption.label,
        renderExtra:
          hasSample || isGoogleTTS || isSpecialPlatform
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
    selectedPlatform,
    currentPlatform,
    successVoices,
    playingVoiceId,
    loadingVoiceId,
    getVoiceSample,
    handlePlayVoiceSample,
    azureLanguage,
  ]);

  return (
    <div className="space-y-4">
      <Label>{t("avatar.defaultVoice")}</Label>

      {/* 第一部分：从音色库里面选择 */}
      <div className="space-y-3">
        <div className="flex items-center space-x-2">
          <Checkbox
            id="voice-library"
            checked={voiceSelectionType === "library"}
            onCheckedChange={(checked) => {
              if (checked) {
                onVoiceSelectionTypeChange("library");
              } else {
                onVoiceSelectionTypeChange(null);
              }
            }}
          />
          <Label htmlFor="voice-library" className="text-sm font-medium">
            {t("avatar.selectVoiceFromLibrary")}
          </Label>
        </div>

        <div className="ml-6 mr-1 flex gap-2">
          <CustomSelect
            value={selectedPlatform}
            onValueChange={onSelectedPlatformChange}
            disabled={voiceSelectionType !== "library"}
            placeholder={t("avatar.selectPlatform")}
            options={platformSelectOptions}
            className="flex-1"
          />

          {/* Google TTS 模型选择 - 在平台和声音之间 */}
          {selectedPlatform === "google" && (
            <CustomSelect
              value={googleModel}
              onValueChange={onGoogleModelChange || (() => {})}
              disabled={voiceSelectionType !== "library"}
              placeholder="选择Google模型"
              options={[
                { value: "Gemini Flash", label: "Gemini Flash" },
                { value: "Gemini Pro", label: "Gemini Pro" },
              ]}
              className="flex-1"
            />
          )}

          {/* Azure 语言选择 - 在平台和声音之间 */}
          {selectedPlatform === "Azure" && (
            <CustomSelect
              value={azureLanguage}
              onValueChange={(value) => {
                if (onAzureLanguageChange) {
                  onAzureLanguageChange(value);
                }
              }}
              disabled={voiceSelectionType !== "library"}
              placeholder={t("avatar.pleaseSelectLanguage")}
              options={
                currentPlatform?.children?.map((group: any) => ({
                  value: group.value,
                  label: group.label,
                })) || []
              }
              className="flex-1"
            />
          )}

          <CustomSelect
            value={selectedVoice}
            onValueChange={onSelectedVoiceChange}
            disabled={
              voiceSelectionType !== "library" ||
              (selectedPlatform === "custom"
                ? !successVoices?.length
                : selectedPlatform === "Azure"
                  ? !azureLanguage ||
                    !currentPlatform ||
                    !currentPlatform.children?.length
                  : !currentPlatform || !currentPlatform.children?.length)
            }
            placeholder={t("avatar.selectVoice")}
            options={voiceSelectOptions}
            className="flex-1"
          />
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex items-center space-x-2">
          <Checkbox
            id="voice-clone"
            checked={voiceSelectionType === "clone"}
            onCheckedChange={(checked) => {
              if (checked) {
                onVoiceSelectionTypeChange("clone");
              } else {
                onVoiceSelectionTypeChange(null);
              }
            }}
          />
          <Label htmlFor="voice-clone" className="text-sm font-medium">
            {t("avatar.cloneAndUseVoice")}
          </Label>
        </div>

        <div className="ml-6 mr-1 space-y-2">
          <div className="flex gap-2">
            <div className="flex-1">
              <Label htmlFor="clone-input" className="text-sm text-gray-600">
                {t("avatar.cloneVoiceName")}
              </Label>
              <Input
                id="clone-input"
                placeholder={t("avatar.cloneVoiceNamePlaceholder")}
                value={cloneInputText}
                onChange={(e) => onCloneInputTextChange(e.target.value)}
                disabled={voiceSelectionType !== "clone"}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
