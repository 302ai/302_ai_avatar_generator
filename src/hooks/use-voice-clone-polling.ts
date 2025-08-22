import { useEffect, useRef, useCallback } from "react";
import { useCustomVoiceDb } from "@/hooks/db/use-custom-voice";
import { store } from "@/stores";
import { appConfigAtom } from "@/stores/slices/config_store";
import ky from "ky";
import { toast } from "sonner";

interface VoiceCloneStatusResponse {
  _id: string;
  title: string;
  type: string;
  visibility: string;
  status: "pending" | "success" | "failed";
  progress: number;
  audio_path: string | null;
  err_msg: string;
}

export const useVoiceClonePolling = () => {
  const {
    customVoiceData,
    updateCustomVoiceDataItemStatus,
    updateCustomVoiceDataItemAudioUrl,
  } = useCustomVoiceDb();

  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // 获取最新的API key
  const getApiKey = useCallback(() => {
    const { apiKey } = store.get(appConfigAtom);
    return apiKey;
  }, []);

  // 查询单个任务状态
  const checkTaskStatus = useCallback(
    async (taskId: string, voiceId: number) => {
      const apiKey = getApiKey();
      if (!apiKey) {
        console.log("No API key available, skipping status check");
        return;
      }

      try {
        console.log(
          `Checking status for task ${taskId} with API key: ${apiKey.substring(0, 8)}...`
        );
        const response = await ky
          .get("/api/voice-clone-status", {
            searchParams: {
              id: taskId,
              apiKey: apiKey,
            },
            timeout: 30000,
          })
          .json<VoiceCloneStatusResponse>();

        console.log(`Status response for task ${taskId}:`, response);

        // 根据状态更新数据库
        if (response.status === "success") {
          await updateCustomVoiceDataItemStatus(voiceId, "success");
          if (response.audio_path) {
            await updateCustomVoiceDataItemAudioUrl(
              voiceId,
              response.audio_path
            );
          }
          // toast.success(`声音 "${response.title}" 生成成功！`);
          console.log(`Task ${taskId} completed successfully`);
        } else if (response.status === "failed") {
          await updateCustomVoiceDataItemStatus(voiceId, "failed");
          toast.error(
            `声音 "${response.title}" 生成失败: ${response.err_msg || "未知错误"}`
          );
          console.log(`Task ${taskId} failed`);
        } else {
          console.log(
            `Task ${taskId} still pending, progress: ${response.progress}%`
          );
        }

        return response;
      } catch (error) {
        console.error(`Error checking status for task ${taskId}:`, error);
        return null;
      }
    },
    [
      getApiKey,
      updateCustomVoiceDataItemStatus,
      updateCustomVoiceDataItemAudioUrl,
    ]
  );

  // 轮询所有pending任务
  const pollPendingTasks = useCallback(async () => {
    if (!customVoiceData) return;

    const pendingVoices = customVoiceData.filter(
      (voice) => voice.status === "pending"
    );

    if (pendingVoices.length === 0) {
      return;
    }

    // 并发查询所有pending任务
    const statusPromises = pendingVoices.map((voice) =>
      checkTaskStatus(voice.loopId, voice.id!)
    );

    await Promise.allSettled(statusPromises);
  }, [customVoiceData, checkTaskStatus]);

  // 启动轮询 - 移除customVoiceData依赖，让pollPendingTasks内部处理数据检查
  const startPolling = useCallback(async () => {
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
    }

    // 立即执行一次轮询检查
    await pollPendingTasks();

    // 设置定时轮询，每10秒检查一次
    pollingIntervalRef.current = setInterval(async () => {
      await pollPendingTasks();
    }, 10000);

    console.log("Voice clone polling started");
  }, [pollPendingTasks]);

  // 停止轮询
  const stopPolling = useCallback(() => {
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
      console.log("Voice clone polling stopped");
    }
  }, []);

  // 移除自动轮询逻辑，避免无限循环
  // 轮询现在需要手动通过startPolling()启动

  // 组件卸载时清理
  useEffect(() => {
    return () => {
      stopPolling();
    };
  }, []);

  return {
    startPolling,
    stopPolling,
    pollPendingTasks,
    checkTaskStatus,
  };
};
