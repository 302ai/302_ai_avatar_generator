"use client";

import React, { useState, useRef, useCallback, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { CustomSelect } from "@/components/ui/custom-select";
import { useAtom } from "jotai";
import { voiceStoreAtom } from "@/stores/slices/voice_store";
import { VoiceOption } from "@/constants/voices";
import { GeneratedImageData } from "@/stores/slices/gen_image_store";
import { useAvatarDb } from "@/hooks/db/use-avatar-db";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { Play, Square, Loader2 } from "lucide-react";
import { appConfigAtom } from "@/stores";
import { genSpeech } from "@/services/gen-speech";
import { useCustomVoiceDb } from "@/hooks/db/use-custom-voice";
import { useFavoriteVoice } from "@/hooks/db/use-favorite-voice";

interface CreateAvatarDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  imageData: GeneratedImageData | null;
}

export const CreateAvatarDialog: React.FC<CreateAvatarDialogProps> = ({
  open,
  onOpenChange,
  imageData,
}) => {
  const [avatarName, setAvatarName] = useState("");
  const [selectedPlatform, setSelectedPlatform] = useState("");
  const [selectedVoice, setSelectedVoice] = useState("");
  const [googleModel, setGoogleModel] = useState("Gemini Flash");
  const [azureLanguage, setAzureLanguage] = useState("");
  const [playingVoiceId, setPlayingVoiceId] = useState<string | null>(null);
  const [loadingVoiceId, setLoadingVoiceId] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const [voiceStore] = useAtom(voiceStoreAtom);
  const [appConfig] = useAtom(appConfigAtom);
  const { addAvatarData } = useAvatarDb();
  const { successVoices } = useCustomVoiceDb();
  const { favoriteVoices } = useFavoriteVoice();
  const t = useTranslations();

  const currentPlatform = voiceStore.voiceList.find(
    (group) => group.value === selectedPlatform
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

  const handleCreate = () => {
    if (!avatarName.trim()) {
      // alert("请输入数字人名称");
      toast.warning("请输入数字人名称");
      return;
    }

    if (!selectedPlatform || !selectedVoice) {
      toast.warning("请选择声音");
      return;
    }

    addAvatarData({
      id: crypto.randomUUID(),
      name: avatarName,
      pic_url: [imageData?.image_url || ""],
      avatar_id: imageData?.id || "",
      videoUrl: [],
      platform: selectedPlatform,
      voice: selectedVoice,
      createdAt: Date.now(),
      ...(selectedPlatform === "google" && { googleModel }),
      ...(selectedPlatform === "Azure" && { azureLanguage }),
    });

    // toast.success("创建成功");

    // 创建成功后关闭弹框并重置表单
    setAvatarName("");
    setSelectedPlatform("");
    setSelectedVoice("");
    setGoogleModel("Gemini Flash");
    setAzureLanguage("");
    onOpenChange(false);
    toast.success(t("avatar.createSuccess"));
  };

  const handleCancel = () => {
    // 重置表单
    setAvatarName("");
    setSelectedPlatform("");
    setSelectedVoice("");
    setGoogleModel("Gemini Flash");
    setAzureLanguage("");
    onOpenChange(false);
  };

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
        { value: "favorites", label: t("avatar.myFavorite") },
        ...baseOptions,
      ];
    }

    return baseOptions;
  }, [voiceStore.voiceList, successVoices, favoriteVoices]);

  // 为语音选择准备选项
  const voiceSelectOptions = useMemo(() => {
    // 如果选择的是收藏平台，返回收藏声音选项
    if (selectedPlatform === "favorites") {
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
                        handlePlayVoiceSample(e, originalVoiceOption);
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
    favoriteVoices,
    voiceStore.voiceList,
    playingVoiceId,
    loadingVoiceId,
    getVoiceSample,
    handlePlayVoiceSample,
    azureLanguage,
  ]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t("avatar.createAvatar")}</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* 图片展示 */}
          {imageData && (
            <div className="flex justify-center">
              <div className="relative overflow-hidden rounded-lg border">
                <img
                  src={imageData.image_url}
                  alt="选择的图片"
                  className="h-64 w-auto object-cover"
                />
              </div>
            </div>
          )}

          {/* 名称输入 */}
          <div className="space-y-2">
            <Label htmlFor="avatar-name">{t("avatar.avatarName")}</Label>
            <Input
              id="avatar-name"
              placeholder={t("avatar.avatarNamePlaceholder")}
              value={avatarName}
              onChange={(e) => setAvatarName(e.target.value)}
            />
          </div>

          {/* 声音选择 */}
          <div className="space-y-4">
            <Label>{t("avatar.voiceSelect")}</Label>
            <div className="flex gap-2">
              <CustomSelect
                value={selectedPlatform}
                onValueChange={(value) => {
                  setSelectedPlatform(value);
                  setSelectedVoice(""); // 重置声音选择
                  setAzureLanguage(""); // 重置Azure语言选择
                }}
                placeholder={t("avatar.selectPlatform")}
                options={platformSelectOptions}
                className="flex-1"
              />

              {/* Google TTS 模型选择 */}
              {selectedPlatform === "google" && (
                <CustomSelect
                  value={googleModel}
                  onValueChange={setGoogleModel}
                  placeholder="选择Google模型"
                  options={[
                    { value: "Gemini Flash", label: "Gemini Flash" },
                    { value: "Gemini Pro", label: "Gemini Pro" },
                  ]}
                  className="flex-1"
                />
              )}

              {/* Azure 语言选择 */}
              {selectedPlatform === "Azure" && (
                <CustomSelect
                  value={azureLanguage}
                  onValueChange={(value) => {
                    setAzureLanguage(value);
                    setSelectedVoice(""); // 重置音色选择
                  }}
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
                onValueChange={setSelectedVoice}
                placeholder={t("avatar.selectVoice")}
                options={voiceSelectOptions}
                disabled={
                  selectedPlatform === "favorites"
                    ? !favoriteVoices?.length
                    : selectedPlatform === "custom"
                      ? !successVoices?.length
                      : selectedPlatform === "Azure"
                        ? !azureLanguage ||
                          !currentPlatform ||
                          !currentPlatform.children?.length
                        : !currentPlatform || !currentPlatform.children?.length
                }
                className="flex-1"
              />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleCancel}>
            {t("avatar.cancel")}
          </Button>
          <Button onClick={handleCreate}>{t("avatar.createAvatar")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
