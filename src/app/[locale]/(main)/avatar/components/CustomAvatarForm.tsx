"use client";

import React, { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { VideoUploadForm } from "./VideoUploadForm";
import { VoiceSelectionForm } from "./VoiceSelectionForm";
import { createAvatar } from "@/services/create-avatar";
import { useAvatarDb } from "@/hooks/db/use-avatar-db";
import { useCustomVoiceDb } from "@/hooks/db/use-custom-voice";
import { audioSeparation } from "@/services/audio-separation";
import { pollAudioSeparation } from "@/services/poll-audio-separation";
import { Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";

interface CustomAvatarFormProps {
  avatarName: string;
  onAvatarNameChange: (name: string) => void;
  selectedVideo: File | null;
  onVideoChange: (file: File | null) => void;
  uploadedVideoUrl: string;
  onUploadedVideoUrl: (url: string) => void;
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
  clonedVoiceName: string;
  onClonedVoiceNameChange: (name: string) => void;
  selectedModel: string;
  onSelectedModelChange: (model: string) => void;
  googleModel: string;
  onGoogleModelChange: (model: string) => void;
  azureLanguage: string;
  onAzureLanguageChange: (language: string) => void;
  apiKey: string;
  onSuccess?: () => void;
  onError?: (error: string) => void;
}

export const CustomAvatarForm: React.FC<CustomAvatarFormProps> = ({
  avatarName,
  onAvatarNameChange,
  selectedVideo,
  onVideoChange,
  uploadedVideoUrl,
  onUploadedVideoUrl,
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
  clonedVoiceName,
  onClonedVoiceNameChange,
  selectedModel,
  onSelectedModelChange,
  googleModel,
  onGoogleModelChange,
  azureLanguage,
  onAzureLanguageChange,
  apiKey,
  onSuccess,
  onError,
}) => {
  const { addAvatarData } = useAvatarDb();
  const { addCustomVoiceData, updateVoiceByLoopId, findVoiceByLoopId } =
    useCustomVoiceDb();
  const [isCreating, setIsCreating] = useState(false);
  const t = useTranslations();
  const handleCreateAvatar = async () => {
    if (!avatarName.trim()) {
      toast.error(t("avatar.pleaseInputAvatarName"));
      return;
    }
    if (!uploadedVideoUrl) {
      toast.error(t("avatar.pleaseUploadVideo"));
      return;
    }
    if (voiceSelectionType === "clone" && !cloneInputText.trim()) {
      toast.error(t("avatar.cloneVoiceNamePlaceholder"));
      return;
    }

    try {
      setIsCreating(true);

      let extractedAudioUrl = "";
      let customVoiceId: number | undefined = undefined;
      let audioTaskId = "";

      // 如果是克隆声音模式，先提取视频中的音频
      if (voiceSelectionType === "clone") {
        try {
          // 启动音频分离任务
          const audioSepResult = await audioSeparation({
            apiKey,
            videos: [uploadedVideoUrl],
          });

          audioTaskId = audioSepResult.task_id;

          // 创建自定义声音记录（pending状态）
          customVoiceId = await addCustomVoiceData({
            name: cloneInputText, // name字段对应cloneInputText
            model_type: "custom", // 默认使用cicada3.0
            text: "", // 不需要存储text，留空
            status: "pending",
            loopId: audioSepResult.task_id, // 使用音频分离任务ID作为loopId
            audioId: "",
            audioUrl: "",
          });

          console.log("自定义声音记录创建成功，ID:", customVoiceId);

          // 轮询音频分离结果
          const audioResult = await pollAudioSeparation({
            apiKey,
            taskId: audioSepResult.task_id,
          });

          console.log("音频分离完成:", audioResult);

          if (audioResult.status === "success" && audioResult.audio_url) {
            extractedAudioUrl = audioResult.audio_url;

            // 通过loopId更新自定义声音记录
            try {
              const updatedVoiceId = await updateVoiceByLoopId(audioTaskId, {
                status: "success",
                audioUrl: extractedAudioUrl,
              });
              if (updatedVoiceId) {
                customVoiceId = updatedVoiceId;
              }
              console.log(
                "音频提取成功，自定义声音记录已更新，ID:",
                customVoiceId
              );
              // toast.success("音频提取成功！");
            } catch (updateError) {
              console.error("更新自定义声音记录失败:", updateError);
              toast.warning("保存失败");
            }
          } else {
            // 音频分离失败，标记声音记录为失败状态
            try {
              await updateVoiceByLoopId(audioTaskId, {
                status: "failed",
              });
              console.warn("音频分离失败，已标记声音记录为失败状态");
            } catch (error) {
              console.error("标记声音记录失败状态时出错:", error);
            }
            toast.warning("音频提取失败，但数字人创建将继续进行");
          }
        } catch (audioError) {
          console.error("音频分离过程出错:", audioError);
          // 标记声音记录为失败状态
          if (audioTaskId) {
            try {
              await updateVoiceByLoopId(audioTaskId, {
                status: "failed",
              });
            } catch (error) {
              console.error("标记声音记录失败状态时出错:", error);
            }
          }
          toast.warning("音频提取失败，但数字人创建将继续进行");
        }
      }

      // 创建数字人
      const res = await createAvatar({
        apiKey,
        videoUrl: uploadedVideoUrl,
        platform: selectedPlatform,
        voice: selectedVoice,
        ...(selectedPlatform === "google" && { googleModel }),
      });

      if (!res.results.avatarId) {
        toast.error(t("avatar.createAvatarFailed"));
        return;
      }

      // 保存avatar数据
      if (voiceSelectionType === "library") {
        const avatarData = {
          id: res.results.avatarId,
          avatar_id: res.results.avatarId,
          name: avatarName,
          videoUrl: [uploadedVideoUrl],
          platform: selectedPlatform,
          voice: selectedVoice,
          pic_url: [res.results.pic_url],
          createdAt: Date.now(),
          ...(selectedPlatform === "google" && { googleModel }),
          ...(selectedPlatform === "Azure" && { azureLanguage }),
        };
        await addAvatarData(avatarData);
      } else {
        // 克隆声音模式，确保使用正确的自定义声音格式
        let voiceIdentifier = "";
        let platformValue = "";

        if (customVoiceId) {
          // 有自定义声音ID，使用custom格式
          voiceIdentifier = `custom_${customVoiceId}`;
          platformValue = "custom";

          // 关联avatarId到自定义声音记录
          try {
            await updateVoiceByLoopId(audioTaskId, {
              avatarId: res.results.avatarId,
            });
            console.log("成功关联自定义声音到avatarId:", res.results.avatarId);
          } catch (updateError) {
            console.error("关联avatarId失败:", updateError);
          }
        } else {
          // 没有自定义声音ID，使用传统的clone模式（兼容性）
          voiceIdentifier = clonedVoiceName || selectedVoice;
          platformValue = cloneModel;
        }

        const avatarData = {
          id: res.results.avatarId,
          avatar_id: res.results.avatarId,
          name: avatarName,
          videoUrl: [uploadedVideoUrl],
          platform: platformValue,
          voice: voiceIdentifier,
          pic_url: [res.results.pic_url],
          createdAt: Date.now(),
          ...(selectedPlatform === "google" && { googleModel }),
          ...(selectedPlatform === "Azure" && { azureLanguage }),
        };
        await addAvatarData(avatarData);

        console.log("Avatar创建完成，数据:", {
          avatarId: res.results.avatarId,
          platform: platformValue,
          voice: voiceIdentifier,
          customVoiceId,
        });
      }

      toast.success(t("avatar.createAvatarSuccess"));
      onSuccess?.();
    } catch (error) {
      console.error("创建数字人失败:", error);
      const errorMessage = t("avatar.createAvatarFailed");
      toast.error(errorMessage);
      onError?.(errorMessage);
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="mt-6 space-y-6">
      {/* 数字人名称 */}
      <div className="ml-[1px] mr-2 space-y-2">
        <Label htmlFor="avatar-name">{t("avatar.avatarName")}</Label>
        <Input
          id="avatar-name"
          placeholder={t("avatar.avatarNamePlaceholder")}
          value={avatarName}
          onChange={(e) => onAvatarNameChange(e.target.value)}
          maxLength={10}
        />
      </div>

      {/* 上传视频 */}
      <VideoUploadForm
        selectedVideo={selectedVideo}
        onVideoChange={onVideoChange}
        uploadedVideoUrl={uploadedVideoUrl}
        onUploadedVideoUrl={onUploadedVideoUrl}
      />

      {/* 声音选择 */}
      <VoiceSelectionForm
        voiceSelectionType={voiceSelectionType}
        onVoiceSelectionTypeChange={onVoiceSelectionTypeChange}
        selectedPlatform={selectedPlatform}
        onSelectedPlatformChange={onSelectedPlatformChange}
        selectedVoice={selectedVoice}
        onSelectedVoiceChange={onSelectedVoiceChange}
        cloneInputText={cloneInputText}
        onCloneInputTextChange={onCloneInputTextChange}
        cloneModel={cloneModel}
        onCloneModelChange={onCloneModelChange}
        googleModel={googleModel}
        onGoogleModelChange={onGoogleModelChange}
        azureLanguage={azureLanguage}
        onAzureLanguageChange={onAzureLanguageChange}
      />

      {/* 创建数字人按钮 */}
      <div className="pt-4">
        <Button
          className="w-full"
          size="lg"
          onClick={handleCreateAvatar}
          disabled={isCreating}
        >
          {isCreating ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              {t("avatar.creating")}
            </>
          ) : (
            t("avatar.createAvatar")
          )}
        </Button>
      </div>
    </div>
  );
};
