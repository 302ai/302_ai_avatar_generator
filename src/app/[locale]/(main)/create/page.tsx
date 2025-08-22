"use client";
import React, { useCallback, useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { VideoPreviewFrame, ConfigurationPanel } from "./components";
import { appConfigAtom, store } from "@/stores";
import { useAtom } from "jotai";
import { voiceStoreAtom } from "@/stores/slices/voice_store";
import { voices, VoiceOption } from "@/constants/voices";
import { useTranslations } from "next-intl";
import { createVideoStoreAtom } from "@/stores/slices/create_video";
import Actions from "./components/actions";
import { createConfigAtom } from "@/stores/slices/create_config";
import {
  welcomeModalStoreAtom,
  openWelcomeModalAtom,
  closeWelcomeModalAtom,
  clearPresetDataAtom,
} from "@/stores/slices/welcome_modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { createAvatar } from "@/services/create-avatar";
import { Edit2, Check, X, ArrowLeft, Plus, Info } from "lucide-react";
import { genSpeech } from "@/services/gen-speech";
import { createAudio } from "@/services/create-audio";
import { createVideo } from "@/services/gen-video";
import { useHistoryDb } from "@/hooks/db/use-db";
import { createHedraVideo } from "@/services/gen-hedra-video";
import { createOmnihumanVideo } from "@/services/gen-omnihuman-video";
import { createTopviewVideo } from "@/services/create-topview-video";
import { createStableVideo } from "@/services/create-stable-video";
import { createLatentsyncVideo } from "@/services/create-latentsync-video";
import { pollLatentsyncVideo } from "@/services/poll-latentsync-video";
import { AdvancedSettings } from "./components/AdvancedSettings";
import { toast } from "sonner";
import { useFavoriteVoice } from "@/hooks/db/use-favorite-voice";
import { useCustomVoiceDb } from "@/hooks/db/use-custom-voice";
import ky from "ky";
// History related imports
import {
  Play,
  Download,
  EllipsisVertical,
  FolderPen,
  RotateCcw,
  Trash2,
} from "lucide-react";
import Image from "next/image";
import { VideoPlayerModal } from "./components/VideoPlayerModal";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { useRouter, useParams } from "next/navigation";
import { mergeVideo } from "@/services/merge-video";
import { pollMergeVideo } from "@/services/poll-merge-video";
import { pollOmnihumanVideo } from "@/services/gen-omnihuman-video";
import { pollTopviewVideo } from "@/services/poll-topview-video";
import { pollStableVideo } from "@/services/poll-stable-video";
import { db } from "@/db";

const CreatePage = () => {
  const t = useTranslations();
  const router = useRouter();
  const params = useParams();
  const { apiKey } = store.get(appConfigAtom);
  const [voiceStore, setVoiceStore] = useAtom(voiceStoreAtom);
  const [createVideoStore, setCreateVideoStore] = useAtom(createVideoStoreAtom);
  const { favoriteVoices } = useFavoriteVoice();
  const { successVoices } = useCustomVoiceDb();

  // Welcome modal state
  const [welcomeModalStore] = useAtom(welcomeModalStoreAtom);
  const [, openWelcomeModal] = useAtom(openWelcomeModalAtom);
  const [, closeWelcomeModal] = useAtom(closeWelcomeModalAtom);
  const [, clearPresetData] = useAtom(clearPresetDataAtom);

  // View state management
  const [currentView, setCurrentView] = useState<"list" | "create">("list");
  const [welcomeModalWasOpen, setWelcomeModalWasOpen] = useState(false);

  // 页面挂载时的初始状态调试和处理
  useEffect(() => {
    console.log("🚀 Create page mounted with initial state:", {
      currentView,
      createType: createConfig.createType,
      modalIsOpen: welcomeModalStore.isOpen,
      presetData: welcomeModalStore.presetData,
      timestamp: new Date().toLocaleTimeString(),
    });

    // 检查是否刚从其他页面导航过来且有有效的createType和外部来源标识
    const hasValidCreateType =
      createConfig.createType === "chanjing" ||
      createConfig.createType === "hedra" ||
      createConfig.createType === "Omnihuman" ||
      createConfig.createType === "TopView" ||
      createConfig.createType === "stable" ||
      createConfig.createType === "latentsync";

    const isFromExternalSource =
      welcomeModalStore.presetData?.source === "voice" ||
      welcomeModalStore.presetData?.source === "avatar";

    // 如果有有效的createType且来自外部页面（声音库或数字人），自动切换到创建视图
    if (hasValidCreateType && isFromExternalSource) {
      setCurrentView("create");
      // 清除预设数据，避免后续误判
      setTimeout(() => {
        console.log("🧹 Clearing preset data after navigation");
        clearPresetData();
      }, 100);
    }
  }, []); // 只在组件挂载时运行一次

  // History related states
  const [companyFilter, setCompanyFilter] = useState<
    | "all"
    | "chanjing"
    | "hedra"
    | "Omnihuman"
    | "TopView"
    | "stable"
    | "latentsync"
  >("all");
  const {
    historyData,
    updateHistoryDataItem,
    deleteHistoryDataItem,
    mergeHistoryData,
    updateMergeHistoryItem,
    deleteMergeHistoryItem,
    findMergeHistoryByChildTask,
  } = useHistoryDb();
  const [videoDialogOpen, setVideoDialogOpen] = useState(false);
  const [currentVideoUrl, setCurrentVideoUrl] = useState<string | null>(null);

  // 跟踪正在轮询的任务ID，避免重复请求
  const [pollingTasks, setPollingTasks] = useState<Set<string>>(new Set());

  // 跟踪已处理的任务，防止重复处理
  const [processedTasks, setProcessedTasks] = useState<Set<string>>(new Set());

  // 编辑状态管理
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState<string>("");
  const [editingIsMergeTask, setEditingIsMergeTask] = useState(false);

  // 获取真实平台信息的工具函数
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

  // 视频名称状态
  const [videoName, setVideoName] = useState(t("avatar.noName"));
  const [isEditingName, setIsEditingName] = useState(false);

  // 生成loading状态
  const [isBatchGenerating, setIsBatchGenerating] = useState(false);
  const [isMergeGenerating, setIsMergeGenerating] = useState(false);

  // 处理头像选择
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

      // 优先使用传递的platform，如果没有则从voice字符串解析platform
      let platform = avatar.platform || "";
      let voiceId = avatar.voice;
      const googleModel = avatar.googleModel;

      // 只有在没有传递platform时才进行字符串解析
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
  const [createConfig, setCreateConfig] = useAtom(createConfigAtom);

  const { addHistoryData, addMergeHistoryData } = useHistoryDb();
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

      // 如果是批量完整生成，先创建MergeHistory记录
      if (isMerge && avatars.length > 1) {
        mergeHistoryId = crypto.randomUUID();
        await addMergeHistoryData({
          id: mergeHistoryId,
          name: videoName,
          createdAt: Date.now(),
          status: "pending",
          childTaskIds: [], // 先为空，后面会更新
          childTasks: [], // 初始化为空数组，后面会更新
          totalTasks: avatars.length,
          completedTasks: 0,
          failedTasks: 0,
          mergeRetryCount: 0, // 初始重试计数为0
          maxMergeRetries: 3, // 最大重试3次
        });
      }

      // 根据是否为合并模式选择不同的处理方式
      if (isMerge) {
        // 合并模式：顺序处理，任何失败都停止
        try {
          for (const item of avatars) {
            // 获取真实的平台信息
            const realPlatform = getRealPlatform(item.platform, item.voice);
            console.log(createConfig.createType);

            if (createConfig.createType === "Omnihuman") {
              console.log("进入", createConfig.createType);

              // Omnihuman 逻辑：只需要 image_url 和 audio_url
              try {
                // 获取音频URL
                let audioUrl = "";
                if (item.mode === "text") {
                  // 文本模式：生成语音
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
                  // 音频模式：直接使用提供的音频文件URL
                  audioUrl = item.audioFile;
                }

                // 调用 Omnihuman API
                const omnihumanRes = await createOmnihumanVideo({
                  imageUrl: item.avatarImage,
                  audioUrl: audioUrl,
                  apiKey: apiKey!,
                });

                // 保存Omnihuman视频任务到数据库，状态为pending等待轮询
                const taskId = crypto.randomUUID();
                childTaskIds.push(taskId);

                // 如果是合并任务，添加到childTasks数组
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
                  video_url: "", // 初始为空，轮询成功后填充
                  status: 0, // 初始状态
                  preview_url: "", // 初始为空，轮询成功后填充
                  audioId: "",
                  avatarId: "",
                  model: "Omnihuman",
                  type: "Omnihuman",
                  streaming_url: "", // 初始为空，轮询成功后填充
                  mode: item.mode,
                  audioFile: item.audioFile,
                  taskId: omnihumanRes.data.task_id, // 保存任务ID用于轮询
                  taskStatus: "pending", // 设置为pending状态
                  name:
                    isMerge && mergeHistoryId
                      ? `${videoName} - 片段${childTaskIds.length}`
                      : videoName, // 如果是合并任务，添加片段标识
                  createType: "Omnihuman",
                  videoResolution: "720p", // omnihuman不使用videoResolution，设置默认值
                  driveMode: "", // omnihuman不使用driveMode
                  originalVideoUrl: item.videoUrl, // 保存原始数字人视频URL
                  backway: createConfig.chanjingSettings?.backway || 2,
                });
              } catch (error) {
                console.error("Omnihuman video creation failed:", error);
                throw error;
              }
            } else if (createConfig.createType === "TopView") {
              // TopView logic:只需要 video_url 和 audio_url
              try {
                // 获取音频URL
                let audioUrl = "";
                if (item.mode === "text") {
                  // 文本模式：生成语音
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
                  // 音频模式：直接使用提供的音频文件URL
                  audioUrl = item.audioFile;
                }

                // 调用 TopView API
                const topviewRes = await createTopviewVideo({
                  apiKey: apiKey!,
                  videoUrl: item.videoUrl,
                  audioUrl: audioUrl,
                });

                // 保存TopView视频任务到数据库，状态为pending等待轮询
                const taskId = crypto.randomUUID();
                childTaskIds.push(taskId);

                // 如果是合并任务，添加到childTasks数组
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
                  video_url: "", // 初始为空，轮询成功后填充
                  status: 0, // 初始状态
                  preview_url: "", // 初始为空，轮询成功后填充
                  audioId: "",
                  avatarId: "",
                  model: "TopView",
                  type: "TopView",
                  streaming_url: "", // 初始为空，轮询成功后填充
                  mode: item.mode,
                  audioFile: item.audioFile,
                  taskId: topviewRes.taskId, // 保存任务ID用于轮询
                  taskStatus: "pending", // 设置为pending状态
                  name:
                    isMerge && mergeHistoryId
                      ? `${videoName} - 片段${childTaskIds.length}`
                      : videoName, // 如果是合并任务，添加片段标识
                  createType: "TopView",
                  videoResolution: "720p", // topview不使用videoResolution，设置默认值
                  driveMode: "", // topview不使用driveMode
                  originalVideoUrl: item.videoUrl, // 保存原始数字人视频URL
                  backway: createConfig.chanjingSettings?.backway || 2,
                });
              } catch (error) {
                console.error("TopView video creation failed:", error);
                throw error;
              }
            } else if (createConfig.createType === "stable") {
              // Stable logic:只需要 image_url 和 audio_url
              try {
                // 获取音频URL
                let audioUrl = "";
                if (item.mode === "text") {
                  // 文本模式：生成语音
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
                  // 音频模式：直接使用提供的音频文件URL
                  audioUrl = item.audioFile;
                }

                // 调用 Stable API
                const stableRes = await createStableVideo({
                  imageUrl: item.avatarImage,
                  audioUrl: audioUrl,
                  apiKey: apiKey!,
                });

                // 保存Stable视频任务到数据库，状态为pending等待轮询
                const taskId = crypto.randomUUID();
                childTaskIds.push(taskId);

                // 如果是合并任务，添加到childTasks数组
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
                  video_url: "", // 初始为空，轮询成功后填充
                  status: 0, // 初始状态
                  preview_url: "", // 初始为空，轮询成功后填充
                  audioId: "",
                  avatarId: "",
                  model: "stable",
                  type: "stable",
                  streaming_url: "", // 初始为空，轮询成功后填充
                  mode: item.mode,
                  audioFile: item.audioFile,
                  taskId: stableRes.taskId, // 保存任务ID用于轮询
                  taskStatus: "pending", // 设置为pending状态
                  name:
                    isMerge && mergeHistoryId
                      ? `${videoName} - 片段${childTaskIds.length}`
                      : videoName, // 如果是合并任务，添加片段标识
                  createType: "stable",
                  videoResolution: "720p", // stable不使用videoResolution，设置默认值
                  driveMode: "", // stable不使用driveMode
                  originalVideoUrl: item.videoUrl, // 保存原始数字人视频URL
                  backway: createConfig.chanjingSettings?.backway || 2,
                });
              } catch (error) {
                console.error("Stable video creation failed:", error);
                throw error;
              }
            } else if (createConfig.createType === "latentsync") {
              // Latentsync logic:只需要 image_url 和 audio_url
              try {
                // 获取音频URL
                let audioUrl = "";
                if (item.mode === "text") {
                  // 文本模式：生成语音
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
                  // 音频模式：直接使用提供的音频文件URL
                  audioUrl = item.audioFile;
                }

                // 调用 Latentsync API
                const latentsyncRes = await createLatentsyncVideo({
                  videoUrl: item.videoUrl,
                  audioUrl: audioUrl,
                  apiKey: apiKey!,
                });

                // 保存Latentsync视频任务到数据库，状态为pending等待轮询
                const taskId = crypto.randomUUID();
                childTaskIds.push(taskId);

                // 如果是合并任务，添加到childTasks数组
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
                  video_url: "", // 初始为空，轮询成功后填充
                  status: 0, // 初始状态
                  preview_url: "", // 初始为空，轮询成功后填充
                  audioId: "",
                  avatarId: "",
                  model: "latentsync",
                  type: "latentsync",
                  streaming_url: "", // 初始为空，轮询成功后填充
                  mode: item.mode,
                  audioFile: item.audioFile,
                  taskId: latentsyncRes.taskId, // 保存任务ID用于轮询
                  taskStatus: "pending", // 设置为pending状态
                  name:
                    isMerge && mergeHistoryId
                      ? `${videoName} - 片段${childTaskIds.length}`
                      : videoName, // 如果是合并任务，添加片段标识
                  createType: "latentsync",
                  videoResolution: "720p", // latentsync不使用videoResolution，设置默认值
                  driveMode: "", // latentsync不使用driveMode
                  originalVideoUrl: item.videoUrl, // 保存原始数字人视频URL
                  backway: createConfig.chanjingSettings?.backway || 2,
                });
              } catch (error) {
                console.error("Latentsync video creation failed:", error);
                throw error;
              }
            } else if (createConfig.createType === "hedra") {
              let audioFile = undefined;
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
                          text: "你好！自从遇见302.AI，我便拥有了一个不可思议的数字声音分身。它精准地还原了我的每一个声音细节——从独特的音色、自然的语调，到说话时的呼吸节奏，甚至是那些不经意的停顿。无论我身在何处，我的数字分身都能替我传递最真实的声音，如同我本人在场。它就像一面通透的声音之镜，清晰映照出我最本真的表达。这种前所未有的体验，让我真正感受到了声音的无限可能，真是太令人惊喜了！",
                        },
                        timeout: false,
                      });
                      const audioUrl = (await resp.json()) as {
                        audio_url: string;
                      };

                      avatarAudioRes = {
                        audio_url: audioUrl.audio_url,
                      };
                    }
                  }
                } else {
                  if (item.voice.includes("custom_Fish Audio")) {
                    const voiceId = item.voice.split("_")[2];
                    console.log("voiceId", voiceId);

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
                const audioUrl = avatarAudioRes?.audio_url || "";
                const audioResponse = await fetch(audioUrl);
                const audioBlob = await audioResponse.blob();
                audioFile = new File([audioBlob], "audio.wav", {
                  type: "audio/wav",
                });
              } else {
                audioFile = item.audioFile;
                // 将URL转换为File对象
                const audioResponse = await fetch(audioFile);
                const audioBlob = await audioResponse.blob();
                audioFile = new File([audioBlob], "audio.wav", {
                  type: "audio/wav",
                });
              }
              try {
                // 将URL转换为File对象
                const imageResponse = await fetch(item.avatarImage);
                const imageBlob = await imageResponse.blob();
                const imageFile = new File([imageBlob], "avatar.jpg", {
                  type: "image/jpeg",
                });
                const hedraRes: any = await createHedraVideo({
                  apiKey: apiKey!,
                  audioFile: audioFile,
                  text: item.text,
                  imageFile: imageFile,
                  resolution:
                    createConfig.hedraSettings?.videoResolution || "720p",
                  originalPlatform: realPlatform, // 传递真实平台信息
                });

                // 保存hedra视频任务到数据库，状态为pending等待轮询
                const taskId = crypto.randomUUID();
                childTaskIds.push(taskId);

                // 如果是合并任务，添加到childTasks数组
                if (isMerge && mergeHistoryId) {
                  childTasks.push({
                    taskId: taskId,
                    status: "pending",
                  });
                }

                await addHistoryData({
                  id: taskId,
                  createdAt: Date.now(),
                  platform: hedraRes.platform,
                  voice: item.voice,
                  text: item.text,
                  avatarImage: item.avatarImage,
                  backgroundImage: item.backgroundImage,
                  videoUrl: item.videoUrl, // 保存原始数字人视频URL
                  wavUrl: audioFile as any,
                  video_url: "", // 初始为空，轮询成功后填充
                  status: 0, // 初始状态
                  preview_url: "", // 初始为空，轮询成功后填充
                  audioId: hedraRes.hedra_data.audio_id,
                  avatarId: hedraRes.hedra_data.start_keyframe_id,
                  model: "hedra",
                  type: hedraRes.type,
                  streaming_url: "", // 初始为空，轮询成功后填充
                  hedra_data: hedraRes.hedra_data,
                  mode: item.mode,
                  audioFile: audioFile as any,
                  taskId: hedraRes.taskId as any, // 保存任务ID用于轮询
                  taskStatus: "pending", // 设置为pending状态
                  name:
                    isMerge && mergeHistoryId
                      ? `${videoName} - 片段${childTaskIds.length}`
                      : videoName, // 如果是合并任务，添加片段标识
                  // 新增的创建配置参数
                  createType: "hedra",
                  videoResolution:
                    createConfig.hedraSettings?.videoResolution || "720p",
                  driveMode: "", // hedra不使用driveMode
                  originalVideoUrl: item.videoUrl, // 保存原始数字人视频URL
                  backway: createConfig.chanjingSettings?.backway || 2,
                });
              } catch (error) {
                console.error("Hedra video creation failed:", error);
              }
            } else {
              try {
                let audioId = "";
                let personId = "";
                let type = "";
                if (item.mode === "text") {
                  type = "tts";

                  const avatarRes = await createAvatar({
                    apiKey: apiKey!,
                    platform: realPlatform,
                    voice: item.voice,
                    videoUrl: item.videoUrl,
                  });

                  if (
                    !avatarRes ||
                    !avatarRes.results ||
                    !avatarRes.results.avatarId
                  ) {
                    throw new Error(
                      "Failed to create avatar - invalid response"
                    );
                  }
                  let avatarAudioRes = undefined;
                  const modelType = item.voice.split("_")[1];
                  let audioId = item.voice.split("_")[2];
                  // 生成语音
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
                            text: "你好！自从遇见302.AI，我便拥有了一个不可思议的数字声音分身。它精准地还原了我的每一个声音细节——从独特的音色、自然的语调，到说话时的呼吸节奏，甚至是那些不经意的停顿。无论我身在何处，我的数字分身都能替我传递最真实的声音，如同我本人在场。它就像一面通透的声音之镜，清晰映照出我最本真的表达。这种前所未有的体验，让我真正感受到了声音的无限可能，真是太令人惊喜了！",
                          },
                          timeout: false,
                        });
                        const audioUrl = (await resp.json()) as {
                          audio_url: string;
                        };

                        avatarAudioRes = {
                          audio_url: audioUrl.audio_url,
                        };
                      }
                    }
                  } else {
                    if (item.voice.includes("custom_Fish Audio")) {
                      const voiceId = item.voice.split("_")[2];
                      console.log("voiceId", voiceId);

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
                  const audioUrl = avatarAudioRes?.audio_url || "";

                  // 创建音频
                  const audioRes = await createAudio({
                    apiKey: apiKey!,
                    audioUrl: audioUrl,
                  });
                  audioId = audioRes.data.id;
                  personId = avatarRes.results.avatarId;
                } else {
                  type = "audio";

                  // 创建音频
                  const audioRes = await createAudio({
                    apiKey: apiKey!,
                    audioUrl: item.audioFile,
                  });
                  audioId = audioRes.data.id;

                  const avatarRes = await createAvatar({
                    apiKey: apiKey!,
                    platform: realPlatform,
                    voice: audioId,
                    videoUrl: item.videoUrl,
                  });

                  if (
                    !avatarRes ||
                    !avatarRes.results ||
                    !avatarRes.results.avatarId
                  ) {
                    throw new Error(
                      "Failed to create avatar - invalid response"
                    );
                  }

                  personId = avatarRes.results.avatarId;
                }
                const videoRes = await createVideo({
                  apiKey: apiKey!,
                  personId: personId,
                  audioId: audioId,
                  text: item.text,
                  wavUrl: item.audioFile,
                  driveMode: createConfig.chanjingSettings?.driveMode || "",
                  backway: createConfig.chanjingSettings?.backway || 2,
                  subtitleConfig: item.subtitleConfig,
                  type: type,
                });
                if (videoRes.msg === "success") {
                  toast.success(t("create.createSuccess"));
                  // 成功后返回到列表视图
                  const taskId = crypto.randomUUID();
                  childTaskIds.push(taskId);

                  // 如果是合并任务，添加到childTasks数组
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
                    video_url: "",
                    status: 0,
                    preview_url: "",
                    audioId: audioId,
                    avatarId: personId,
                    wavUrl: item.audioFile,
                    mode: item.mode,
                    audioFile: item.audioFile,
                    taskId: videoRes.data,
                    taskStatus: "pending",
                    model: "chanjing",
                    name:
                      isMerge && mergeHistoryId
                        ? `${videoName} - 片段${childTaskIds.length}`
                        : videoName, // 如果是合并任务，添加片段标识
                    // 新增的创建配置参数
                    createType: "chanjing",
                    videoResolution: "720p", // chanjing不使用videoResolution，设置默认值
                    driveMode: createConfig.chanjingSettings?.driveMode || "",
                    originalVideoUrl: item.videoUrl, // 保存原始数字人视频URL
                    backway: createConfig.chanjingSettings?.backway || 2,
                  });
                  setCurrentView("list");
                } else {
                  // 处理API返回错误的情况
                  toast.error(`视频生成失败: ${videoRes.msg || "未知错误"}`);
                  throw new Error(`Video creation failed: ${videoRes.msg}`);
                }

                // // 保存到history数据库中，每次生成都使用新的唯一ID
                // await addHistoryData({
                //   id: crypto.randomUUID(),
                //   createdAt: Date.now(),
                //   platform: item.platform,
                //   voice: item.voice,
                //   text: item.text,
                //   avatarImage: item.avatarImage,
                //   backgroundImage: item.backgroundImage,
                //   videoUrl: item.videoUrl,
                //   video_url: video_url,
                //   status: status,
                //   preview_url: preview_url,
                //   audioId: audioId,
                //   avatarId: personId,
                //   wavUrl: item.audioFile,
                //   mode: item.mode,
                //   audioFile: item.audioFile,
                // });
              } catch (error) {
                console.error(
                  "Error creating avatar for",
                  realPlatform + ":",
                  error
                );
                // 在merge模式下，任何失败都抛出错误
                throw error;
              }
            }
          }

          // 合并模式：所有任务创建完成后的成功提示
          if (
            createConfig.createType === "hedra" ||
            createConfig.createType === "Omnihuman" ||
            createConfig.createType === "TopView" ||
            createConfig.createType === "stable" ||
            createConfig.createType === "latentsync"
          ) {
            toast.success(t("create.createSuccess"));
            // 成功后返回到列表视图
            setCurrentView("list");
          } else {
            toast.success(t("create.createSuccess"));
            // 成功后返回到列表视图
            setCurrentView("list");
          }
        } catch (error) {
          // 合并模式下的错误处理：清理已创建的记录
          console.error("Merge task failed, cleaning up:", error);

          // 删除已创建的子任务记录
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

          // 删除合并任务记录
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

          // 在合并模式下显示特定的错误信息
          toast.error("批量生成失败，已取消所有任务");
          throw error; // 重新抛出错误，让外层catch处理
        }
      } else {
        // 非合并模式：并行处理，允许部分失败
        await Promise.all(
          avatars.map(async (item) => {
            // 获取真实的平台信息
            const realPlatform = getRealPlatform(item.platform, item.voice);

            if (createConfig.createType === "Omnihuman") {
              // Omnihuman 逻辑：只需要 image_url 和 audio_url
              try {
                // 获取音频URL
                let audioUrl = "";
                if (item.mode === "text") {
                  // 文本模式：生成语音
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
                  // 音频模式：直接使用提供的音频文件URL
                  audioUrl = item.audioFile;
                }

                // 调用 Omnihuman API
                const omnihumanRes = await createOmnihumanVideo({
                  imageUrl: item.avatarImage,
                  audioUrl: audioUrl,
                  apiKey: apiKey!,
                });

                // 非merge模式：Omnihuman任务创建成功提示
                toast.success(t("create.createSuccess"));
                // 成功后返回到列表视图

                // 保存Omnihuman视频任务到数据库，状态为pending等待轮询
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
                  video_url: "", // 初始为空，轮询成功后填充
                  status: 0, // 初始状态
                  preview_url: "", // 初始为空，轮询成功后填充
                  audioId: "",
                  avatarId: "",
                  model: "Omnihuman",
                  type: "Omnihuman",
                  streaming_url: "", // 初始为空，轮询成功后填充
                  mode: item.mode,
                  audioFile: item.audioFile,
                  taskId: omnihumanRes.data.task_id, // 保存任务ID用于轮询
                  taskStatus: "pending", // 设置为pending状态
                  name: videoName,
                  createType: "Omnihuman",
                  videoResolution: "720p", // omnihuman不使用videoResolution，设置默认值
                  driveMode: "", // omnihuman不使用driveMode
                  originalVideoUrl: item.videoUrl, // 保存原始数字人视频URL
                  backway: createConfig.chanjingSettings?.backway || 2,
                });
                setCurrentView("list");
              } catch (error) {
                console.error("Omnihuman video creation failed:", error);
              }
            } else if (createConfig.createType === "TopView") {
              // TopView 逻辑：只需要 video_url 和 audio_url
              try {
                // 获取音频URL
                let audioUrl = "";
                if (item.mode === "text") {
                  // 文本模式：生成语音
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
                  // 音频模式：直接使用提供的音频文件URL
                  audioUrl = item.audioFile;
                }

                // 调用 TopView API
                const topviewRes = await createTopviewVideo({
                  apiKey: apiKey!,
                  videoUrl: item.videoUrl,
                  audioUrl: audioUrl,
                });

                // 非merge模式：TopView任务创建成功提示
                toast.success(t("create.createSuccess"));
                // 成功后返回到列表视图

                // 保存TopView视频任务到数据库，状态为pending等待轮询
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
                  video_url: "", // 初始为空，轮询成功后填充
                  status: 0, // 初始状态
                  preview_url: "", // 初始为空，轮询成功后填充
                  audioId: "",
                  avatarId: "",
                  model: "TopView",
                  type: "TopView",
                  streaming_url: "", // 初始为空，轮询成功后填充
                  mode: item.mode,
                  audioFile: item.audioFile,
                  taskId: topviewRes.taskId, // 保存任务ID用于轮询
                  taskStatus: "pending", // 设置为pending状态
                  name: videoName,
                  createType: "TopView",
                  videoResolution: "720p", // topview不使用videoResolution，设置默认值
                  driveMode: "", // topview不使用driveMode
                  originalVideoUrl: item.videoUrl, // 保存原始数字人视频URL
                  backway: createConfig.chanjingSettings?.backway || 2,
                });
                setCurrentView("list");
              } catch (error) {
                console.error("TopView video creation failed:", error);
              }
            } else if (createConfig.createType === "stable") {
              // Stable 逻辑：只需要 image_url 和 audio_url
              try {
                // 获取音频URL
                let audioUrl = "";
                if (item.mode === "text") {
                  // 文本模式：生成语音
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
                  // 音频模式：直接使用提供的音频文件URL
                  audioUrl = item.audioFile;
                }

                // 调用 Stable API
                const stableRes = await createStableVideo({
                  imageUrl: item.avatarImage,
                  audioUrl: audioUrl,
                  apiKey: apiKey!,
                });

                // 非merge模式：Stable任务创建成功提示
                toast.success(t("create.createSuccess"));
                // 成功后返回到列表视图

                // 保存Stable视频任务到数据库，状态为pending等待轮询
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
                  video_url: "", // 初始为空，轮询成功后填充
                  status: 0, // 初始状态
                  preview_url: "", // 初始为空，轮询成功后填充
                  audioId: "",
                  avatarId: "",
                  model: "stable",
                  type: "stable",
                  streaming_url: "", // 初始为空，轮询成功后填充
                  mode: item.mode,
                  audioFile: item.audioFile,
                  taskId: stableRes.taskId, // 保存任务ID用于轮询
                  taskStatus: "pending", // 设置为pending状态
                  name: videoName,
                  createType: "stable",
                  videoResolution: "720p", // stable不使用videoResolution，设置默认值
                  driveMode: "", // stable不使用driveMode
                  originalVideoUrl: item.videoUrl, // 保存原始数字人视频URL
                  backway: createConfig.chanjingSettings?.backway || 2,
                });
                setCurrentView("list");
              } catch (error) {
                console.error("Stable video creation failed:", error);
              }
            } else if (createConfig.createType === "latentsync") {
              // Latentsync 逻辑：只需要 image_url 和 audio_url
              try {
                // 获取音频URL
                let audioUrl = "";
                if (item.mode === "text") {
                  // 文本模式：生成语音
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
                  // 音频模式：直接使用提供的音频文件URL
                  audioUrl = item.audioFile;
                }

                // 调用 Latentsync API
                const latentsyncRes = await createLatentsyncVideo({
                  videoUrl: item.videoUrl,
                  audioUrl: audioUrl,
                  apiKey: apiKey!,
                });

                // 非merge模式：Latentsync任务创建成功提示
                toast.success(t("create.createSuccess"));
                // 成功后返回到列表视图

                // 保存Latentsync视频任务到数据库，状态为pending等待轮询
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
                  video_url: "", // 初始为空，轮询成功后填充
                  status: 0, // 初始状态
                  preview_url: "", // 初始为空，轮询成功后填充
                  audioId: "",
                  avatarId: "",
                  model: "latentsync",
                  type: "latentsync",
                  streaming_url: "", // 初始为空，轮询成功后填充
                  mode: item.mode,
                  audioFile: item.audioFile,
                  taskId: latentsyncRes.taskId, // 保存任务ID用于轮询
                  taskStatus: "pending", // 设置为pending状态
                  name: videoName,
                  createType: "latentsync",
                  videoResolution: "720p", // latentsync不使用videoResolution，设置默认值
                  driveMode: "", // latentsync不使用driveMode
                  originalVideoUrl: item.videoUrl, // 保存原始数字人视频URL
                  backway: createConfig.chanjingSettings?.backway || 2,
                });
                setCurrentView("list");
              } catch (error) {
                console.error("Latentsync video creation failed:", error);
              }
            } else if (createConfig.createType === "hedra") {
              let audioFile = undefined;
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
                          text: "你好！自从遇见302.AI，我便拥有了一个不可思议的数字声音分身。它精准地还原了我的每一个声音细节——从独特的音色、自然的语调，到说话时的呼吸节奏，甚至是那些不经意的停顿。无论我身在何处，我的数字分身都能替我传递最真实的声音，如同我本人在场。它就像一面通透的声音之镜，清晰映照出我最本真的表达。这种前所未有的体验，让我真正感受到了声音的无限可能，真是太令人惊喜了！",
                        },
                        timeout: false,
                      });
                      const audioUrl = (await resp.json()) as {
                        audio_url: string;
                      };

                      avatarAudioRes = {
                        audio_url: audioUrl.audio_url,
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

                const audioUrl = avatarAudioRes?.audio_url || "";
                const audioResponse = await fetch(audioUrl);
                const audioBlob = await audioResponse.blob();

                audioFile = new File([audioBlob], "audio.wav", {
                  type: "audio/wav",
                });
              } else {
                audioFile = item.audioFile;
                // 将URL转换为File对象
                const audioResponse = await fetch(audioFile);
                const audioBlob = await audioResponse.blob();
                audioFile = new File([audioBlob], "audio.wav", {
                  type: "audio/wav",
                });
              }
              try {
                // 将URL转换为File对象
                const imageResponse = await fetch(item.avatarImage);
                const imageBlob = await imageResponse.blob();
                const imageFile = new File([imageBlob], "avatar.jpg", {
                  type: "image/jpeg",
                });
                const hedraRes: any = await createHedraVideo({
                  apiKey: apiKey!,
                  audioFile: audioFile,
                  text: item.text,
                  imageFile: imageFile,
                  resolution:
                    createConfig.hedraSettings?.videoResolution || "720p",
                  originalPlatform: realPlatform, // 传递真实平台信息
                });

                // 非merge模式：Hedra任务创建成功提示
                toast.success(t("create.createSuccess"));
                // 成功后返回到列表视图

                // 保存hedra视频任务到数据库，状态为pending等待轮询
                const taskId = crypto.randomUUID();
                childTaskIds.push(taskId);

                await addHistoryData({
                  id: taskId,
                  createdAt: Date.now(),
                  platform: hedraRes.platform,
                  voice: item.voice,
                  text: item.text,
                  avatarImage: item.avatarImage,
                  backgroundImage: item.backgroundImage,
                  videoUrl: item.videoUrl, // 保存原始数字人视频URL
                  wavUrl: audioFile as any,
                  video_url: "", // 初始为空，轮询成功后填充
                  status: 0, // 初始状态
                  preview_url: "", // 初始为空，轮询成功后填充
                  audioId: hedraRes.hedra_data.audio_id,
                  avatarId: hedraRes.hedra_data.start_keyframe_id,
                  model: "hedra",
                  type: hedraRes.type,
                  streaming_url: "", // 初始为空，轮询成功后填充
                  hedra_data: hedraRes.hedra_data,
                  mode: item.mode,
                  audioFile: audioFile as any,
                  taskId: hedraRes.taskId as any, // 保存任务ID用于轮询
                  taskStatus: "pending", // 设置为pending状态
                  name: videoName,
                  // 新增的创建配置参数
                  createType: "hedra",
                  videoResolution:
                    createConfig.hedraSettings?.videoResolution || "720p",
                  driveMode: "", // hedra不使用driveMode
                  originalVideoUrl: item.videoUrl, // 保存原始数字人视频URL
                  backway: createConfig.chanjingSettings?.backway || 2,
                });
                setCurrentView("list");
              } catch (error) {
                console.error("Hedra video creation failed:", error);
              }
            } else {
              try {
                let audioId = "";
                let personId = "";
                let type = "";
                if (item.mode === "text") {
                  type = "tts";
                  let avatarAudioRes = undefined;
                  const modelType = item.voice.split("_")[1];
                  audioId = item.voice.split("_")[2];
                  const avatarRes = await createAvatar({
                    apiKey: apiKey!,
                    platform: realPlatform,
                    voice: item.voice,
                    videoUrl: item.videoUrl,
                  });

                  if (
                    !avatarRes ||
                    !avatarRes.results ||
                    !avatarRes.results.avatarId
                  ) {
                    throw new Error(
                      "Failed to create avatar - invalid response"
                    );
                  }
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
                            text: "你好！自从遇见302.AI，我便拥有了一个不可思议的数字声音分身。它精准地还原了我的每一个声音细节——从独特的音色、自然的语调，到说话时的呼吸节奏，甚至是那些不经意的停顿。无论我身在何处，我的数字分身都能替我传递最真实的声音，如同我本人在场。它就像一面通透的声音之镜，清晰映照出我最本真的表达。这种前所未有的体验，让我真正感受到了声音的无限可能，真是太令人惊喜了！",
                          },
                          timeout: false,
                        });
                        const audioUrl = (await resp.json()) as {
                          audio_url: string;
                        };

                        avatarAudioRes = {
                          audio_url: audioUrl,
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
                        text: "你好！自从遇见302.AI，我便拥有了一个不可思议的数字声音分身。它精准地还原了我的每一个声音细节——从独特的音色、自然的语调，到说话时的呼吸节奏，甚至是那些不经意的停顿。无论我身在何处，我的数字分身都能替我传递最真实的声音，如同我本人在场。它就像一面通透的声音之镜，清晰映照出我最本真的表达。这种前所未有的体验，让我真正感受到了声音的无限可能，真是太令人惊喜了！",
                      });
                    } else {
                      avatarAudioRes = await genSpeech({
                        apiKey: apiKey!,
                        platform:
                          realPlatform === "google"
                            ? item.googleModel || "Gemini Flash"
                            : realPlatform,
                        voice: item.voice,
                        text: "你好！自从遇见302.AI，我便拥有了一个不可思议的数字声音分身。它精准地还原了我的每一个声音细节——从独特的音色、自然的语调，到说话时的呼吸节奏，甚至是那些不经意的停顿。无论我身在何处，我的数字分身都能替我传递最真实的声音，如同我本人在场。它就像一面通透的声音之镜，清晰映照出我最本真的表达。这种前所未有的体验，让我真正感受到了声音的无限可能，真是太令人惊喜了！",
                        googleModel:
                          realPlatform === "google"
                            ? item.googleModel || "Gemini Flash"
                            : undefined,
                      });
                    }
                  }

                  const audioUrl = avatarAudioRes?.audio_url || "";
                  // 创建音频
                  const audioRes = await createAudio({
                    apiKey: apiKey!,
                    audioUrl: audioUrl as string,
                  });
                  audioId = audioRes.data.id;
                  console.log("audioId", audioId);
                  personId = avatarRes.results.avatarId;
                } else {
                  type = "audio";

                  // 创建音频
                  const audioRes = await createAudio({
                    apiKey: apiKey!,
                    audioUrl: item.audioFile,
                  });
                  audioId = audioRes.data.id;

                  const avatarRes = await createAvatar({
                    apiKey: apiKey!,
                    platform: realPlatform,
                    voice: audioId,
                    videoUrl: item.videoUrl,
                  });

                  if (
                    !avatarRes ||
                    !avatarRes.results ||
                    !avatarRes.results.avatarId
                  ) {
                    throw new Error(
                      "Failed to create avatar - invalid response"
                    );
                  }

                  personId = avatarRes.results.avatarId;
                }
                console.log("audioIdaudioId", audioId);
                const videoRes = await createVideo({
                  apiKey: apiKey!,
                  personId: personId,
                  audioId: audioId,
                  text: item.text,
                  wavUrl: item.audioFile,
                  driveMode: createConfig.chanjingSettings?.driveMode || "",
                  backway: createConfig.chanjingSettings?.backway || 2,
                  subtitleConfig: item.subtitleConfig,
                  type: type,
                });
                if (videoRes.msg === "success") {
                  toast.success(t("create.createSuccess"));
                  // 成功后返回到列表视图
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
                    video_url: "",
                    status: 0,
                    preview_url: "",
                    audioId: audioId,
                    avatarId: personId,
                    wavUrl: item.audioFile,
                    mode: item.mode,
                    audioFile: item.audioFile,
                    taskId: videoRes.data,
                    taskStatus: "pending",
                    model: "chanjing",
                    name: videoName,
                    // 新增的创建配置参数
                    createType: "chanjing",
                    videoResolution: "720p", // chanjing不使用videoResolution，设置默认值
                    driveMode: createConfig.chanjingSettings?.driveMode || "",
                    originalVideoUrl: item.videoUrl, // 保存原始数字人视频URL
                    backway: createConfig.chanjingSettings?.backway || 2,
                  });
                  setCurrentView("list");
                } else {
                  // 处理API返回错误的情况
                  toast.error(`视频生成失败: ${videoRes.msg || "未知错误"}`);
                  throw new Error(`Video creation failed: ${videoRes.msg}`);
                }
              } catch (error) {
                console.error(
                  "Error creating avatar for",
                  realPlatform + ":",
                  error
                );

                return;
              }
            }
          })
        );
      }

      // 更新MergeHistory记录的childTaskIds和childTasks
      if (isMerge && mergeHistoryId && childTaskIds.length > 0) {
        await updateMergeHistoryItem(mergeHistoryId, {
          childTaskIds: childTaskIds,
          childTasks: childTasks,
        });
      }

      // 注意：暂时先不执行视频合并，等子任务都完成后再在history页面处理
      // if (isMerge) {
      //   const mergeVideoRes = await mergeVideo({
      //     apiKey: apiKey!,
      //     videos: videos,
      //     operation: "video_merge",
      //   });
      //   // 轮询
      //   await pollMergeVideo({
      //     apiKey: apiKey!,
      //     taskId: mergeVideoRes.task_id,
      //   });
      // }
    } catch (error) {
      console.error("Video generation failed:", error);
      // 如果是合并模式的错误，错误信息已经在内层处理了
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

  // History related functions (from history page)
  // 开始视频合并
  const startVideoMerge = useCallback(
    async (mergeTaskId: string) => {
      try {
        // 重新从数据库获取最新的合并任务数据
        const mergeHistories = await db.mergeHistory.toArray();
        const mergeTask = mergeHistories.find((m) => m.id === mergeTaskId);
        if (!mergeTask) {
          console.error(`Merge task ${mergeTaskId} not found`);
          return;
        }

        console.log(`Starting video merge for task ${mergeTaskId}`);

        // 获取所有成功的子任务的视频URL
        const successfulTasks =
          mergeTask.childTasks?.filter((child) => child.status === "success") ||
          [];
        const tasksWithUrls = successfulTasks.filter((child) => child.videoUrl);
        const videoUrls = tasksWithUrls
          .map((child) => child.videoUrl!)
          .filter((url) => url && url.trim() !== "");

        console.log(
          `Found ${videoUrls.length} video URLs for merge:`,
          videoUrls
        );

        if (videoUrls.length === 0) {
          console.error("No video URLs found for merge");
          await updateMergeHistoryItem(mergeTaskId, {
            status: "failed",
          });
          return;
        }

        // 更新合并任务状态为处理中
        await updateMergeHistoryItem(mergeTaskId, {
          status: "processing",
        });

        // 调用合并API
        const mergeResult = await mergeVideo({
          apiKey: apiKey!,
          videos: videoUrls,
          operation: "video_merge",
        });

        // 更新合并任务ID
        await updateMergeHistoryItem(mergeTaskId, {
          mergeTaskId: mergeResult.task_id,
        });

        // 开始轮询合并结果
        pollMergeResult(mergeResult.task_id, mergeTaskId);
      } catch (error) {
        console.error("Failed to start video merge:", error);
        await updateMergeHistoryItem(mergeTaskId, {
          status: "failed",
        });
      }
    },
    [apiKey, updateMergeHistoryItem]
  );

  // 轮询合并结果
  const pollMergeResult = useCallback(
    async (mergeTaskId: string, historyMergeId: string) => {
      try {
        console.log(`Polling merge video result for task ${mergeTaskId}`);

        const result: any = await pollMergeVideo({
          apiKey: apiKey!,
          taskId: mergeTaskId,
        });

        // 检查结果状态
        if (result.status === "success") {
          await updateMergeHistoryItem(historyMergeId, {
            status: "completed",
            mergedVideoUrl:
              result.data?.id || result.audio_path || result.video_url,
          });
          console.log(
            `Successfully polled merge video result for task ${mergeTaskId}`
          );
        } else {
          // 任何非成功状态都标记为失败
          console.error(
            `Merge video failed with status: ${result.status}, error: ${result.err_msg || "Unknown error"}`
          );
          await updateMergeHistoryItem(historyMergeId, {
            status: "failed",
          });
        }
      } catch (error) {
        console.error(`Failed to poll merge result:`, error);
        // API报错，直接停止轮询并标记为失败
        await updateMergeHistoryItem(historyMergeId, {
          status: "failed",
        });
      }
    },
    [apiKey, updateMergeHistoryItem]
  );

  // 检查并更新合并任务状态
  const checkAndUpdateMergeTask = useCallback(
    async (
      childTaskId: string,
      taskResult: "success" | "failed",
      videoUrl?: string
    ) => {
      try {
        // 防止重复处理同一个任务
        if (processedTasks.has(childTaskId)) {
          console.log(`Task ${childTaskId} already processed, skipping`);
          return;
        }

        const mergeTask = await findMergeHistoryByChildTask(childTaskId);
        if (mergeTask) {
          // 如果merge任务已经失败，不再处理
          if (mergeTask.status === "failed") {
            console.log(
              `Merge task ${mergeTask.id} is already failed, skipping processing for child ${childTaskId}`
            );
            return;
          }

          console.log(
            `Processing merge task for child ${childTaskId}, result: ${taskResult}`,
            mergeTask
          );

          // 标记任务已处理
          setProcessedTasks((prev) => new Set(prev).add(childTaskId));

          const newCompletedTasks =
            taskResult === "success"
              ? mergeTask.completedTasks + 1
              : mergeTask.completedTasks;
          const newFailedTasks =
            taskResult === "failed"
              ? mergeTask.failedTasks + 1
              : mergeTask.failedTasks;

          console.log(
            `Updating merge task: completed ${newCompletedTasks}/${mergeTask.totalTasks}, failed: ${newFailedTasks}`
          );

          // 更新childTasks状态和视频URL
          const updatedChildTasks =
            mergeTask.childTasks?.map((child) => {
              if (child.taskId === childTaskId) {
                const updatedChild = {
                  ...child,
                  status: taskResult as "success" | "failed",
                  videoUrl: videoUrl || child.videoUrl, // 优先使用传入的videoUrl
                };
                console.log(`Updated child task ${childTaskId}:`, updatedChild);
                return updatedChild;
              }
              return child;
            }) || [];

          console.log(`All updated child tasks:`, updatedChildTasks);

          // 更新合并任务进度
          await updateMergeHistoryItem(mergeTask.id, {
            completedTasks: newCompletedTasks,
            failedTasks: newFailedTasks,
            childTasks: updatedChildTasks,
          });

          // 检查所有子任务是否都已完成
          const totalProcessed = newCompletedTasks + newFailedTasks;
          console.log(
            `Total processed: ${totalProcessed}/${mergeTask.totalTasks}`
          );

          if (totalProcessed === mergeTask.totalTasks) {
            if (newCompletedTasks > 0) {
              // 有成功任务，开始合并视频（即使有部分失败）
              console.log(
                `Some tasks completed successfully (${newCompletedTasks}/${mergeTask.totalTasks}), starting video merge for ${mergeTask.id}`
              );
              await startVideoMerge(mergeTask.id);
            } else {
              // 全部失败，标记合并任务为失败
              console.log(`All tasks failed, marking merge task as failed`);
              await updateMergeHistoryItem(mergeTask.id, {
                status: "failed",
              });
            }
          }
        }
      } catch (error) {
        console.error("Error checking merge task:", error);
      }
    },
    [
      findMergeHistoryByChildTask,
      updateMergeHistoryItem,
      processedTasks,
      startVideoMerge,
    ]
  );

  const handleVideoClick = (videoUrl: string) => {
    setCurrentVideoUrl(videoUrl);
    setVideoDialogOpen(true);
  };

  // 处理重新生成 - 单个任务
  const handleRegenerate = (item: any) => {
    // 恢复创建配置
    setCreateConfig({
      createType:
        item.createType ||
        (item.model === "hedra"
          ? "hedra"
          : item.model === "Omnihuman"
            ? "Omnihuman"
            : item.model === "TopView"
              ? "TopView"
              : item.model === "stable"
                ? "stable"
                : "chanjing"),
      resolution: "16:9", // 默认分辨率
      hedraSettings: {
        videoResolution: item.videoResolution || "720p",
      },
      chanjingSettings: {
        driveMode: item.driveMode || "",
        backway: item.backway || 2,
      },
    });

    // 恢复视频配置参数 - 使用原始参数，保留数字人视频URL，清空生成结果
    setCreateVideoStore({
      videoList: [
        {
          id: crypto.randomUUID(),
          createdAt: Date.now(),
          platform: item.platform,
          voice: item.voice,
          text: item.text,
          avatarImage: item.avatarImage,
          backgroundImage: item.backgroundImage || "",
          videoUrl: item.originalVideoUrl || item.videoUrl, // 优先使用原始数字人视频URL
          wavUrl: "", // 重新生成时清空已生成的音频URL
          mode: item.mode,
          audioFile: "", // 重新生成时清空已处理的音频文件
          subtitleConfig: item.subtitleConfig,
        },
      ],
    });

    // 切换到创建视图
    setCurrentView("create");
  };

  // 处理重新生成 - 合并任务
  const handleRegenerateMerge = async (mergeTask: any) => {
    // 获取所有子任务的详细信息
    const childTasks = await Promise.all(
      mergeTask.childTaskIds.map(async (childId: string) => {
        const childItem = historyData?.find((h) => h.id === childId);
        return childItem;
      })
    );

    // 过滤出有效的子任务
    const validChildTasks = childTasks.filter((child) => child != null);

    if (validChildTasks.length === 0) {
      console.error("No valid child tasks found for merge task");
      return;
    }

    // 使用第一个子任务的配置作为基础配置
    const firstChild = validChildTasks[0];
    setCreateConfig({
      createType:
        firstChild.createType ||
        (firstChild.model === "hedra"
          ? "hedra"
          : firstChild.model === "Omnihuman"
            ? "Omnihuman"
            : firstChild.model === "TopView"
              ? "TopView"
              : firstChild.model === "stable"
                ? "stable"
                : firstChild.model === "latentsync"
                  ? "latentsync"
                  : "chanjing"),
      resolution: "16:9", // 默认分辨率
      hedraSettings: {
        videoResolution: firstChild.videoResolution || "720p",
      },
      chanjingSettings: {
        driveMode: firstChild.driveMode || "",
        backway: firstChild.backway || 2,
      },
    });

    // 恢复所有子任务的视频配置参数 - 使用原始参数，保留数字人视频URL，清空生成结果
    setCreateVideoStore({
      videoList: validChildTasks.map((child) => ({
        id: crypto.randomUUID(),
        createdAt: Date.now(),
        platform: child.platform,
        voice: child.voice,
        text: child.text,
        avatarImage: child.avatarImage,
        backgroundImage: child.backgroundImage || "",
        videoUrl: child.originalVideoUrl || child.videoUrl, // 优先使用原始数字人视频URL
        wavUrl: "", // 重新生成时清空已生成的音频URL
        mode: child.mode,
        audioFile: "", // 重新生成时清空已处理的音频文件
        subtitleConfig: child.subtitleConfig,
      })),
    });

    // 切换到创建视图
    setCurrentView("create");
  };

  // 开始编辑
  const handleStartEdit = (
    id: string,
    currentName: string,
    isMergeTask: boolean = false
  ) => {
    setEditingId(id);
    setEditingName(currentName || t("avatar.noName"));
    setEditingIsMergeTask(isMergeTask);
    setEditDialogOpen(true);
  };

  // 保存编辑
  const handleSaveEdit = async () => {
    if (editingId && editingName.trim() !== "") {
      if (editingIsMergeTask) {
        await updateMergeHistoryItem(editingId, { name: editingName.trim() });
      } else {
        await updateHistoryDataItem(editingId, { name: editingName.trim() });
      }
    }
    setEditingId(null);
    setEditingName("");
    setEditingIsMergeTask(false);
    setEditDialogOpen(false);
  };

  // 取消编辑
  const handleCancelEdit = () => {
    setEditingId(null);
    setEditingName("");
    setEditingIsMergeTask(false);
    setEditDialogOpen(false);
  };

  // 下载视频
  const handleDownload = async (item: any) => {
    if (!item.video_url && !item.videoUrl) {
      console.error("No video URL available for download");
      return;
    }

    const videoUrl = item.video_url || item.videoUrl;
    const fileName = `${item.name || t("avatar.noName")}.mp4`;

    try {
      // 使用 fetch 获取文件并创建 blob
      const response = await fetch(videoUrl, {
        method: "GET",
        headers: {
          Accept: "*/*",
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const blob = await response.blob();

      // 创建下载链接
      const link = document.createElement("a");
      const blobUrl = window.URL.createObjectURL(blob);

      link.href = blobUrl;
      link.download = fileName;
      link.rel = "noopener"; // 安全性

      // 触发下载
      link.click();

      // 清理
      window.URL.revokeObjectURL(blobUrl);
    } catch (error) {
      console.error("Download failed:", error);

      // 备用方案：使用 window.open 在新标签页打开
      try {
        const link = document.createElement("a");
        link.href = videoUrl;
        link.download = fileName;
        link.target = "_blank";
        link.rel = "noopener noreferrer";
        link.click();
      } catch (fallbackError) {
        console.error("Fallback download also failed:", fallbackError);
        // 最后手段：复制链接到剪贴板
        navigator.clipboard.writeText(videoUrl).then(() => {
          alert("下载失败，视频链接已复制到剪贴板");
        });
      }
    }
  };

  // 删除视频
  const handleDelete = async (id: string, isMergeTask: boolean = false) => {
    if (isMergeTask) {
      await deleteMergeHistoryItem(id);
    } else {
      await deleteHistoryDataItem(id);
    }
  };

  // 轮询单个任务
  const pollVideoResult = useCallback(
    async (taskId: string, historyId: string, model: string) => {
      // 如果已经在轮询中，跳过
      if (pollingTasks.has(taskId)) {
        return;
      }

      // 标记为正在轮询
      setPollingTasks((prev) => new Set(prev).add(taskId));

      try {
        console.log(`Polling ${model} video result for task ${taskId}`);

        let result;
        // 根据模型类型选择不同的轮询API
        if (model === "hedra") {
          const response = await ky.post("/api/poll-hedra-video-result", {
            json: { id: taskId, apiKey },
            timeout: false,
          });
          result = await response.json();
        } else if (model === "Omnihuman") {
          result = await pollOmnihumanVideo({
            taskId: taskId,
            apiKey: apiKey!,
          });
        } else if (model === "TopView") {
          result = await pollTopviewVideo({
            taskId: taskId,
            apiKey: apiKey!,
          });
        } else if (model === "stable") {
          result = await pollStableVideo({
            apiKey: apiKey!,
            taskId: taskId,
          });
        } else if (model === "latentsync") {
          result = await pollLatentsyncVideo({
            apiKey: apiKey!,
            taskId: taskId,
          });
        } else {
          const response = await ky.post("/api/poll-chanjing-video-result", {
            json: { id: taskId, apiKey },
            timeout: false,
          });
          result = await response.json();
        }

        // 更新历史记录 - 不覆盖原始videoUrl
        await updateHistoryDataItem(historyId, {
          taskStatus: "success",
          status: 30, // 已生成状态
          video_url: (result as any).video_url || (result as any).download_url,
          preview_url:
            (result as any).preview_url ||
            (result as any).streaming_url ||
            (result as any).download_url,
          // videoUrl 保持原始数字人视频URL，不被生成结果覆盖
          streaming_url: (result as any).streaming_url,
        });

        console.log(
          `Successfully polled ${model} video result for task ${taskId}`
        );
        // 检查是否属于批量合并任务，传递视频URL
        const videoUrl =
          (result as any).video_url || (result as any).download_url;
        await checkAndUpdateMergeTask(historyId, "success", videoUrl);

        // 标记任务为已处理（成功）
        setProcessedTasks((prev) => new Set(prev).add(taskId));
      } catch (error) {
        console.error(`Poll ${model} video result failed:`, error);

        // API报错，直接停止轮询并标记为失败
        await updateHistoryDataItem(historyId, {
          taskStatus: "failed",
          status: -1,
        });

        // 检查是否属于批量合并任务，如果是需要merge的类型且请求失败了，就不要请求merge了
        const mergeTask = await findMergeHistoryByChildTask(historyId);
        if (!mergeTask) {
          // 只有非merge任务或者不属于merge任务时才调用checkAndUpdateMergeTask
          await checkAndUpdateMergeTask(historyId, "failed");
        } else {
          console.log(
            `Task ${historyId} belongs to merge task, poll failed - marking entire merge task as failed to prevent merge operation`
          );

          // 直接将整个merge任务标记为失败，防止后续成功任务触发merge
          await updateMergeHistoryItem(mergeTask.id, {
            status: "failed",
          });
        }

        // 标记任务为已处理（失败），避免重复轮询
        setProcessedTasks((prev) => new Set(prev).add(taskId));
      } finally {
        // 无论成功还是失败，都从轮询列表中移除
        setPollingTasks((prev) => {
          const newSet = new Set(prev);
          newSet.delete(taskId);
          return newSet;
        });
      }
    },
    [
      apiKey,
      updateHistoryDataItem,
      pollingTasks,
      checkAndUpdateMergeTask,
      setProcessedTasks,
      findMergeHistoryByChildTask,
      updateMergeHistoryItem,
      startVideoMerge,
    ]
  );

  // 轮询所有 pending 状态的任务
  const pollPendingTasks = useCallback(async () => {
    if (!historyData || !apiKey) return;

    // 过滤出真正需要轮询的任务：
    // 1. taskStatus 为 "pending"
    // 2. 有 taskId
    // 3. 没有在当前轮询中
    // 4. 没有被处理过（避免重复轮询已失败的任务）
    const pendingTasks = historyData.filter(
      (item) =>
        item.taskStatus === "pending" &&
        item.taskId &&
        !pollingTasks.has(item.taskId) &&
        !processedTasks.has(item.taskId)
    );

    if (pendingTasks.length === 0) return;

    // 优先轮询新创建的任务（按创建时间倒序）
    const sortedTasks = pendingTasks.sort((a, b) => b.createdAt - a.createdAt);

    // 并行轮询所有符合条件的 pending 任务
    await Promise.all(
      sortedTasks.map((task) =>
        pollVideoResult(task.taskId, task.id, task.model || "chanjing")
      )
    );
  }, [historyData, apiKey, pollVideoResult, pollingTasks, processedTasks]);

  // 监听welcome modal状态变化
  useEffect(() => {
    console.log("🔍 Welcome modal effect triggered:", {
      isOpen: welcomeModalStore.isOpen,
      wasOpen: welcomeModalWasOpen,
      createConfigType: createConfig.createType,
      currentView,
      presetDataSource: welcomeModalStore.presetData?.source,
      presetData: welcomeModalStore.presetData,
      timestamp: new Date().toLocaleTimeString(),
    });

    if (welcomeModalStore.isOpen) {
      console.log("📋 Modal is open, setting welcomeModalWasOpen to true");
      setWelcomeModalWasOpen(true);
    } else if (welcomeModalWasOpen && !welcomeModalStore.isOpen) {
      console.log("🚪 Modal was open and now closed");

      // 检查用户是否选择了有效的公司
      const hasValidCreateType =
        createConfig.createType === "chanjing" ||
        createConfig.createType === "hedra" ||
        createConfig.createType === "Omnihuman" ||
        createConfig.createType === "TopView" ||
        createConfig.createType === "stable" ||
        createConfig.createType === "latentsync";

      // 检查来源（声音库、数字人页面或创建页面内部）
      const isFromExternalSource =
        welcomeModalStore.presetData?.source === "voice" ||
        welcomeModalStore.presetData?.source === "avatar";

      console.log("🎯 View switching logic:", {
        hasValidCreateType,
        isFromExternalSource,
        createType: createConfig.createType,
        source: welcomeModalStore.presetData?.source,
        shouldSwitch: hasValidCreateType,
      });

      if (hasValidCreateType) {
        if (isFromExternalSource) {
          console.log(
            `✅ Switching to create view (from ${welcomeModalStore.presetData?.source})`
          );
          setCurrentView("create");
          console.log("🎬 setCurrentView('create') called");
        } else {
          console.log("✅ Switching to create view (from create page)");
          setCurrentView("create");
          console.log("🎬 setCurrentView('create') called");
        }
      } else {
        console.log("❌ Not switching view - no valid createType");
      }

      setWelcomeModalWasOpen(false);
    }
  }, [
    welcomeModalStore.isOpen,
    welcomeModalWasOpen,
    createConfig.createType,
    currentView,
    welcomeModalStore.presetData?.source,
  ]);

  // 初始化已处理任务列表
  useEffect(() => {
    if (!historyData) return;

    // 将所有非pending状态的任务标记为已处理，避免重复轮询
    const processedTaskIds = historyData
      .filter((item) => item.taskId && item.taskStatus !== "pending")
      .map((item) => item.taskId);

    if (processedTaskIds.length > 0) {
      setProcessedTasks((prev) => {
        const newSet = new Set(prev);
        processedTaskIds.forEach((taskId) => newSet.add(taskId));
        return newSet;
      });
    }
  }, [historyData]);

  // 定期轮询
  useEffect(() => {
    const pollInterval = setInterval(() => {
      pollPendingTasks();
    }, 3000); // 每3秒轮询一次

    // 立即执行一次
    pollPendingTasks();

    return () => {
      clearInterval(pollInterval);
    };
  }, [pollPendingTasks]);

  const getStatusBadge = (item: any) => {
    // 优先使用 taskStatus
    if (item.taskStatus === "pending") {
      return (
        <Badge variant="default" className="bg-blue-500 hover:bg-blue-600">
          {t("history.status.pending")}
        </Badge>
      );
    } else if (item.taskStatus === "success") {
      return (
        <Badge variant="default" className="bg-green-500 hover:bg-green-600">
          {t("history.status.success")}
        </Badge>
      );
    } else if (item.taskStatus === "failed") {
      return (
        <Badge variant="default" className="bg-red-500 hover:bg-red-600">
          {t("history.status.failed")}
        </Badge>
      );
    }

    // 兼容旧的 status 字段
    switch (item.status) {
      case 30:
        return (
          <Badge variant="default" className="bg-green-500 hover:bg-green-600">
            已生成
          </Badge>
        );
      case 2:
        return (
          <Badge variant="default" className="bg-blue-500 hover:bg-blue-600">
            处理中
          </Badge>
        );
      case -1:
        return (
          <Badge variant="default" className="bg-red-500 hover:bg-red-600">
            生成失败
          </Badge>
        );
      default:
        return <Badge variant="outline">未知状态</Badge>;
    }
  };

  // 获取合并任务状态徽章
  const getMergeStatusBadge = (mergeTask: any) => {
    switch (mergeTask.status) {
      case "pending":
        return (
          <Badge variant="default" className="bg-blue-500 hover:bg-blue-600">
            {t("history.status.pending")}
          </Badge>
        );
      case "processing":
        return (
          <Badge variant="default" className="bg-blue-500 hover:bg-blue-600">
            {t("history.status.pending")}
          </Badge>
        );
      case "completed":
        return (
          <Badge variant="default" className="bg-green-500 hover:bg-green-600">
            {t("history.status.success")}
          </Badge>
        );
      case "failed":
        return (
          <Badge variant="default" className="bg-red-500 hover:bg-red-600">
            {t("history.status.failed")}
          </Badge>
        );
      default:
        return <Badge variant="outline">未知</Badge>;
    }
  };

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleDateString("zh-CN", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  // 根据公司过滤器过滤历史数据
  const filterItemsByCompany = (items: any[]) => {
    if (companyFilter === "all") {
      return items;
    }

    return items.filter((item) => {
      if (companyFilter === "chanjing") {
        return item.model === "chanjing" || item.createType === "chanjing";
      } else if (companyFilter === "hedra") {
        return item.model === "hedra" || item.createType === "hedra";
      } else if (companyFilter === "Omnihuman") {
        return item.model === "Omnihuman" || item.createType === "Omnihuman";
      } else if (companyFilter === "TopView") {
        return item.model === "TopView" || item.createType === "TopView";
      } else if (companyFilter === "stable") {
        return item.model === "stable" || item.createType === "stable";
      } else if (companyFilter === "latentsync") {
        return item.model === "latentsync" || item.createType === "latentsync";
      }
      return true;
    });
  };

  // 过滤出不属于合并任务的单独任务
  const individualTasks =
    historyData?.filter((item) => {
      // 检查这个任务是否属于任何合并任务
      return !mergeHistoryData?.some((merge) =>
        merge.childTaskIds.includes(item.id)
      );
    }) || [];

  // 应用公司过滤器到单独任务
  const filteredIndividualTasks = filterItemsByCompany(individualTasks);

  // 过滤合并任务 - 根据其子任务的模型类型来判断
  const filteredMergeHistoryData =
    mergeHistoryData?.filter((merge) => {
      if (companyFilter === "all") {
        return true;
      }

      // 检查合并任务的子任务类型
      const childTasks = merge.childTaskIds
        .map((childId) => historyData?.find((item) => item.id === childId))
        .filter(Boolean);

      if (childTasks.length === 0) return false;

      // 检查是否所有子任务都属于当前过滤的公司
      const allTasksMatchFilter = childTasks.every((child) => {
        if (companyFilter === "chanjing") {
          return (
            child?.model === "chanjing" || child?.createType === "chanjing"
          );
        } else if (companyFilter === "hedra") {
          return child?.model === "hedra" || child?.createType === "hedra";
        } else if (companyFilter === "Omnihuman") {
          return (
            child?.model === "Omnihuman" || child?.createType === "Omnihuman"
          );
        } else if (companyFilter === "TopView") {
          return child?.model === "TopView" || child?.createType === "TopView";
        } else if (companyFilter === "stable") {
          return child?.model === "stable" || child?.createType === "stable";
        } else if (companyFilter === "latentsync") {
          return (
            child?.model === "latentsync" || child?.createType === "latentsync"
          );
        }
        return false;
      });

      return allTasksMatchFilter;
    }) || [];

  // 合并所有要显示的项目（单独任务 + 合并任务）
  const allDisplayItems = [
    ...filteredIndividualTasks.map((item) => ({
      type: "individual",
      data: item,
    })),
    ...filteredMergeHistoryData.map((merge) => ({
      type: "merge",
      data: merge,
    })),
  ].sort((a, b) => b.data.createdAt - a.data.createdAt);

  // 渲染单独任务的函数
  const renderIndividualTask = (item: any) => {
    const PLATFORM_LABELS = {
      chanjing: "蝉镜",
      hedra: "Hedra",
      TopView: "TopView",
      // 可以轻松添加新平台
      omnihuman: "OmniHuman",
      // 未来扩展示例
      stable: "StableAvatar",
      latentsync: "Latentsync",
    } as const;
    const platformLabel =
      PLATFORM_LABELS[item.model as keyof typeof PLATFORM_LABELS] ||
      "Omnihuman";

    return (
      <div className="relative w-full overflow-hidden rounded-2xl border border-solid">
        {/* Video content area */}
        <div className="group relative aspect-video overflow-hidden">
          {/* 平台标签 - 左上角 */}
          <div className="absolute left-2 top-2 z-10">
            <Badge variant="secondary" className=" ">
              {platformLabel}
            </Badge>
          </div>

          {/* 下载和菜单按钮 - 右上角 */}
          {((item.video_url || item.videoUrl) &&
            item.taskStatus === "success") ||
          item.taskStatus === "failed" ? (
            <div className="absolute right-2 top-2 z-10 flex gap-1">
              {/* 下载按钮 - 只有视频生成成功时显示 */}
              {(item.video_url || item.videoUrl) &&
                item.taskStatus === "success" && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-8 w-8 p-0"
                    onClick={() => handleDownload(item)}
                  >
                    <Download className="h-4 w-4" />
                  </Button>
                )}

              {/* 菜单按钮 - 成功和失败都显示 */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button size="sm" variant="ghost" className="h-8 w-8 p-0">
                    <EllipsisVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {/* 重新生成 - 只有失败时显示 */}
                  {
                    <DropdownMenuItem onClick={() => handleRegenerate(item)}>
                      <RotateCcw className="mr-2 h-4 w-4" />
                      {t("history.regenerate")}
                    </DropdownMenuItem>
                  }
                  {/* 重命名 - 只有成功时显示 */}
                  {item.taskStatus === "success" && (
                    <DropdownMenuItem
                      onClick={() => handleStartEdit(item.id, item.name)}
                    >
                      <Edit2 className="mr-2 h-4 w-4" />
                      {t("history.renameVideo")}
                    </DropdownMenuItem>
                  )}
                  {/* 删除 - 成功和失败都显示 */}
                  <DropdownMenuItem
                    onClick={() => handleDelete(item.id)}
                    className="text-red-600 focus:text-red-600"
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    {t("history.delete")}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          ) : null}

          {(() => {
            // 处理可能包含多个URL的字符串，只取第一个
            const getFirstImageUrl = (imageUrl: string) => {
              if (!imageUrl) return "";
              return imageUrl.split(",")[0].trim();
            };

            // 检查是否应该显示预览图片
            // 只有在任务完成状态(taskStatus为success或旧的status为30)时才显示图片
            const shouldShowPreview =
              item.taskStatus === "success" ||
              (item.taskStatus !== "pending" &&
                item.taskStatus !== "failed" &&
                item.status === 30);

            // 对于hedra和Omnihuman模型，使用avatar图片作为缩略图，其他使用preview_url
            const thumbnailUrl = shouldShowPreview
              ? item.model === "hedra" ||
                item.model === "Omnihuman" ||
                item.model === "TopView" ||
                item.model === "stable" ||
                item.model === "latentsync"
                ? getFirstImageUrl(item.avatarImage)
                : item.preview_url
              : "";

            return thumbnailUrl && shouldShowPreview ? (
              <>
                <Image
                  src={thumbnailUrl}
                  alt="Video preview"
                  fill
                  className="object-contain"
                />
                {/* Play button overlay - 只在有video_url时显示 */}
                {item.video_url && (
                  <div className="absolute inset-0 flex items-center justify-center opacity-0 transition-opacity group-hover:opacity-100">
                    <div
                      className="flex h-12 w-12 cursor-pointer items-center justify-center rounded-full bg-black bg-opacity-60"
                      onClick={() => handleVideoClick(item.video_url)}
                    >
                      <Play className="ml-0.5 h-5 w-5" fill="white" />
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="flex h-full items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100 p-8 text-center">
                <div>
                  {item.taskStatus === "pending" ? (
                    <div className="flex flex-col items-center gap-3">
                      <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-blue-500"></div>
                    </div>
                  ) : item.taskStatus === "failed" ? (
                    <>
                      {/* <div className="mb-2 text-lg">生成失败</div> */}
                      {/* <div className="text-sm">请重新尝试</div> */}
                    </>
                  ) : (
                    <>
                      {/* <div className="mb-2 text-lg">预览图片加载中...</div> */}
                      {/* <div className="text-sm">点击可放大播放</div> */}
                    </>
                  )}
                </div>
              </div>
            );
          })()}
        </div>
        {/* Bottom info section - 重新设计布局 */}
        <div className="border-t border-solid p-4">
          <div className="flex items-center justify-between">
            {/* 左侧：视频名称和生成时间 */}
            <div className="flex flex-1 flex-col gap-1">
              <div className="text-sm font-medium">
                {item.name || t("avatar.noName")}
              </div>
              <div className="text-xs text-gray-500">
                {formatDate(item.createdAt)}
              </div>
            </div>

            {/* 右侧：生成状态 */}
            <div className="flex items-center">{getStatusBadge(item)}</div>
          </div>
        </div>
      </div>
    );
  };

  // 渲染合并任务的函数
  const renderMergeTask = (mergeTask: any) => {
    const PLATFORM_LABELS = {
      chanjing: "蝉镜",
      hedra: "Hedra",
      TopView: "TopView",
      stable: "Stable",
      omnihuman: "OmniHuman",
      latentsync: "Latentsync",
    } as const;

    const childTasks = mergeTask.childTasks || [];
    const progress =
      mergeTask.totalTasks > 0
        ? Math.round((mergeTask.completedTasks / mergeTask.totalTasks) * 100)
        : 0;
    const successCount = childTasks.filter(
      (child: any) => child.status === "success"
    ).length;
    const failedCount = childTasks.filter(
      (child: any) => child.status === "failed"
    ).length;
    const pendingCount = childTasks.filter(
      (child: any) => child.status === "pending"
    ).length;

    return (
      <div className="relative w-full overflow-hidden rounded-2xl border border-solid">
        {/* Video content area */}
        <div className="group relative aspect-video overflow-hidden">
          {/* 模型类型标签 - 左上角 */}
          <div className="absolute left-2 top-2 z-10">
            <Badge variant="secondary" className="">
              {(() => {
                // 获取第一个子任务的模型类型
                const firstChild = childTasks[0];
                if (firstChild && historyData) {
                  const childHistoryItem = historyData.find(
                    (item) => item.id === firstChild.taskId
                  );
                  // 修复：使用 childHistoryItem.model 而不是 firstChild.model
                  const model = childHistoryItem?.model;
                  // 修复：添加类型检查和默认值
                  return (
                    PLATFORM_LABELS[model as keyof typeof PLATFORM_LABELS] ||
                    "Hedra"
                  );
                }
                return "Hedra"; // 默认值
              })()}
            </Badge>
          </div>

          {/* 操作按钮 - 右上角 */}
          <div className="absolute right-2 top-2 z-10 flex gap-1">
            {/* 下载按钮 - 只有合并完成时显示 */}
            {mergeTask.status === "completed" && mergeTask.mergedVideoUrl && (
              <Button
                size="sm"
                variant="ghost"
                className="h-8 w-8 p-0"
                onClick={() =>
                  handleDownload({
                    video_url: mergeTask.mergedVideoUrl,
                    name: mergeTask.name,
                  })
                }
              >
                <Download className="h-4 w-4" />
              </Button>
            )}

            {/* 菜单按钮 - 始终显示 */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-8 w-8 p-0"
                  title="更多操作"
                >
                  <EllipsisVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  onClick={() => handleRegenerateMerge(mergeTask)}
                >
                  <RotateCcw className="mr-2 h-4 w-4" />
                  {t("history.regenerate")}
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() =>
                    handleStartEdit(mergeTask.id, mergeTask.name, true)
                  }
                >
                  <Edit2 className="mr-2 h-4 w-4" />
                  {t("history.renameVideo")}
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => handleDelete(mergeTask.id, true)}
                  className="text-red-600 focus:text-red-600"
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  {t("history.delete")}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {(() => {
            // 获取第一个成功子任务的预览图作为合并任务的缩略图
            const firstSuccessChild = childTasks.find(
              (child: any) => child.status === "success"
            );
            const shouldShowThumbnail =
              mergeTask.status === "completed" && mergeTask.mergedVideoUrl;

            // 尝试从历史数据中获取对应的预览图片
            let thumbnailUrl = "";
            if (firstSuccessChild && historyData) {
              const childHistoryItem = historyData.find(
                (item) => item.id === firstSuccessChild.taskId
              );
              if (childHistoryItem) {
                // 对于hedra和Omnihuman模型使用avatarImage，其他使用preview_url
                if (
                  childHistoryItem.model === "hedra" ||
                  childHistoryItem.model === "Omnihuman" ||
                  childHistoryItem.model === "TopView" ||
                  childHistoryItem.model === "latentsync"
                ) {
                  thumbnailUrl =
                    childHistoryItem.avatarImage?.split(",")[0]?.trim() || "";
                } else {
                  thumbnailUrl = childHistoryItem.preview_url || "";
                }
              }
            }

            return shouldShowThumbnail && thumbnailUrl ? (
              <>
                <Image
                  src={thumbnailUrl}
                  alt="Merge video preview"
                  fill
                  className="object-contain"
                />
                {/* Play button overlay */}
                <div className="absolute inset-0 flex items-center justify-center opacity-0 transition-opacity group-hover:opacity-100">
                  <div
                    className="flex h-12 w-12 cursor-pointer items-center justify-center rounded-full bg-black bg-opacity-60 transition-all hover:bg-opacity-80"
                    onClick={() => handleVideoClick(mergeTask.mergedVideoUrl)}
                  >
                    <Play className="ml-0.5 h-5 w-5" fill="white" />
                  </div>
                </div>
              </>
            ) : (
              <div className="flex h-full items-center justify-center p-8 text-center">
                <div></div>
              </div>
            );
          })()}
        </div>
        {/* Bottom info section */}
        <div className="border-t border-solid p-4">
          <div className="flex items-center justify-between">
            {/* 左侧：任务名称和创建时间 */}
            <div className="flex flex-1 flex-col gap-1">
              <div className="text-sm font-medium">
                {mergeTask.name || "未命名合并任务"}
              </div>
              <div className="text-xs text-gray-500">
                {formatDate(mergeTask.createdAt)}
              </div>
            </div>

            {/* 右侧：合并状态 */}
            <div className="flex items-center">
              {getMergeStatusBadge(mergeTask)}
            </div>
          </div>
        </div>
      </div>
    );
  };

  // 渲染创建新视频的卡片
  // 修改 RenderCreateCard 组件 - 内容在整个卡片中居中
  const RenderCreateCard = () => {
    return (
      <div
        className="relative w-full cursor-pointer overflow-hidden rounded-2xl border border-dashed border-gray-300 transition-all duration-300 hover:border-gray-400 hover:border-primary/50 hover:bg-primary/5"
        onClick={() => {
          // 检查当前tab的类型
          if (companyFilter === "all") {
            // 如果是"全部"tab，使用WelcomeModal弹窗
            setCreateConfig((prev) => ({ ...prev, createType: "" as any }));
            openWelcomeModal();
          } else {
            // 如果是具体公司tab，直接跳转到创建视图
            setCreateConfig({
              createType: companyFilter as
                | "chanjing"
                | "hedra"
                | "Omnihuman"
                | "TopView"
                | "stable"
                | "latentsync",
              resolution: "16:9",
              hedraSettings: {
                videoResolution: "720p",
              },
              chanjingSettings: {
                driveMode: "",
                backway: 2,
              },
            });
            setCreateVideoStore({
              videoList: [],
            });
            setCurrentView("create");
          }
        }}
      >
        {/* 整个卡片内容区域 - 绝对定位让内容在整个卡片中居中 */}
        <div className="absolute inset-0 z-10 flex items-center justify-center">
          <div className="flex flex-col items-center gap-2 text-gray-500">
            <Plus className="h-12 w-12" />
            <span className="text-sm font-medium">
              {t("create.createNewVideo")}
            </span>
          </div>
        </div>

        {/* Video content area - 与历史卡片的视频区域结构完全一致，但内容透明 */}
        <div className="group relative aspect-video overflow-hidden">
          {/* 空的视频区域，用于保持结构 */}
        </div>

        {/* Bottom info section - 保持结构和高度，但内容为空 */}
        <div className="border-solid p-4">
          <div className="flex items-center justify-between">
            {/* 左侧：使用透明占位符保持高度 */}
            <div className="flex flex-1 flex-col gap-1">
              <div className="text-sm font-medium opacity-0">占位文字</div>
              <div className="text-xs opacity-0">占位文字</div>
            </div>

            {/* 右侧：空白区域保持布局一致 */}
            <div className="flex items-center">{/* 保持空白 */}</div>
          </div>
        </div>
      </div>
    );
  };
  return (
    <div className="flex min-h-0 flex-1 flex-col bg-background">
      {currentView === "list" ? (
        // List view - showing history items with create card
        <div className="p-4 sm:p-6">
          <div className="mb-6 flex flex-col gap-4">
            <h1 className="text-2xl font-bold sm:text-xl">
              {t("create.list")}
            </h1>

            {/* 公司过滤器 */}
            {/* 公司过滤器 - 优化版本 */}
            <div className="flex space-y-6">
              <Tabs
                value={companyFilter}
                onValueChange={(value) =>
                  setCompanyFilter(
                    value as
                      | "all"
                      | "chanjing"
                      | "hedra"
                      | "Omnihuman"
                      | "TopView"
                      | "stable"
                      | "latentsync"
                  )
                }
              >
                <TabsList className="flex justify-start gap-1 py-2">
                  <TabsTrigger value="all" className="">
                    全部
                  </TabsTrigger>
                  <TabsTrigger value="chanjing" className="">
                    蝉镜
                  </TabsTrigger>
                  <TabsTrigger value="hedra" className="">
                    Hedra
                  </TabsTrigger>
                  <TabsTrigger value="Omnihuman" className="">
                    OmniHuman
                  </TabsTrigger>
                  <TabsTrigger value="TopView" className="">
                    TopView
                  </TabsTrigger>
                  <TabsTrigger value="stable" className="">
                    StableAvatar
                  </TabsTrigger>
                  <TabsTrigger value="latentsync" className="">
                    Latentsync
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
          </div>

          {allDisplayItems.length === 0 ? (
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
              <div className="w-full">{RenderCreateCard()}</div>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
              {/* Create new video card - always first */}
              <div className="w-full">{RenderCreateCard()}</div>

              {/* History items */}
              {allDisplayItems.map((displayItem) => {
                if (displayItem.type === "individual") {
                  const item = displayItem.data;
                  return (
                    <div key={item.id} className="w-full">
                      {renderIndividualTask(item)}
                    </div>
                  );
                } else {
                  const mergeTask = displayItem.data;
                  return (
                    <div key={mergeTask.id} className="w-full">
                      {renderMergeTask(mergeTask)}
                    </div>
                  );
                }
              })}
            </div>
          )}
        </div>
      ) : (
        // Create view - original create page content
        <>
          {/* 头部区域 */}
          <div className="flex w-full flex-shrink-0 flex-col gap-4 p-4 pt-4">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setCurrentView("list");
                  // 清除预设数据，确保下次不会误判
                  clearPresetData();
                }}
                className="flex items-center gap-2"
              >
                <ArrowLeft className="h-4 w-4" />
                {t("create.title")}
              </Button>
              {/* <h1 className="text-2xl font-bold sm:text-xl">
                {t("create.title")}
              </h1> */}
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

          {/* 主要内容区域 */}
          <div className="flex min-h-0 flex-1 flex-col">
            <div className="flex-1 overflow-y-auto p-4">
              {/* 主容器 - 居中显示 */}
              {createVideoStore?.videoList &&
                createVideoStore.videoList.map((item) => (
                  <Card
                    key={item.id}
                    className="mx-auto mb-6 w-full max-w-6xl p-6 shadow-sm"
                  >
                    {/* 左右分栏布局 - 整体居中 */}
                    <div className="flex h-full flex-col justify-center lg:flex-row lg:gap-6">
                      {/* 左侧区域 - 视频预览 */}
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

                      {/* 右侧区域 - 配置选项 */}
                      <div className="flex w-full flex-col justify-between lg:w-[32rem]">
                        <Actions currentItem={item} />
                        <ConfigurationPanel {...item} />
                      </div>
                    </div>
                  </Card>
                ))}
            </div>

            {/* 底部按钮 - 始终固定在可见区域底部 */}
            <div className="flex flex-shrink-0 items-center justify-between border-solid border-gray-200 p-4 pb-0">
              <div className="mx-auto flex w-full max-w-6xl items-center justify-between">
                <div>
                  <AdvancedSettings />
                </div>

                {createVideoStore.videoList.length === 1 ? (
                  <div className="flex items-center gap-2">
                    {(createConfig.createType === "stable" ||
                      createConfig.createType === "latentsync") && (
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div className="cursor-help">
                              <Info className="h-4 w-4 text-gray-500" />
                            </div>
                          </TooltipTrigger>
                          <TooltipContent
                            side="top"
                            sideOffset={14}
                            className="z-50 max-w-xs"
                            avoidCollisions={true}
                          >
                            <p>{t("create.takelong")}</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    )}
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
                  </div>
                ) : createVideoStore.videoList.length >= 2 ? (
                  <div className="flex items-center gap-2">
                    {(createConfig.createType === "stable" ||
                      createConfig.createType === "latentsync") && (
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div className="cursor-help">
                              <Info className="h-4 w-4 text-gray-500" />
                            </div>
                          </TooltipTrigger>
                          <TooltipContent
                            side="top"
                            sideOffset={10}
                            className="z-50 max-w-xs"
                            avoidCollisions={true}
                          >
                            <p>该模型所需时间较长</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    )}
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
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </>
      )}

      {/* Video Player Modal */}
      <VideoPlayerModal
        open={videoDialogOpen}
        onOpenChange={setVideoDialogOpen}
        videoUrl={currentVideoUrl}
      />

      {/* Edit Name Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("history.renameVideo")}</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <Input
              value={editingName}
              onChange={(e) => setEditingName(e.target.value)}
              placeholder={t("history.renameVideoPlaceholder")}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  handleSaveEdit();
                } else if (e.key === "Escape") {
                  handleCancelEdit();
                }
              }}
              autoFocus
              maxLength={20}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={handleCancelEdit}>
              {t("history.renameVideoCancel")}
            </Button>
            <Button onClick={handleSaveEdit}>
              {t("history.renameVideoSave")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CreatePage;
