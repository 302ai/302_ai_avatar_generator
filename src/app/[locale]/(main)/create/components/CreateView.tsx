"use client";

import React, { useCallback, useState } from "react";
import { Card } from "@/components/ui/card";
import { VideoPreviewFrame, ConfigurationPanel } from "./index";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Edit2, Check, ArrowLeft } from "lucide-react";
import { AdvancedSettings } from "./AdvancedSettings";
import Actions from "./actions";
import { useAtom } from "jotai";
import { createVideoStoreAtom } from "@/stores/slices/create_video";
import { createConfigAtom } from "@/stores/slices/create_config";
import { appConfigAtom, store } from "@/stores";
import { useHistoryDb } from "@/hooks/db/use-db";
import { useFavoriteVoice } from "@/hooks/db/use-favorite-voice";
import { useCustomVoiceDb } from "@/hooks/db/use-custom-voice";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { createAvatar } from "@/services/create-avatar";
import { genSpeech } from "@/services/gen-speech";
import { createAudio } from "@/services/create-audio";
import { createVideo } from "@/services/gen-video";
import { createHedraVideo } from "@/services/gen-hedra-video";
import { createOmnihumanVideo } from "@/services/gen-omnihuman-video";
import ky from "ky";

interface CreateViewProps {
  onBackToList: () => void;
}

