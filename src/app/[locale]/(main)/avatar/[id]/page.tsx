"use client";

import React, { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CustomSelect } from "@/components/ui/custom-select";
import { useAvatarDb } from "@/hooks/db/use-avatar-db";
import { Avatar } from "@/db/types";
import {
  ArrowLeft,
  Upload,
  Plus,
  Loader2,
  Download,
  Trash2,
  Play,
  Square,
  Camera,
  Video,
} from "lucide-react";
import { useAtom } from "jotai";
import { voiceStoreAtom } from "@/stores/slices/voice_store";
import { VoiceOption } from "@/constants/voices";
import { useEnhancedVoiceStore } from "@/hooks/use-enhanced-voice-store";
import { VideoPlayerModal } from "../../create/components/VideoPlayerModal";
import { appConfigAtom, store } from "@/stores";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { genSpeech } from "@/services/gen-speech";
import { useCustomVoiceDb } from "@/hooks/db/use-custom-voice";
import { useFavoriteVoice } from "@/hooks/db/use-favorite-voice";
import { createImage2Video } from "@/services/gen-image-2-video";
import ky from "ky";

// 图片预览模态框组件
const ImagePreviewModal: React.FC<{
  open: boolean;
  onOpenChange: (open: boolean) => void;
  imageUrl: string | null;
}> = ({ open, onOpenChange, imageUrl }) => {
  if (!imageUrl) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-4xl p-0">
        <img
          src={imageUrl}
          alt="图片预览"
          className="h-auto max-h-[80vh] w-full object-contain"
        />
      </DialogContent>
    </Dialog>
  );
};

