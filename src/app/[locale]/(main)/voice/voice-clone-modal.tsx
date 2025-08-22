import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader, MicIcon, Upload, Circle } from "lucide-react";
import React, { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import ky from "ky";
import { store } from "@/stores";
import { appConfigAtom } from "@/stores/slices/config_store";
import { voiceStoreAtom } from "@/stores/slices/voice_store";
import { useAtom } from "jotai";
// import { ErrorToast } from "@/components/ui/errorToast";
import { useTranslations } from "next-intl";
import { db } from "@/db";
import { CustomVoiceModel } from "@/db/types";

// 声音克隆自定义模型类型定义
interface CustomModel {
  _id: string;
  title: string;
  type: string;
  visibility: string;
  [key: string]: any;
}

// 用于管理音频录制的 hook
const useRecording = () => {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(
    null
  );
  const [chunks, setChunks] = useState<Blob[]>([]);
  const [timer, setTimer] = useState<NodeJS.Timeout | null>(null);
  const start = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      const audioChunks: Blob[] = [];

      recorder.addEventListener("dataavailable", (event) => {
        audioChunks.push(event.data);
      });

      setMediaRecorder(recorder);
      setChunks(audioChunks);
      recorder.start();
      setIsRecording(true);

      // 设置计时器更新录音时长
      const intervalId = setInterval(() => {
        setRecordingDuration((prev) => prev + 100);
      }, 100);

      setTimer(intervalId);
    } catch (e) {
      console.error("无法启动录音:", e);
      toast.error("无法启动录音，请检查麦克风权限");
    }
  }, []);

  const stop = useCallback(() => {
    return new Promise<Blob>((resolve) => {
      if (!mediaRecorder) return resolve(new Blob([]));

      mediaRecorder.addEventListener("stop", () => {
        const audioBlob = new Blob(chunks, { type: "audio/wav" });

        // 停止所有音频轨道
        mediaRecorder.stream.getTracks().forEach((track) => track.stop());

        // 重置状态
        if (timer) clearInterval(timer);
        setTimer(null);
        setIsRecording(false);
        setRecordingDuration(0);
        setMediaRecorder(null);

        resolve(audioBlob);
      });

      mediaRecorder.stop();
    });
  }, [chunks, mediaRecorder, timer]);

  return { isRecording, recordingDuration, start, stop };
};

async function getAudioDuration(blob: Blob): Promise<number> {
  return new Promise((resolve, reject) => {
    const audioContext = new AudioContext();
    const reader = new FileReader();

    reader.onload = function (event) {
      if (event.target?.result instanceof ArrayBuffer) {
        audioContext.decodeAudioData(
          event.target.result,
          (buffer) => {
            const duration = buffer.duration;
            resolve(duration);
          },
          (error) => {
            reject(error);
          }
        );
      }
    };

    reader.onerror = function () {
      reject(new Error("Failed to read the audio blob"));
    };

    reader.readAsArrayBuffer(blob);
  });
}

interface VoiceCloneModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenChange: (open: boolean) => void;
}