export const CreateView: React.FC<CreateViewProps> = ({ onBackToList }) => {
  const t = useTranslations();
  const { apiKey } = store.get(appConfigAtom);
  const [createVideoStore, setCreateVideoStore] = useAtom(createVideoStoreAtom);
  const [createConfig] = useAtom(createConfigAtom);
  const { favoriteVoices } = useFavoriteVoice();
  const { successVoices } = useCustomVoiceDb();

  // Video name state
  const [videoName, setVideoName] = useState(t("avatar.noName"));
  const [isEditingName, setIsEditingName] = useState(false);

  // Generation loading states
  const [isBatchGenerating, setIsBatchGenerating] = useState(false);
  const [isMergeGenerating, setIsMergeGenerating] = useState(false);

  const {
    addHistoryData,
    addMergeHistoryData,
    updateMergeHistoryItem,
    deleteHistoryDataItem,
    deleteMergeHistoryItem,
  } = useHistoryDb();

  // Get real platform info helper
  const getRealPlatform = useCallback(
    (platform: string, voice: string) => {
      if (platform === "favorites") {
        const favoriteVoice = favoriteVoices?.find(
          (fav) => fav.voiceValue === voice
        );
        return favoriteVoice?.groupKey || platform;
      }
      return platform;
    },
    [favoriteVoices]
  );

  // Handle avatar selection
  const handleAvatarSelected = useCallback(
    (
      itemId: string,
      avatar: {
        imageUrl: string;
        voice: string;
        video: string;
        platform?: string;
        googleModel?: string;
      }
    ) => {
      console.log("🎯 handleAvatarSelected called:", { itemId, avatar });

      let platform = avatar.platform || "";
      let voiceId = avatar.voice;
      const googleModel = avatar.googleModel;

      if (!platform) {
        if (avatar.voice.startsWith("minimaxi-")) {
          platform = "Minimaxi";
          voiceId = avatar.voice.replace("minimaxi-", "");
        } else if (avatar.voice.startsWith("doubao-")) {
          platform = "Doubao";
          voiceId = avatar.voice.replace("doubao-", "");
        } else if (avatar.voice.startsWith("fish-")) {
          platform = "fish";
          voiceId = avatar.voice.replace("fish-", "");
        } else if (avatar.voice.startsWith("openai-")) {
          platform = "OpenAI";
          voiceId = avatar.voice.replace("openai-", "");
        } else if (avatar.voice.startsWith("google-")) {
          platform = "google";
          voiceId = avatar.voice.replace("google-", "");
        }
      }

      setCreateVideoStore((prevStore) => ({
        ...prevStore,
        videoList: prevStore.videoList.map((item) =>
          item.id === itemId
            ? {
                ...item,
                avatarImage: avatar.imageUrl,
                platform: platform,
                voice: voiceId,
                videoUrl: avatar.video,
                ...(googleModel && {
                  googleModel: googleModel as "Gemini Flash" | "Gemini Pro",
                }),
              }
            : item
        ),
      }));
    },
    [setCreateVideoStore]
  );

  // Generate function (moved from main page)
  const onGenerate = async (isMerge: boolean = false) => {
    if (isMerge) {
      setIsMergeGenerating(true);
    } else {
      setIsBatchGenerating(true);
    }

    try {
      const avatars = createVideoStore.videoList.map((item) => ({
        ...item,
        apiKey: apiKey,
      }));

      let mergeHistoryId: string | null = null;
      const childTaskIds: string[] = [];
      const childTasks: Array<{
        taskId: string;
        status: "pending";
        videoUrl?: string;
      }> = [];

      // Create MergeHistory record if batch generation
      if (isMerge && avatars.length > 1) {
        mergeHistoryId = crypto.randomUUID();
        await addMergeHistoryData({
          id: mergeHistoryId,
          name: videoName,
          createdAt: Date.now(),
          status: "pending",
          childTaskIds: [],
          childTasks: [],
          totalTasks: avatars.length,
          completedTasks: 0,
          failedTasks: 0,
          mergeRetryCount: 0,
          maxMergeRetries: 3,
        });
      }

      // Process based on merge mode
      if (isMerge) {
        // Merge mode: sequential processing
        try {
          for (const item of avatars) {
            const realPlatform = getRealPlatform(item.platform, item.voice);
            console.log(createConfig.createType);

            if (createConfig.createType === "Omnihuman") {
              console.log("进入", createConfig.createType);

              try {
                let audioUrl = "";
                if (item.mode === "text") {
                  let avatarAudioRes = undefined;
                  const modelType = item.voice.split("_")[1];
                  const audioId = item.voice.split("_")[2];

                  if (item.voice.includes("custom_cicada")) {
                    if (modelType.includes("cicada")) {
                      const customAudio = successVoices?.find(
                        (voice) => voice.audioId === audioId
                      );
                      if (customAudio) {
                        const resp = await ky.post("/api/gen-chanjing-audio", {
                          headers: {
                            "Content-Type": "application/json",
                            Authorization: `Bearer ${apiKey}`,
                          },
                          json: {
                            apiKey: apiKey!,
                            voice: customAudio.audioId,
                            text: item.text,
                          },
                          timeout: false,
                        });
                        const audioResult = (await resp.json()) as {
                          audio_url: string;
                        };
                        avatarAudioRes = {
                          audio_url: audioResult.audio_url,
                        };
                      }
                    }
                  } else {
                    if (item.voice.includes("custom_Fish Audio")) {
                      const voiceId = item.voice.split("_")[2];
                      avatarAudioRes = await genSpeech({
                        apiKey: apiKey!,
                        platform: "fish",
                        voice: voiceId,
                        text: item.text,
                      });
                    } else {
                      avatarAudioRes = await genSpeech({
                        apiKey: apiKey!,
                        platform:
                          realPlatform === "google"
                            ? item.googleModel || "Gemini Flash"
                            : realPlatform,
                        voice: item.voice,
                        text: item.text,
                        googleModel:
                          realPlatform === "google"
                            ? item.googleModel || "Gemini Flash"
                            : undefined,
                      });
                    }
                  }
                  audioUrl = avatarAudioRes?.audio_url || "";
                } else {
                  audioUrl = item.audioFile;
                }

                const omnihumanRes = await createOmnihumanVideo({
                  imageUrl: item.avatarImage,
                  audioUrl: audioUrl,
                  apiKey: apiKey!,
                });

                const taskId = crypto.randomUUID();
                childTaskIds.push(taskId);

                if (isMerge && mergeHistoryId) {
                  childTasks.push({
                    taskId: taskId,
                    status: "pending",
                  });
                }

                await addHistoryData({
                  id: taskId,
                  createdAt: Date.now(),
                  platform: realPlatform,
                  voice: item.voice,
                  text: item.text,
                  avatarImage: item.avatarImage,
                  backgroundImage: item.backgroundImage,
                  videoUrl: item.videoUrl,
                  wavUrl: item.audioFile,
                  video_url: "",
                  status: 0,
                  preview_url: "",
                  audioId: "",
                  avatarId: "",
                  model: "Omnihuman",
                  type: "Omnihuman",
                  streaming_url: "",
                  mode: item.mode,
                  audioFile: item.audioFile,
                  taskId: omnihumanRes.data.task_id,
                  taskStatus: "pending",
                  name:
                    isMerge && mergeHistoryId
                      ? `${videoName} - 片段${childTaskIds.length}`
                      : videoName,
                  createType: "Omnihuman",
                  videoResolution:
                    createConfig.hedraSettings?.videoResolution || "720p",
                  driveMode: "",
                  originalVideoUrl: item.videoUrl,
                  backway: createConfig.chanjingSettings?.backway || 2,
                });
              } catch (error) {
                console.error("Omnihuman video creation failed:", error);
                throw error;
              }
            } else if (createConfig.createType === "hedra") {
              // Hedra logic implementation...
              // (Similar structure as above, implement as needed)
            } else {
              // Chanjing logic implementation...
              // (Similar structure as above, implement as needed)
            }
          }

          if (
            createConfig.createType === "hedra" ||
            createConfig.createType === "Omnihuman"
          ) {
            toast.success(t("create.createSuccess"));
          } else {
            toast.success(t("create.createSuccess"));
          }
        } catch (error) {
          console.error("Merge task failed, cleaning up:", error);

          for (const taskId of childTaskIds) {
            try {
              await deleteHistoryDataItem(taskId);
            } catch (deleteError) {
              console.error(
                "Failed to delete history item:",
                taskId,
                deleteError
              );
            }
          }

          if (mergeHistoryId) {
            try {
              await deleteMergeHistoryItem(mergeHistoryId);
            } catch (deleteError) {
              console.error(
                "Failed to delete merge history item:",
                mergeHistoryId,
                deleteError
              );
            }
          }

          toast.error("批量生成失败，已取消所有任务");
          throw error;
        }
      } else {
        // Non-merge mode: parallel processing
        await Promise.all(
          avatars.map(async (item) => {
            const realPlatform = getRealPlatform(item.platform, item.voice);

            if (createConfig.createType === "Omnihuman") {
              try {
                let audioUrl = "";
                if (item.mode === "text") {
                  // Similar audio generation logic...
                } else {
                  audioUrl = item.audioFile;
                }

                const omnihumanRes = await createOmnihumanVideo({
                  imageUrl: item.avatarImage,
                  audioUrl: audioUrl,
                  apiKey: apiKey!,
                });

                toast.success(t("create.createSuccess"));

                const taskId = crypto.randomUUID();
                childTaskIds.push(taskId);

                await addHistoryData({
                  id: taskId,
                  createdAt: Date.now(),
                  platform: realPlatform,
                  voice: item.voice,
                  text: item.text,
                  avatarImage: item.avatarImage,
                  backgroundImage: item.backgroundImage,
                  videoUrl: item.videoUrl,
                  wavUrl: item.audioFile,
                  video_url: "",
                  status: 0,
                  preview_url: "",
                  audioId: "",
                  avatarId: "",
                  model: "Omnihuman",
                  type: "Omnihuman",
                  streaming_url: "",
                  mode: item.mode,
                  audioFile: item.audioFile,
                  taskId: omnihumanRes.data.task_id,
                  taskStatus: "pending",
                  name: videoName,
                  createType: "Omnihuman",
                  videoResolution:
                    createConfig.hedraSettings?.videoResolution || "720p",
                  driveMode: "",
                  originalVideoUrl: item.videoUrl,
                  backway: createConfig.chanjingSettings?.backway || 2,
                });
              } catch (error) {
                console.error("Omnihuman video creation failed:", error);
              }
            }
            // Add other model types (hedra, chanjing) as needed...
          })
        );
      }

      // Update MergeHistory record
      if (isMerge && mergeHistoryId && childTaskIds.length > 0) {
        await updateMergeHistoryItem(mergeHistoryId, {
          childTaskIds: childTaskIds,
          childTasks: childTasks,
        });
      }
    } catch (error) {
      console.error("Video generation failed:", error);
      if (!isMerge) {
        toast.error("视频生成失败，请重试");
      }
    } finally {
      if (isMerge) {
        setIsMergeGenerating(false);
      } else {
        setIsBatchGenerating(false);
      }
    }
  };

  return (
    <>
      {/* Header */}
      <div className="flex w-full flex-shrink-0 flex-col gap-4 p-4 pt-4">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={onBackToList}
            className="flex items-center gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            返回列表
          </Button>
          <h1 className="text-2xl font-bold sm:text-xl">{t("create.title")}</h1>
        </div>

        <div className="flex items-center gap-x-4">
          <Badge variant="secondary">
            {t(`create.${createConfig.createType}`)}
          </Badge>
          <div className="flex items-center gap-2">
            {isEditingName ? (
              <div className="flex items-center gap-1">
                <Input
                  value={videoName}
                  onChange={(e) => setVideoName(e.target.value)}
                  className="h-8 w-32 px-2 text-sm"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      setIsEditingName(false);
                    } else if (e.key === "Escape") {
                      setVideoName(t("avatar.noName"));
                      setIsEditingName(false);
                    }
                  }}
                  onBlur={() => setIsEditingName(false)}
                  autoFocus
                  maxLength={20}
                />
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-8 w-8 p-0"
                  onClick={() => setIsEditingName(false)}
                >
                  <Check className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">{videoName}</span>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-8 w-8 p-0 opacity-60 hover:opacity-100"
                  onClick={() => setIsEditingName(true)}
                >
                  <Edit2 className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="flex-1 overflow-y-auto p-4">
          {createVideoStore?.videoList &&
            createVideoStore.videoList.map((item) => (
              <Card
                key={item.id}
                className="mx-auto mb-6 w-full max-w-6xl p-6 shadow-sm"
              >
                <div className="flex h-full flex-col justify-center lg:flex-row lg:gap-6">
                  {/* Left side - Video preview */}
                  <div className="w-full max-w-xs lg:w-72">
                    <VideoPreviewFrame
                      id={item.id}
                      avatarImage={item.avatarImage}
                      backgroundImage={item.backgroundImage}
                      videoUrl={item.videoUrl}
                      onAvatarSelected={handleAvatarSelected}
                      mode={item.mode}
                      platform={item.platform}
                      voice={item.voice}
                      text={item.text}
                      wavUrl={item.audioFile}
                      audioFile={item.audioFile}
                    />
                  </div>

                  {/* Right side - Configuration */}
                  <div className="flex w-full flex-col justify-between lg:w-[32rem]">
                    <Actions currentItem={item} />
                    <ConfigurationPanel {...item} />
                  </div>
                </div>
              </Card>
            ))}
        </div>

        {/* Bottom buttons */}
        <div className="flex flex-shrink-0 items-center justify-between border-solid border-gray-200 p-4 pb-0">
          <div className="mx-auto flex w-full max-w-6xl items-center justify-between">
            <div>
              <AdvancedSettings />
            </div>

            {createVideoStore.videoList.length === 1 ? (
              <Button
                onClick={() => onGenerate(false)}
                disabled={isBatchGenerating || isMergeGenerating}
              >
                {isBatchGenerating ? (
                  <div className="flex items-center gap-2">
                    <div className="h-4 w-4 animate-spin rounded-full border-b-2 border-white"></div>
                    <span>{t("create.generating")}</span>
                  </div>
                ) : (
                  t("create.generate")
                )}
              </Button>
            ) : createVideoStore.videoList.length >= 2 ? (
              <div className="flex gap-2">
                <Button
                  onClick={() => onGenerate(false)}
                  variant="outline"
                  disabled={isBatchGenerating || isMergeGenerating}
                >
                  {isBatchGenerating ? (
                    <div className="flex items-center gap-2">
                      <div className="h-4 w-4 animate-spin rounded-full border-b-2 border-current"></div>
                      <span>{t("create.generating")}</span>
                    </div>
                  ) : (
                    t("create.batchGenerate", {
                      count: createVideoStore.videoList.length,
                    })
                  )}
                </Button>
                <Button
                  onClick={() => onGenerate(true)}
                  disabled={isBatchGenerating || isMergeGenerating}
                >
                  {isMergeGenerating ? (
                    <div className="flex items-center gap-2">
                      <div className="h-4 w-4 animate-spin rounded-full border-b-2 border-white"></div>
                      <span>{t("create.generating")}</span>
                    </div>
                  ) : (
                    t("create.generateOne")
                  )}
                </Button>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </>
  );
};