const EditPage = () => {
  const params = useParams();
  const router = useRouter();
  const avatarId = params.id as string;
  const locale = params.locale as string;
  const { avatarData, updateAvatarData } = useAvatarDb();
  const [voiceStore] = useAtom(voiceStoreAtom);
  const {
    enhancedVoiceList,
    findVoiceById,
    isCustomVoice,
    getCustomVoiceDetails,
  } = useEnhancedVoiceStore(avatarId);
  const { successVoices } = useCustomVoiceDb();
  const { favoriteVoices } = useFavoriteVoice();

  const [avatar, setAvatar] = useState<Avatar | null>(null);
  const [editName, setEditName] = useState("");
  const [editPlatform, setEditPlatform] = useState("");
  const [editVoice, setEditVoice] = useState("");
  const [editGoogleModel, setEditGoogleModel] = useState("Gemini Flash");
  const [editAzureLanguage, setEditAzureLanguage] = useState("");
  const t = useTranslations();

  // 图片预览状态
  const [imagePreviewOpen, setImagePreviewOpen] = useState(false);
  const [currentImageUrl, setCurrentImageUrl] = useState<string | null>(null);

  // 视频播放状态
  const [videoPlayerOpen, setVideoPlayerOpen] = useState(false);
  const [currentVideoUrl, setCurrentVideoUrl] = useState<string | null>(null);

  // 上传相关状态
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [isUploadingVideo, setIsUploadingVideo] = useState(false);
  const [generatingVideoIndex, setGeneratingVideoIndex] = useState<
    number | null
  >(null);
  const { apiKey } = store.get(appConfigAtom);

  // 语音试听状态
  const [playingVoiceId, setPlayingVoiceId] = useState<string | null>(null);
  const [loadingVoiceId, setLoadingVoiceId] = useState<string | null>(null);
  const audioRef = React.useRef<HTMLAudioElement | null>(null);

  // 获取当前选中平台的信息
  const selectedPlatform = enhancedVoiceList.find(
    (group) => group.value === editPlatform
  );

  // 对于Azure平台，直接从voiceStore获取以确保有完整的语言分组数据
  const azurePlatform =
    editPlatform === "Azure"
      ? voiceStore.voiceList.find((group) => group.value === "Azure")
      : null;

  console.log("selectedPlatform for", editPlatform, ":", selectedPlatform);
  console.log(
    "voiceStore.voiceList:",
    voiceStore.voiceList.map((v) => v.value)
  );
  if (selectedPlatform && editPlatform === "custom") {
    console.log("Custom platform children:", selectedPlatform.children);
  }
  if (selectedPlatform && editPlatform === "Azure") {
    console.log("Azure platform children:", selectedPlatform.children);
  }
  if (azurePlatform) {
    console.log("azurePlatform found:", azurePlatform);
    console.log("azurePlatform children:", azurePlatform.children);
  }

  // 检查当前选择的声音是否在当前平台中有效
  const isCurrentVoiceValid = React.useMemo(() => {
    if (editPlatform === "favorites") {
      // 对于收藏声音，检查是否在 favoriteVoices 中
      return (
        favoriteVoices?.some(
          (favoriteVoice) => favoriteVoice.voiceValue === editVoice
        ) || false
      );
    }

    if (editPlatform === "Azure") {
      // 对于Azure，需要检查在选定的语言组中是否有效
      if (!editAzureLanguage || !azurePlatform?.children) return false;

      const selectedLanguageGroup: any = azurePlatform.children.find(
        (group: any) => group.value === editAzureLanguage
      );

      return (
        selectedLanguageGroup?.children?.some(
          (voiceOption: any) => voiceOption.value === editVoice
        ) || false
      );
    }

    return (
      selectedPlatform?.children.some(
        (voiceOption: any) => voiceOption.value === editVoice
      ) || false
    );
  }, [
    editPlatform,
    editVoice,
    selectedPlatform,
    favoriteVoices,
    editAzureLanguage,
    azurePlatform,
  ]);

  // 获取指定音色的sample数据
  const getVoiceSample = React.useCallback((voice: VoiceOption) => {
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
  const handlePlayVoiceSample = React.useCallback(
    async (e: React.MouseEvent, voice: VoiceOption) => {
      e.preventDefault();
      e.stopPropagation(); // 阻止选择项被触发

      const voiceId = `${editPlatform}:${voice.value}`;

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
      if (editPlatform === "google") {
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
              apiKey: apiKey!,
              platform: editGoogleModel, // 使用googleModel而不是platform
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
        editPlatform === "Azure" ||
        editPlatform === "Doubao" ||
        editPlatform === "fish"
      ) {
        // Azure、Doubao、Fish使用genSpeech接口
        try {
          // 立即设置loading状态
          setLoadingVoiceId(voiceId);

          const previewText = `你好，这是语音预览。`;

          const res = await genSpeech({
            apiKey: apiKey!,
            platform: editPlatform,
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
          console.error(`${editPlatform} TTS试听失败:`, error);
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
    [editPlatform, getVoiceSample, playingVoiceId, apiKey, editGoogleModel]
  );

  // 为语音选择准备选项 - 使用和ConfigurationPanel相同的逻辑
  const voiceSelectOptions = React.useMemo(() => {
    // 如果选择的是收藏平台，返回收藏声音选项
    if (editPlatform === "favorites") {
      if (!favoriteVoices || favoriteVoices.length === 0) return [];

      return favoriteVoices.map((favoriteVoice) => {
        // 构建voiceId用于播放状态管理，需要匹配原始平台
        const voiceId = `${favoriteVoice.groupKey}:${favoriteVoice.voiceValue}`;

        // 根据原始平台查找voice option以获取sample
        const originalPlatform = enhancedVoiceList.find(
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
    if (editPlatform === "custom") {
      if (!selectedPlatform?.children || selectedPlatform.children.length === 0)
        return [];

      return selectedPlatform.children.map((customVoice: any) => ({
        value: customVoice.value,
        label: customVoice.label,
        renderExtra: customVoice.audioUrl
          ? (isPlaying: boolean) => {
              const voiceId = `custom:${customVoice.value}`;
              return (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0 hover:bg-gray-200"
                  onClick={async (e) => {
                    e.stopPropagation();

                    // 如果正在播放相同的声音，则停止
                    if (playingVoiceId === voiceId && audioRef.current) {
                      audioRef.current.pause();
                      audioRef.current.currentTime = 0;
                      setPlayingVoiceId(null);
                      return;
                    }

                    // 播放自定义声音样本
                    if (customVoice.cloneType === "fish_audio") {
                      try {
                        setLoadingVoiceId(voiceId);
                        const res = await ky.post("/api/gen-fish-voice", {
                          json: {
                            apiKey: apiKey!,
                            voice: customVoice.audioUrl,
                            text: "你好，这是语音预览。",
                          },
                        });
                        const resData: any = await res.json();
                        const audio = new Audio(resData.audio_url);

                        audio.addEventListener("ended", () => {
                          setPlayingVoiceId(null);
                        });
                        audio.addEventListener("error", () => {
                          setPlayingVoiceId(null);
                        });

                        audioRef.current = audio;
                        setPlayingVoiceId(voiceId);
                        await audio.play();
                      } catch (error) {
                        toast.error("试听失败，请重试");
                      } finally {
                        setLoadingVoiceId(null);
                      }
                    } else {
                      const audio = new Audio(customVoice.audioUrl);
                      audioRef.current = audio;

                      audio.onplay = () => setPlayingVoiceId(voiceId);
                      audio.onended = () => setPlayingVoiceId(null);
                      audio.onerror = () => setPlayingVoiceId(null);

                      await audio.play();
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
    if (editPlatform === "Azure") {
      if (!editAzureLanguage || !azurePlatform?.children) return [];

      // 找到选中的语言组
      const selectedLanguageGroup: any = azurePlatform.children.find(
        (group: any) => group.value === editAzureLanguage
      );

      if (!selectedLanguageGroup?.children) return [];

      return selectedLanguageGroup.children.map((voiceOption: VoiceOption) => {
        const voiceId = `${editPlatform}:${voiceOption.value}`;
        const hasSample = !!getVoiceSample(voiceOption);
        const isSpecialPlatform = ["Azure", "Doubao", "fish"].includes(
          editPlatform
        );

        // 为Azure音色显示LocalName
        const getAzureLabel = (voiceOption: VoiceOption) => {
          if (editPlatform === "Azure" && voiceOption.originData) {
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
    if (!selectedPlatform?.children) return [];

    return selectedPlatform.children.map((voiceOption: VoiceOption) => {
      const voiceId = `${editPlatform}:${voiceOption.value}`;
      const hasSample = !!getVoiceSample(voiceOption);
      const isGoogleTTS = editPlatform === "google";
      const isSpecialPlatform =
        editPlatform === "Azure" ||
        editPlatform === "Doubao" ||
        editPlatform === "fish";

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
    editPlatform,
    selectedPlatform,
    favoriteVoices,
    enhancedVoiceList,
    playingVoiceId,
    loadingVoiceId,
    getVoiceSample,
    handlePlayVoiceSample,
    editAzureLanguage,
    azurePlatform,
  ]);

  // 为平台选择准备选项
  const platformSelectOptions = React.useMemo(() => {
    const baseOptions = enhancedVoiceList
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
  }, [enhancedVoiceList, successVoices, favoriteVoices]);

  // 从数据库中获取avatar数据 - 只在初始加载时执行
  useEffect(() => {
    if (avatarData && avatarId && !avatar) {
      // 只在avatar为空时初始化
      const foundAvatar: any = avatarData.find((a) => a.id === avatarId);
      if (foundAvatar) {
        setAvatar(foundAvatar);
        setEditName(foundAvatar.name || "");

        // 处理声音回显逻辑
        const voiceValue = foundAvatar.voice || "";
        const platformValue = foundAvatar.platform || "";

        // 检查是否是自定义声音平台或者voice值为custom格式
        if (platformValue === "custom" || isCustomVoice(voiceValue)) {
          // 自定义声音模式
          setEditPlatform("custom");
          setEditVoice(voiceValue);
          console.log(
            "检测到自定义声音，设置平台为 custom，声音为:",
            voiceValue
          );
        } else {
          // 普通声音，查找对应的平台
          setEditPlatform(platformValue);
          setEditVoice(voiceValue);
          // 设置 Google 模型
          if (foundAvatar.googleModel) {
            setEditGoogleModel(foundAvatar.googleModel);
          }
          // 设置 Azure 语言
          if (foundAvatar.azureLanguage) {
            setEditAzureLanguage(foundAvatar.azureLanguage);
          }
        }
      }
    }
  }, [avatarData, avatarId, isCustomVoice, avatar]);

  // 处理名称变化
  const handleNameChange = (value: string) => {
    setEditName(value);
  };

  // 处理名称失焦保存
  const handleNameBlur = async () => {
    // 保存到数据库
    if (avatar) {
      try {
        const updatedAvatar = {
          ...avatar,
          name: editName,
        };
        await updateAvatarData(updatedAvatar);
        setAvatar(updatedAvatar);
        console.log("名称已更新:", editName);
      } catch (error) {
        console.error("更新名称失败:", error);
        toast.error("更新失败，请重试");
      }
    }
  };

  // 处理平台变化
  const handlePlatformChange = async (value: string) => {
    setEditPlatform(value);
    setEditVoice(""); // 重置音色选择

    // 实时保存到数据库
    if (avatar) {
      try {
        const updatedAvatar = {
          ...avatar,
          platform: value,
          voice: "", // 平台变化时重置声音
        };
        await updateAvatarData(updatedAvatar);
        setAvatar(updatedAvatar);
        console.log("平台已更新:", value);
      } catch (error) {
        console.error("更新平台失败:", error);
        toast.error("更新失败，请重试");
      }
    }
  };

  // 处理音色变化
  const handleVoiceChange = async (value: string) => {
    setEditVoice(value);

    // 实时保存到数据库
    if (avatar) {
      try {
        const updatedAvatar = {
          ...avatar,
          voice: value,
        };
        await updateAvatarData(updatedAvatar);
        setAvatar(updatedAvatar);
        console.log("声音已更新:", value);
      } catch (error) {
        console.error("更新声音失败:", error);
        toast.error("更新失败，请重试");
      }
    }
  };

  // 处理 Google 模型变化
  const handleGoogleModelChange = async (value: string) => {
    setEditGoogleModel(value);

    // 实时保存到数据库
    if (avatar) {
      try {
        const updatedAvatar = {
          ...avatar,
          googleModel: value,
        };
        await updateAvatarData(updatedAvatar);
        setAvatar(updatedAvatar);
        console.log("Google模型已更新:", value);
      } catch (error) {
        console.error("更新Google模型失败:", error);
        toast.error("更新失败，请重试");
      }
    }
  };

  // 处理 Azure 语言变化
  const handleAzureLanguageChange = async (value: string) => {
    console.log("=== handleAzureLanguageChange START ===");
    console.log("handleAzureLanguageChange called with value:", value);
    console.log("Current editAzureLanguage before update:", editAzureLanguage);

    setEditAzureLanguage(value);
    console.log("setEditAzureLanguage called with:", value);

    setEditVoice(""); // 重置音色选择

    // 先不做数据库更新，只测试状态更新
    console.log("=== handleAzureLanguageChange END ===");

    // 实时保存到数据库
    if (avatar) {
      try {
        const updatedAvatar = {
          ...avatar,
          azureLanguage: value,
          voice: "", // 语言变化时重置声音
        };
        await updateAvatarData(updatedAvatar);
        setAvatar(updatedAvatar);
        console.log("Azure语言已更新:", value);
      } catch (error) {
        console.error("更新Azure语言失败:", error);
        toast.error("更新失败，请重试");
      }
    }
  };

  // 处理图片点击
  const handleImageClick = (imageUrl: string) => {
    setCurrentImageUrl(imageUrl);
    setImagePreviewOpen(true);
  };

  // 处理视频点击
  const handleVideoClick = (videoUrl: string) => {
    setCurrentVideoUrl(videoUrl);
    setVideoPlayerOpen(true);
  };

  // 处理图片上传
  const handleImageUpload = async (file: File) => {
    if (!apiKey) {
      toast.error("请先配置API Key");
      return;
    }

    try {
      setIsUploadingImage(true);

      // 创建FormData
      const formData = new FormData();
      formData.append("file", file);
      formData.append("apiKey", apiKey);

      // 调用上传API
      const response = await fetch("/api/upload-video", {
        method: "POST",
        body: formData,
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result.error?.message_cn || result.error?.message || "上传失败"
        );
      }

      // 上传成功，添加URL到图片数组中
      if (result.data || result.url || result.file_url) {
        const imageUrl = result.data || result.url || result.file_url;

        const updatedAvatar = {
          ...avatar!,
          pic_url: [...(avatar!.pic_url || []), imageUrl],
        };

        await updateAvatarData(updatedAvatar);
        setAvatar(updatedAvatar);
        // toast.success("图片上传成功");
      } else {
        throw new Error("上传结果中没有找到有效的URL");
      }
    } catch (error) {
      console.error("图片上传失败:", error);
      toast.error(
        error instanceof Error ? error.message : "图片上传失败，请重试"
      );
    } finally {
      setIsUploadingImage(false);
    }
  };

  // 处理图片删除
  const handleImageDelete = async (index: number, imageUrl: string) => {
    if (!avatar) return;

    // 检查是否只有一张图片，如果是则不允许删除
    if (!avatar.pic_url || avatar.pic_url.length <= 1) {
      toast.error(t("avatar.picDeleteDesc"));
      return;
    }

    try {
      const updatedPicUrls =
        avatar.pic_url?.filter((_, i) => i !== index) || [];

      const updatedAvatar = {
        ...avatar,
        pic_url: updatedPicUrls,
      };

      await updateAvatarData(updatedAvatar);
      setAvatar(updatedAvatar);
      // toast.success("图片删除成功");
    } catch (error) {
      console.error("图片删除失败:", error);
      toast.error("图片删除失败，请重试");
    }
  };

  // 处理视频删除
  const handleVideoDelete = async (index: number, videoUrl: string) => {
    if (!avatar) return;

    try {
      const updatedVideoUrls =
        avatar.videoUrl?.filter((_, i) => i !== index) || [];

      const updatedAvatar = {
        ...avatar,
        videoUrl: updatedVideoUrls,
      };

      await updateAvatarData(updatedAvatar);
      setAvatar(updatedAvatar);
      // toast.success("视频删除成功");
    } catch (error) {
      console.error("视频删除失败:", error);
      toast.error("视频删除失败，请重试");
    }
  };

  // 截取视频第一帧
  const handleExtractFrame = async (videoUrl: string, index: number) => {
    if (!avatar || !apiKey) {
      toast.error("请先配置API Key");
      return;
    }

    try {
      console.log("Starting frame extraction for:", videoUrl);

      // 创建video元素来加载视频
      const video = document.createElement("video");
      video.crossOrigin = "anonymous";
      video.src = videoUrl;

      // 等待视频加载
      await new Promise((resolve, reject) => {
        video.onloadeddata = () => {
          console.log(
            "Video loaded, dimensions:",
            video.videoWidth,
            "x",
            video.videoHeight
          );
          resolve(null);
        };
        video.onerror = (e) => {
          console.error("Video load error:", e);
          reject(e);
        };
      });

      // 设置到第一帧
      video.currentTime = 0.1;

      // 等待seek完成
      await new Promise((resolve) => {
        video.onseeked = () => {
          console.log("Video seek completed");
          resolve(null);
        };
      });

      // 创建canvas来捕获帧
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");

      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;

      console.log("Canvas dimensions:", canvas.width, "x", canvas.height);
      ctx?.drawImage(video, 0, 0);

      // 将canvas转换为blob
      const blob = await new Promise<Blob>((resolve) => {
        canvas.toBlob(
          (blob) => {
            console.log("Blob created, size:", blob?.size);
            resolve(blob!);
          },
          "image/jpeg",
          0.8
        );
      });

      // 上传到服务器
      console.log("Preparing upload, apiKey exists:", !!apiKey);
      const formData = new FormData();
      formData.append("file", blob, `视频帧_${index + 1}.jpg`);
      formData.append("apiKey", apiKey);

      const response = await fetch("/api/upload-video", {
        method: "POST",
        body: formData,
      });

      const result = await response.json();

      console.log("Frame upload response:", response.status, result);

      if (!response.ok) {
        console.error("Frame upload failed:", result);
        throw new Error(
          result.error?.message_cn ||
            result.error?.message ||
            `上传失败 (${response.status})`
        );
      }

      // 获取上传后的URL
      const imageUrl = result.data || result.url || result.file_url;
      if (!imageUrl) {
        throw new Error("上传结果中没有找到有效的URL");
      }

      // 添加到图片素材中
      const updatedPicUrls = [...(avatar.pic_url || []), imageUrl];
      const updatedAvatar = {
        ...avatar,
        pic_url: updatedPicUrls,
      };

      await updateAvatarData(updatedAvatar);
      setAvatar(updatedAvatar);
      toast.success("视频第一帧已添加到图片素材");
    } catch (error) {
      console.error("截取视频帧失败:", error);
      toast.error("截取视频帧失败，请重试");
    }
  };

  // 图片生成视频
  const handleGenerateVideo = async (imageUrl: string, index: number) => {
    if (!avatar || !apiKey) {
      toast.error("请先配置API Key");
      return;
    }

    try {
      setGeneratingVideoIndex(index);
      console.log("Starting video generation for:", imageUrl);
      console.log("Parameters:", {
        apiKey: !!apiKey,
        input_image: imageUrl,
        aspect_ratio: "16:9",
      });

      // 调用图片转视频服务
      const result = await createImage2Video({
        apiKey: apiKey,
        input_image: imageUrl,
        aspect_ratio: "16:9",
      });

      console.log("Video generation result:", result);

      // 提取视频URL
      let videoUrl: string | undefined;

      if (result.data?.video?.url) {
        videoUrl = result.data.video.url;
      } else if (result.video?.url) {
        videoUrl = result.video.url;
      } else if (result.video_url) {
        videoUrl = result.video_url;
      } else if (result.url) {
        videoUrl = result.url;
      }

      if (!videoUrl) {
        throw new Error("生成结果中没有找到视频URL");
      }

      // 添加到视频素材中
      const updatedVideoUrls = [...(avatar.videoUrl || []), videoUrl];
      const updatedAvatar = {
        ...avatar,
        videoUrl: updatedVideoUrls,
      };

      await updateAvatarData(updatedAvatar);
      setAvatar(updatedAvatar);
      toast.success("图片已生成为视频并添加到视频素材");
    } catch (error) {
      console.error("图片生成视频失败:", error);
      toast.error("图片生成视频失败，请重试");
    } finally {
      setGeneratingVideoIndex(null);
    }
  };

  // 处理视频上传
  const handleVideoUpload = async (file: File) => {
    if (!apiKey) {
      toast.error("请先配置API Key");
      return;
    }

    try {
      setIsUploadingVideo(true);

      // 创建FormData
      const formData = new FormData();
      formData.append("file", file);
      formData.append("apiKey", apiKey);

      // 调用上传API
      const response = await fetch("/api/upload-video", {
        method: "POST",
        body: formData,
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result.error?.message_cn || result.error?.message || "上传失败"
        );
      }

      // 上传成功，添加URL到视频数组中
      if (result.data || result.url || result.file_url) {
        const videoUrl = result.data || result.url || result.file_url;

        const updatedAvatar = {
          ...avatar!,
          videoUrl: [...(avatar!.videoUrl || []), videoUrl],
        };

        await updateAvatarData(updatedAvatar);
        setAvatar(updatedAvatar);
        // toast.success("视频上传成功");
      } else {
        throw new Error("上传结果中没有找到有效的URL");
      }
    } catch (error) {
      console.error("视频上传失败:", error);
      toast.error(
        error instanceof Error ? error.message : "视频上传失败，请重试"
      );
    } finally {
      setIsUploadingVideo(false);
    }
  };

  const handleSave = async () => {
    if (!avatar) return;

    try {
      const updatedAvatar = {
        ...avatar,
        name: editName,
        platform: editPlatform,
        voice: editVoice,
        ...(editPlatform === "google" && { googleModel: editGoogleModel }),
        ...(editPlatform === "Azure" && { azureLanguage: editAzureLanguage }),
      };

      await updateAvatarData(updatedAvatar);
      router.push(`/${locale}/avatar`);
    } catch (error) {
      console.error("Failed to update avatar:", error);
    }
  };

  const handleBack = () => {
    router.push(`/${locale}/avatar`);
  };

  if (!avatar) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <div className="mx-auto max-w-full">
        {/* 头部导航 */}
        <div className="p-6">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-1"
              onClick={handleBack}
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <h1 className="text-xl font-semibold">
                {t("avatar.editAvatar")}
              </h1>
            </div>
          </div>
        </div>

        <div className="max-w-7xl">
          <div className="space-y-8 px-6 pb-6">
            {/* 第一行：名称编辑、默认声音 */}
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <Label
                    htmlFor="avatar-name"
                    className="min-w-fit text-sm font-medium"
                  >
                    {t("avatar.avatarName")}
                  </Label>
                  <Input
                    id="avatar-name"
                    value={editName}
                    onChange={(e) => handleNameChange(e.target.value)}
                    onBlur={handleNameBlur}
                    placeholder={t("avatar.avatarNamePlaceholder")}
                    className="w-40"
                    maxLength={10}
                  />
                </div>

                <div className="flex items-center gap-2">
                  <Label className="min-w-fit text-sm font-medium">
                    {t("avatar.defaultVoice")}
                  </Label>
                  <div className="flex gap-2">
                    <CustomSelect
                      value={editPlatform}
                      onValueChange={handlePlatformChange}
                      placeholder={t("avatar.pleaseSelectPlatform")}
                      options={platformSelectOptions}
                      className="w-44"
                    />
                    {editPlatform === "google" && (
                      <CustomSelect
                        value={editGoogleModel}
                        onValueChange={handleGoogleModelChange}
                        placeholder="Google模型"
                        options={[
                          { value: "Gemini Flash", label: "Gemini Flash" },
                          { value: "Gemini Pro", label: "Gemini Pro" },
                        ]}
                        className="w-32"
                      />
                    )}
                    {editPlatform === "Azure" && (
                      <CustomSelect
                        value={editAzureLanguage}
                        onValueChange={(value) => {
                          console.log(
                            "CustomSelect onValueChange triggered with:",
                            value
                          );
                          handleAzureLanguageChange(value);
                        }}
                        placeholder={t("avatar.pleaseSelectLanguage")}
                        options={(() => {
                          const options =
                            azurePlatform?.children?.map((group: any) => ({
                              value: group.value,
                              label: group.label,
                            })) || [];
                          console.log("Azure language options:", options);
                          console.log(
                            "Current editAzureLanguage:",
                            editAzureLanguage
                          );
                          return options;
                        })()}
                        className="w-32"
                      />
                    )}
                    <CustomSelect
                      value={isCurrentVoiceValid ? editVoice : ""}
                      onValueChange={handleVoiceChange}
                      placeholder={t("avatar.selectVoice")}
                      options={voiceSelectOptions}
                      disabled={
                        editPlatform === "favorites"
                          ? !favoriteVoices?.length
                          : editPlatform === "custom"
                            ? !selectedPlatform?.children?.length
                            : editPlatform === "Azure"
                              ? !editAzureLanguage ||
                                !azurePlatform ||
                                !azurePlatform.children?.length
                              : !selectedPlatform ||
                                !selectedPlatform.children?.length
                      }
                      className="w-72"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* 第二行：图片素材 */}
            <div className="space-y-4">
              <h2 className="flex items-center gap-2 font-medium">
                {t("avatar.imageMaterial")}
              </h2>
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
                {/* 上传卡片 - 始终在第一位 */}
                <div className="group relative">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleImageUpload(file);
                      // 重置input的值，允许选择相同文件
                      e.target.value = "";
                    }}
                    className="hidden"
                    id="image-upload-input"
                  />
                  <label
                    htmlFor="image-upload-input"
                    className={`flex aspect-square cursor-pointer items-center justify-center rounded-lg border-2 border-dashed transition-all ${
                      isUploadingImage
                        ? "border-primary/50 bg-primary/5"
                        : "border-gray-300 hover:border-primary/50 hover:bg-gray-50"
                    }`}
                  >
                    {isUploadingImage ? (
                      <div className="flex flex-col items-center gap-2">
                        <Loader2 className="h-8 w-8 animate-spin text-primary" />
                        <span className="text-sm text-gray-500">
                          {t("avatar.uploading")}
                        </span>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center gap-2">
                        <Plus className="h-8 w-8 text-gray-400" />
                        <span className="text-sm text-gray-500">
                          {t("avatar.uploadImage")}
                        </span>
                      </div>
                    )}
                  </label>
                </div>

                {/* 现有图片素材 */}
                {avatar.pic_url &&
                  avatar.pic_url.length > 0 &&
                  avatar.pic_url.map((imageUrl, index) => (
                    <div key={index} className="group relative">
                      <div
                        className="aspect-square cursor-pointer overflow-hidden rounded-lg border border-gray-200"
                        onClick={() => handleImageClick(imageUrl)}
                      >
                        <img
                          src={imageUrl}
                          alt={`图片素材${index + 1}`}
                          className="h-full w-full object-contain"
                          onError={(e) => {
                            e.currentTarget.src = "/placeholder-avatar.png";
                          }}
                        />
                      </div>
                      {/* 卡片底部内容区域 */}
                      <div className="mt-2 flex items-center justify-between">
                        <span className="text-sm text-gray-600">
                          {t("avatar.imageMaterial")} {index + 1}
                        </span>
                        <div className="flex gap-2">
                          <button
                            onClick={async (e) => {
                              e.stopPropagation();
                              try {
                                const response = await fetch(imageUrl);
                                const blob = await response.blob();
                                const url = URL.createObjectURL(blob);
                                const link = document.createElement("a");
                                link.href = url;
                                link.download = `${t("avatar.imageMaterial")} ${index + 1}`;
                                document.body.appendChild(link);
                                link.click();
                                document.body.removeChild(link);
                                URL.revokeObjectURL(url);
                              } catch (error) {
                                console.error("下载失败:", error);
                                toast.error("下载失败，请重试");
                              }
                            }}
                            className="text-gray-500 transition-colors hover:text-blue-600"
                            title={t("avatar.download")}
                          >
                            <Download className="h-4 w-4" />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleGenerateVideo(imageUrl, index);
                            }}
                            disabled={generatingVideoIndex === index}
                            className="text-gray-500 transition-colors hover:text-purple-600 disabled:cursor-not-allowed disabled:opacity-50"
                            title={t("avatar.generateVideoToVideoMaterial")}
                          >
                            {generatingVideoIndex === index ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Video className="h-4 w-4" />
                            )}
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleImageDelete(index, imageUrl);
                            }}
                            disabled={
                              !avatar.pic_url || avatar.pic_url.length <= 1
                            }
                            className={`transition-colors ${
                              !avatar.pic_url || avatar.pic_url.length <= 1
                                ? "cursor-not-allowed text-gray-300"
                                : "text-red-500 hover:text-red-700"
                            }`}
                            title={
                              !avatar.pic_url || avatar.pic_url.length <= 1
                                ? t("avatar.picDeleteDesc")
                                : t("avatar.delete")
                            }
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
              </div>
            </div>

            {/* 第三行：视频素材 */}
            <div className="space-y-4">
              <h2 className="flex items-center gap-2 font-medium">
                {t("avatar.videoMaterial")}
              </h2>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                {/* 上传卡片 - 始终在第一位 */}
                <div className="group relative">
                  <input
                    type="file"
                    accept="video/*"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleVideoUpload(file);
                      // 重置input的值，允许选择相同文件
                      e.target.value = "";
                    }}
                    className="hidden"
                    id="video-upload-input"
                  />
                  <label
                    htmlFor="video-upload-input"
                    className={`flex aspect-video cursor-pointer items-center justify-center rounded-lg border-2 border-dashed transition-all ${
                      isUploadingVideo
                        ? "border-primary/50 bg-primary/5"
                        : "border-gray-300 hover:border-primary/50 hover:bg-gray-50"
                    }`}
                  >
                    {isUploadingVideo ? (
                      <div className="flex flex-col items-center gap-2">
                        <Loader2 className="h-12 w-12 animate-spin text-primary" />
                        <span className="text-sm text-gray-500">
                          {t("avatar.uploading")}
                        </span>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center gap-2">
                        <Plus className="h-8 w-8 text-gray-400" />
                        <span className="text-sm text-gray-500">
                          {t("avatar.addVideo")}
                        </span>
                      </div>
                    )}
                  </label>
                </div>

                {/* 现有视频素材 */}
                {avatar.videoUrl &&
                  avatar.videoUrl.length > 0 &&
                  avatar.videoUrl.map((videoUrl, index) => (
                    <div key={index} className="group relative">
                      <div className="aspect-video overflow-hidden rounded-lg border border-gray-200 bg-gray-100">
                        <video
                          src={videoUrl}
                          className="h-full w-full cursor-pointer object-contain"
                          preload="metadata"
                          controls
                          onLoadedData={(e) => {
                            const video = e.target as HTMLVideoElement;
                            video.currentTime = 0.1;
                          }}
                        />
                      </div>
                      {/* 卡片底部内容区域 */}
                      <div className="mt-2 flex items-center justify-between">
                        <span className="text-sm text-gray-600">
                          {t("avatar.videoMaterial")} {index + 1}
                        </span>
                        <div className="flex gap-2">
                          <button
                            onClick={async (e) => {
                              e.stopPropagation();
                              try {
                                const response = await fetch(videoUrl);
                                const blob = await response.blob();
                                const url = URL.createObjectURL(blob);
                                const link = document.createElement("a");
                                link.href = url;
                                link.download = `${t("avatar.videoMaterial")} ${index + 1}`;
                                document.body.appendChild(link);
                                link.click();
                                document.body.removeChild(link);
                                URL.revokeObjectURL(url);
                              } catch (error) {
                                console.error("下载失败:", error);
                                toast.error("下载失败，请重试");
                              }
                            }}
                            className="text-gray-500 transition-colors hover:text-blue-600"
                            title={t("avatar.download")}
                          >
                            <Download className="h-4 w-4" />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleExtractFrame(videoUrl, index);
                            }}
                            className="text-gray-500 transition-colors hover:text-green-600"
                            title={t("avatar.extractFirstFrameToImageMaterial")}
                          >
                            <Camera className="h-4 w-4" />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleVideoDelete(index, videoUrl);
                            }}
                            className="text-red-500 transition-colors hover:text-red-700"
                            title={t("avatar.delete")}
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 图片预览模态框 */}
      <ImagePreviewModal
        open={imagePreviewOpen}
        onOpenChange={setImagePreviewOpen}
        imageUrl={currentImageUrl}
      />

      {/* 视频播放模态框 */}
      <VideoPlayerModal
        open={videoPlayerOpen}
        onOpenChange={setVideoPlayerOpen}
        videoUrl={currentVideoUrl}
      />
    </div>
  );
};

export default EditPage;
