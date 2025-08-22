"use client";
import {
  Plus,
  Clock,
  CheckCircle,
  XCircle,
  Volume2,
  MoreHorizontal,
  Play,
  Pause,
  Edit2,
  Trash2,
} from "lucide-react";
import VoiceCloneModal from "./voice-clone-modal";
import { useState, useMemo, useEffect } from "react";
import { useCustomVoiceDb } from "@/hooks/db/use-custom-voice";
import { useVoiceClonePolling } from "@/hooks/use-voice-clone-polling";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import VoiceList from "./voice-list";
import { useTranslations } from "next-intl";
import ky from "ky";
import { store } from "@/stores";
import { appConfigAtom } from "@/stores/slices/config_store";
import { toast } from "sonner";

const VoiceClone = () => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [playingVoiceId, setPlayingVoiceId] = useState<number | null>(null);
  const [generatingAudio, setGeneratingAudio] = useState<number | null>(null);
  const [tempAudio, setTempAudio] = useState<HTMLAudioElement | null>(null);
  const t = useTranslations();
  const { apiKey } = store.get(appConfigAtom);
  const [renameDialog, setRenameDialog] = useState<{
    open: boolean;
    voiceId: number | null;
    currentName: string;
    newName: string;
  }>({
    open: false,
    voiceId: null,
    currentName: "",
    newName: "",
  });
  const {
    customVoiceData,
    deleteCustomVoiceData,
    updateCustomVoiceDataItemName,
  } = useCustomVoiceDb();

  // 启用轮询 - 当有pending任务时自动启动
  const { startPolling, stopPolling } = useVoiceClonePolling();

  // 当数据加载完成且有pending任务时启动轮询
  useEffect(() => {
    if (!customVoiceData) {
      return;
    }

    const pendingTasks = customVoiceData.filter((v) => v.status === "pending");

    if (pendingTasks.length > 0) {
      startPolling();
    } else {
      stopPolling();
    }

    return () => {
      stopPolling();
    };
  }, [customVoiceData, startPolling, stopPolling]);

  // 计算各状态的统计数据
  const stats = useMemo(() => {
    if (!customVoiceData) {
      return { success: 0, pending: 0, failed: 0, total: 0 };
    }

    const success = customVoiceData.filter(
      (v) => v.status === "success"
    ).length;
    const pending = customVoiceData.filter(
      (v) => v.status === "pending"
    ).length;
    const failed = customVoiceData.filter((v) => v.status === "failed").length;
    const total = customVoiceData.length;

    return { success, pending, failed, total };
  }, [customVoiceData]);

  const handleCloseModal = () => {
    setIsModalOpen(false);
  };

  // 处理音频播放
  const handlePlayVoice = async (
    voiceId: number,
    audioUrl: string,
    voice?: any
  ) => {
    if (playingVoiceId === voiceId) {
      // 如果正在播放同一个声音，则暂停
      if (tempAudio) {
        tempAudio.pause();
        setTempAudio(null);
      } else {
        const audio = document.getElementById(
          `audio-${voiceId}`
        ) as HTMLAudioElement;
        audio?.pause();
      }
      setPlayingVoiceId(null);
      return;
    }

    // 先暂停所有正在播放的音频
    if (playingVoiceId) {
      if (tempAudio) {
        tempAudio.pause();
        setTempAudio(null);
      } else {
        const currentAudio = document.getElementById(
          `audio-${playingVoiceId}`
        ) as HTMLAudioElement;
        currentAudio?.pause();
      }
    }

    // 检查是否为Fish Audio模型
    const isFishAudio =
      voice?.cloneType === "fish_audio" || voice?.model_type === "Fish Audio";

    if (isFishAudio) {
      // Fish Audio需要动态生成音频
      setGeneratingAudio(voiceId);
      try {
        const response = await ky
          .post("/api/gen-fish-voice", {
            json: {
              text: "您好，这是声音预览测试。", // 默认预览文本
              apiKey: apiKey,
              voice: audioUrl, // 对于Fish Audio，audioUrl实际是voice ID
              speed: 1.0,
            },
            timeout: 30000,
          })
          .json<{ audio_url: string }>();

        // 创建临时音频元素播放生成的音频
        const newTempAudio = new Audio(response.audio_url);
        newTempAudio.play();
        setTempAudio(newTempAudio);
        setPlayingVoiceId(voiceId);
        setGeneratingAudio(null);

        // 监听播放结束事件
        newTempAudio.onended = () => {
          setPlayingVoiceId(null);
          setTempAudio(null);
        };
      } catch (error) {
        console.error("Fish Audio生成失败:", error);
        toast.error("音频生成失败，请重试");
        setGeneratingAudio(null);
      }
    } else {
      // 其他模型使用现有逻辑
      const audio = document.getElementById(
        `audio-${voiceId}`
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

  // 打开重命名弹框
  const handleRename = (voiceId: number, currentName: string) => {
    setRenameDialog({
      open: true,
      voiceId,
      currentName,
      newName: currentName,
    });
  };

  // 确认重命名
  const handleRenameConfirm = () => {
    const { voiceId, newName, currentName } = renameDialog;
    if (voiceId && newName.trim() && newName !== currentName) {
      updateCustomVoiceDataItemName(voiceId, newName.trim());
    }
    setRenameDialog({
      open: false,
      voiceId: null,
      currentName: "",
      newName: "",
    });
  };

  // 取消重命名
  const handleRenameCancel = () => {
    setRenameDialog({
      open: false,
      voiceId: null,
      currentName: "",
      newName: "",
    });
  };

  // 处理删除 - 直接删除，无需确认
  const handleDelete = (voiceId: number, voiceName: string) => {
    // 如果正在播放这个声音，先停止播放
    if (playingVoiceId === voiceId) {
      if (tempAudio) {
        tempAudio.pause();
        setTempAudio(null);
      } else {
        const audio = document.getElementById(
          `audio-${voiceId}`
        ) as HTMLAudioElement;
        audio?.pause();
      }
      setPlayingVoiceId(null);
    }
    deleteCustomVoiceData(voiceId);
  };

  return (
    <div className="space-y-6">
      {/* 网格布局：声音克隆按钮 + 声音卡片 */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {/* 创建新的声音克隆 */}
        <div
          role="button"
          aria-label="创建声音克隆"
          className="flex min-h-[160px] cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed p-4 transition-shadow hover:shadow-sm"
          onClick={() => setIsModalOpen(true)}
        >
          <Plus className="mb-3 h-8 w-8" aria-hidden="true" />
          <div className="text-center">
            <div className="mb-1 text-lg font-medium">
              {t("voice.voiceClone.voiceClone")}
            </div>
            <p className="text-sm text-muted-foreground">
              {t("voice.voiceClone.voiceCloneDescription")}
            </p>
          </div>
        </div>

        {/* 声音卡片列表 */}
        {customVoiceData &&
          customVoiceData.map((voice) => (
            <div
              key={voice.id}
              className="group relative flex min-h-[160px] flex-row items-center gap-3 rounded-lg border p-4 transition-shadow hover:shadow-sm"
            >
              {/* 状态图标 - 右上角 */}
              <div className="absolute right-3 top-3">
                {voice.status === "pending" && (
                  <Clock className="h-4 w-4 text-yellow-500" />
                )}
                {voice.status === "success" && (
                  <CheckCircle className="h-4 w-4 text-green-500" />
                )}
                {voice.status === "failed" && (
                  <XCircle className="h-4 w-4 text-red-500" />
                )}
              </div>

              {/* 左侧：声音图标（可点击播放） */}
              <button
                className="relative flex h-12 w-12 flex-shrink-0 items-center justify-center overflow-hidden rounded-full transition-all hover:scale-105 disabled:cursor-not-allowed disabled:opacity-50"
                onClick={() =>
                  voice.status === "success" &&
                  voice.audioUrl &&
                  handlePlayVoice(voice.id!, voice.audioUrl, voice)
                }
                disabled={
                  voice.status !== "success" ||
                  !voice.audioUrl ||
                  generatingAudio === voice.id
                }
              >
                <img
                  src="https://file.302.ai/gpt/imgs/20250723/compressed_066bd9011dda4583beba98f53417b7c1.jpeg"
                  alt="声音图标"
                  className="h-full w-full object-cover"
                />
                {/* 播放状态覆盖层 - 悬浮时显示 */}
                <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-40 opacity-0 transition-opacity hover:opacity-100">
                  {voice.status === "success" && voice.audioUrl ? (
                    generatingAudio === voice.id ? (
                      <div className="h-4 w-4 animate-spin rounded-full border-b-2 border-white"></div>
                    ) : playingVoiceId === voice.id ? (
                      <Pause className="h-6 w-6 text-white" />
                    ) : (
                      <Play className="ml-0.5 h-6 w-6 text-white" />
                    )
                  ) : (
                    <Volume2 className="h-6 w-6 text-white" />
                  )}
                </div>
              </button>

              {/* 中间：声音名称 */}
              <div className="min-w-0 flex-1">
                <div className="truncate text-lg font-medium">{voice.name}</div>
              </div>

              {/* 右侧按钮组 */}
              <div className="flex flex-shrink-0 items-center gap-2">
                {/* 菜单按钮 - 悬浮时显示 */}
                <Popover>
                  <PopoverTrigger asChild>
                    <button className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-100 opacity-0 transition-all hover:bg-gray-200 group-hover:opacity-100">
                      <MoreHorizontal className="h-4 w-4 text-gray-600" />
                    </button>
                  </PopoverTrigger>
                  <PopoverContent className="w-48 p-1" align="end">
                    <div className="space-y-1">
                      <button
                        className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors hover:bg-gray-100"
                        onClick={() => handleRename(voice.id!, voice.name)}
                      >
                        <Edit2 className="h-4 w-4" />
                        {t("voice.voiceClone.rename")}
                      </button>
                      <button
                        className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm text-red-600 transition-colors hover:bg-red-50"
                        onClick={() => handleDelete(voice.id!, voice.name)}
                      >
                        <Trash2 className="h-4 w-4" />
                        {t("voice.voiceClone.delete")}
                      </button>
                    </div>
                  </PopoverContent>
                </Popover>

                {/* 去创作按钮 */}
                {/* <Button
                  size="sm"
                  variant="outline"
                  className="h-8 px-3 text-xs"
                >
                  去创作
                </Button> */}
              </div>

              {/* 隐藏的音频元素 */}
              {voice.status === "success" && voice.audioUrl && (
                <audio
                  id={`audio-${voice.id}`}
                  preload="none"
                  className="hidden"
                >
                  <source src={voice.audioUrl} type="audio/wav" />
                </audio>
              )}
            </div>
          ))}
      </div>

      {/* 音色库 */}
      <div>
        <VoiceList />
      </div>

      <VoiceCloneModal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        onOpenChange={setIsModalOpen}
      />

      {/* 重命名弹框 */}
      <Dialog
        open={renameDialog.open}
        onOpenChange={(open) => !open && handleRenameCancel()}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("voice.voiceClone.rename")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="voice-name">
                {t("voice.voiceClone.modelNamePlaceholder")}
              </Label>
              <Input
                id="voice-name"
                value={renameDialog.newName}
                onChange={(e) =>
                  setRenameDialog((prev) => ({
                    ...prev,
                    newName: e.target.value,
                  }))
                }
                placeholder="请输入新的声音名称"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    handleRenameConfirm();
                  }
                  if (e.key === "Escape") {
                    handleRenameCancel();
                  }
                }}
                autoFocus
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={handleRenameCancel}>
              取消
            </Button>
            <Button
              onClick={handleRenameConfirm}
              disabled={
                !renameDialog.newName.trim() ||
                renameDialog.newName === renameDialog.currentName
              }
            >
              确定
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default VoiceClone;