export default function VoiceCloneModal({
  isOpen,
  onClose,
  onOpenChange,
}: VoiceCloneModalProps) {
  const t = useTranslations();
  const { apiKey } = store.get(appConfigAtom);
  const [title, setTitle] = useState("");
  const [selectedModel, setSelectedModel] = useState("cicada1.0");
  const { isRecording, recordingDuration, start, stop } = useRecording();
  const [voiceStore, setVoiceStore] = useAtom(voiceStoreAtom);

  const [audioData, setAudioData] = useState<Blob | undefined>();
  const handleToggleRecording = useCallback(async () => {
    if (isRecording) {
      try {
        const data = await stop();

        if (!data || data.size === 0) {
          toast.error(t("voiceClone.noRecordingData"));
          return;
        }

        try {
          const duration = await getAudioDuration(data);

          if (duration < 10) {
            toast.error(t("voice.voiceClone.tooShort"));
            return;
          }
          if (duration > 90) {
            toast.error(t("voice.voiceClone.tooLong"));
            return;
          }
        } catch (durationError) {
          console.error("Error calculating audio duration:", durationError);
          toast.error(t("voice.voiceClone.durationCalculationFailed"));
          return;
        }

        setAudioData(data);
        setFileInfo({
          name: "recording.wav",
          size: data.size,
          type: data.type,
        });
      } catch (e) {
        console.error(e);
        if ((e as any).response) {
          try {
            const errorData = await (e as any).response.json();
            if (errorData.error && errorData.error.err_code) {
              // toast.error(() => ErrorToast(errorData.error.err_code));
              return;
            }
          } catch (parseError) {
            // If parsing fails, continue to default error handling
          }
        }
        toast.error(t("voiceClone.error.recordingEndedFailed"));
      }
    } else {
      await start();
    }
  }, [isRecording, start, stop, t]);

  useEffect(() => {
    if (recordingDuration >= 90000) {
      handleToggleRecording();
    }
  }, [recordingDuration, handleToggleRecording]);

  const [fileInfo, setFileInfo] = useState<{
    name: string;
    size: number;
    type: string;
  }>();

  const handleUploadFile = useCallback(async () => {
    const input = document.createElement("input");

    input.type = "file";
    input.accept = "audio/*";
    input.click();

    input.onchange = async () => {
      const file = input.files?.[0];

      if (!file) {
        toast.error(t("voiceClone.error.noFile"));
        return;
      }

      try {
        const duration = await getAudioDuration(file);

        if (duration < 10) {
          toast.error(t("voiceClone.error.tooShort"));
          return;
        }

        if (duration > 90) {
          toast.error(t("voiceClone.error.tooLong"));
          return;
        }
      } catch (durationError) {
        console.error("Error calculating audio duration:", durationError);
        toast.error(t("error.durationCalculationFailed"));
        return;
      }

      setFileInfo({
        name: file.name,
        size: file.size,
        type: file.type,
      });

      setAudioData(file);
    };
  }, [t]);

  const [isMakingClone, setIsMakingClone] = useState(false);

  const handleMakeClone = useCallback(async () => {
    setIsMakingClone(true);
    if (!audioData) {
      toast.error(t("voiceClone.error.noAudioData"));
      setIsMakingClone(false);
      return;
    }

    if (!title) {
      toast.error(t("voiceClone.error.noModelName"));
      setIsMakingClone(false);
      return;
    }

    if (!apiKey) {
      toast.error(t("voiceClone.error.noApiKey"));
      setIsMakingClone(false);
      return;
    }

    const formData = new FormData();

    // 根据选择的模型决定使用哪个API和参数
    let apiEndpoint = "/api/voice-clone";

    if (selectedModel === "Fish Audio") {
      // Fish Audio API 需要不同的参数
      formData.append("file", audioData, "recording.wav");
      formData.append("title", title);
      formData.append("visibility", "unlist"); // Fish Audio特有参数
      formData.append("type", "tts"); // Fish Audio特有参数
      formData.append("train_mode", "fast"); // Fish Audio特有参数
      formData.append("apiKey", apiKey);
      apiEndpoint = "/api/fish-voice-clone";
    } else {
      // 原有的Cicada模型参数
      formData.append("file", audioData, "recording.wav");
      formData.append("name", title);
      formData.append("model_type", selectedModel);
      formData.append(
        "text",
        "水循环是大自然的循环系统，水从地面蒸发，形成云，然后以雨的形式回到地面。"
      );
      formData.append("apiKey", apiKey);
    }

    try {
      const resp = await ky
        .post(apiEndpoint, {
          body: formData,
          timeout: 120000, // 2分钟超时，只用于创建任务
        })
        .json<any>();

      // 保存到IndexedDB，状态为pending（在重置表单数据之前）
      try {
        const voiceModel: CustomVoiceModel = {
          name: title, // 使用当前的title值
          model_type: selectedModel as CustomVoiceModel["model_type"],
          text:
            selectedModel === "Fish Audio"
              ? "" // Fish Audio 不需要文本参数
              : (formData.get("text") as string),
          status: selectedModel === "Fish Audio" ? "success" : "pending", // Fish Audio 立即完成
          loopId:
            selectedModel === "Fish Audio"
              ? resp._id // Fish Audio 使用 _id，不需要轮询
              : resp.taskId || resp._id, // 其他模型使用taskId作为loopId用于轮询
          audioId: resp._id,
          audioUrl: selectedModel === "Fish Audio" ? resp._id : "", // Fish Audio 使用 _id 作为 audioUrl
          createdAt: Date.now(),
          // 添加类型标识区分 Fish Audio 克隆
          cloneType: selectedModel === "Fish Audio" ? "fish_audio" : "cicada",
        };

        console.log("Preparing to save voice model:", voiceModel);
        console.log(
          "Current form data - title:",
          title,
          "selectedModel:",
          selectedModel
        );
        console.log("Response data:", resp);

        const result = await db.customVoices.add(voiceModel);
        console.log("Voice model saved to DB successfully with ID:", result);

        // 验证数据是否真的保存了
        const savedVoice = await db.customVoices.get(result);
        console.log("Verification - saved voice:", savedVoice);

        // 获取所有声音数据确认
        const allVoices = await db.customVoices.toArray();
        console.log("All voices in DB:", allVoices);

        // toast.success("声音克隆任务已创建");
      } catch (dbError: any) {
        console.error("保存到数据库失败:", dbError);
        console.error("Error details:", dbError);
        console.error("Error name:", dbError.name);
        console.error("Error message:", dbError.message);

        // 如果是主键变更错误，建议用户刷新页面清理缓存
        if (
          dbError.name === "DatabaseClosedError" &&
          dbError.message.includes("primary key")
        ) {
          toast.error("数据库结构更新，请刷新页面后重试");
        } else {
          toast.error("保存失败，但任务已创建");
        }
      }

      // 保存成功后再重置表单和关闭弹框
      setTitle("");
      setAudioData(undefined);
      setFileInfo(undefined);
      setIsMakingClone(false);
      onClose();
    } catch (error: any) {
      toast.error("生成失败");
    } finally {
      setIsMakingClone(false);
    }
  }, [audioData, title, apiKey, onClose, t]);

  function formatFileSize(size: number): string {
    if (size >= 1024 * 1024) {
      return (size / (1024 * 1024)).toFixed(2) + " MB";
    } else {
      return (size / 1024).toFixed(2) + " KB";
    }
  }

  // FieldRow component for consistent form field layout - memoized to prevent re-renders
  const FieldRow = React.useMemo(() => {
    const Component = ({
      label,
      children,
    }: {
      label: string;
      children: React.ReactNode;
    }) => (
      <div className="space-y-2">
        <label className="text-sm font-medium">{label}</label>
        {children}
      </div>
    );
    Component.displayName = "FieldRow";
    return Component;
  }, []);

  // FileButton component for upload functionality - memoized to prevent re-renders
  const FileButton = React.useMemo(() => {
    const Component = () => (
      <Button
        type="button"
        variant="secondary"
        className="rounded-full"
        disabled={isRecording || isMakingClone}
        onClick={handleUploadFile}
      >
        <Upload className="mr-2 h-4 w-4" />
        {t("voice.voiceClone.selectFile")}
      </Button>
    );
    Component.displayName = "FileButton";
    return Component;
  }, [isRecording, isMakingClone, handleUploadFile]);

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl">
        <DialogHeader className="flex items-center justify-between gap-1 border-b pb-4">
          <DialogTitle className="text-lg font-semibold">
            {t("voice.voiceClone.title")}
          </DialogTitle>
        </DialogHeader>

        <form
          className="space-y-8"
          onSubmit={(e) => {
            e.preventDefault();
            onOpenChange(false);
          }}
        >
          {/* 第一行：名称 + 选择克隆模型 */}
          <div className="grid gap-6 md:grid-cols-2">
            <FieldRow label={t("voice.voiceClone.avatarName")}>
              <Input
                value={title}
                placeholder={t("voice.voiceClone.avatarNamePlaceholder")}
                className="h-11"
                aria-label={t("voice.voiceClone.avatarName")}
                onChange={(e) => setTitle(e.target.value)}
              />
            </FieldRow>

            <FieldRow label={t("voice.voiceClone.selectModel")}>
              <Select value={selectedModel} onValueChange={setSelectedModel}>
                <SelectTrigger className="h-11">
                  <SelectValue
                    placeholder={t("voice.voiceClone.selectModel")}
                  />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cicada1.0">Cicada 1.0</SelectItem>
                  <SelectItem value="cicada3.0">Cicada 3.0</SelectItem>
                  <SelectItem value="Fish Audio">Fish Audio</SelectItem>
                  {/* <SelectItem value="fish_audio">Fish Audio</SelectItem> */}
                </SelectContent>
              </Select>
            </FieldRow>
          </div>

          {/* 上传区 */}
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-center gap-3">
              <span className="text-sm text-muted-foreground">
                {t("voice.voiceClone.uploadAudioDesc")}
              </span>

              <FileButton />

              <span className="text-sm text-muted-foreground">
                {t("voice.voiceClone.or")}
              </span>

              <Button
                type="button"
                variant={isRecording ? "destructive" : "secondary"}
                className="rounded-full"
                disabled={isMakingClone}
                onClick={handleToggleRecording}
              >
                {isRecording ? (
                  <Loader className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Circle className="mr-2 h-4 w-4" />
                )}
                {isRecording
                  ? `${t("voice.voiceClone.stopRecord")} ${(
                      recordingDuration / 1000
                    ).toFixed(1)}s`
                  : t("voice.voiceClone.startRecord")}
              </Button>
            </div>
            {fileInfo && (
              <div className="text-center text-xs text-muted-foreground">
                {t("voice.voiceClone.selected")}: {fileInfo.name} (
                {formatFileSize(fileInfo.size)})
              </div>
            )}
          </div>

          {/* 参考文本 */}
          <p className="text-center text-sm leading-6 text-muted-foreground">
            {t("voice.voiceClone.referenceTextRealDesc")}
          </p>

          <DialogFooter className="justify-center">
            <Button
              type="submit"
              disabled={isMakingClone || !audioData || !title}
              onClick={handleMakeClone}
            >
              {isMakingClone ? (
                <>
                  <Loader className="mr-2 h-4 w-4 animate-spin" />
                  {t("voice.voiceClone.making")}
                </>
              ) : (
                t("voice.voiceClone.make")
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
