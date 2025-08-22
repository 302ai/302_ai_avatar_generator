"use client";

import { useHistoryDb } from "@/hooks/db/use-db";
import {
  Play,
  Download,
  Edit2,
  EllipsisVertical,
  FolderPen,
  RotateCcw,
  Trash2,
} from "lucide-react";
import Image from "next/image";
import { useState, useEffect, useCallback } from "react";
import { VideoPlayerModal } from "../create/components/VideoPlayerModal";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { appConfigAtom, store } from "@/stores";
import ky from "ky";
import { useTranslations } from "next-intl";
import { useRouter, useParams } from "next/navigation";
import { useAtom } from "jotai";
import { createVideoStoreAtom } from "@/stores/slices/create_video";
import { createConfigAtom } from "@/stores/slices/create_config";
import { mergeVideo } from "@/services/merge-video";
import { pollMergeVideo } from "@/services/poll-merge-video";
import { pollOmnihumanVideo } from "@/services/gen-omnihuman-video";
import { db } from "@/db";

const HistoryPage = () => {
  const t = useTranslations();
  const router = useRouter();
  const params = useParams();
  const [, setCreateVideoStore] = useAtom(createVideoStoreAtom);
  const [, setCreateConfig] = useAtom(createConfigAtom);
  const [companyFilter, setCompanyFilter] = useState<
    "all" | "chanjing" | "hedra" | "Omnihuman"
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
  const { apiKey } = store.get(appConfigAtom);

  // 跟踪正在轮询的任务ID，避免重复请求
  const [pollingTasks, setPollingTasks] = useState<Set<string>>(new Set());

  // 跟踪已处理的任务，防止重复处理
  const [processedTasks, setProcessedTasks] = useState<Set<string>>(new Set());

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

  // 编辑状态管理
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState<string>("");
  const [editingIsMergeTask, setEditingIsMergeTask] = useState(false);

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

    // 跳转到创建页面
    const locale = params.locale as string;
    router.push(`/${locale}/create`);
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

    // 跳转到创建页面
    const locale = params.locale as string;
    router.push(`/${locale}/create`);
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

      const firstChild = childTasks[0];
      if (companyFilter === "chanjing") {
        return (
          firstChild?.model === "chanjing" ||
          firstChild?.createType === "chanjing"
        );
      } else if (companyFilter === "hedra") {
        return (
          firstChild?.model === "hedra" || firstChild?.createType === "hedra"
        );
      } else if (companyFilter === "Omnihuman") {
        return (
          firstChild?.model === "Omnihuman" ||
          firstChild?.createType === "Omnihuman"
        );
      }

      return true;
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
    return (
      <div className="relative w-full overflow-hidden rounded-2xl border border-solid">
        {/* Video content area */}
        <div className="group relative aspect-video overflow-hidden">
          {/* 平台标签 - 左上角 */}
          <div className="absolute left-2 top-2 z-10">
            <Badge variant="secondary" className=" ">
              {item.model === "chanjing"
                ? "蝉镜"
                : item.model === "hedra"
                  ? "Hedra"
                  : "Omnihuman"}
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
              ? item.model === "hedra" || item.model === "Omnihuman"
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
              <div className="flex h-full items-center justify-center p-8 text-center">
                <div>
                  {item.taskStatus === "pending" ? (
                    <></>
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
                  return childHistoryItem?.model === "chanjing"
                    ? "蝉镜"
                    : childHistoryItem?.model === "hedra"
                      ? "Hedra"
                      : "Omnihuman";
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
                  childHistoryItem.model === "Omnihuman"
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

  return (
    <div className="p-4 sm:p-6">
      <div className="mb-6 flex flex-col gap-4">
        <h1 className="text-2xl font-bold sm:text-xl">{t("history.title")}</h1>

        {/* 公司过滤器 */}
        <div className="w-96">
          <Tabs
            value={companyFilter}
            onValueChange={(value) =>
              setCompanyFilter(
                value as "all" | "chanjing" | "hedra" | "Omnihuman"
              )
            }
          >
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="all">{t("history.all")}</TabsTrigger>
              <TabsTrigger value="chanjing">蝉镜</TabsTrigger>
              <TabsTrigger value="hedra">Hedra</TabsTrigger>
              <TabsTrigger value="Omnihuman">Omnihuman</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </div>

      {allDisplayItems.length === 0 ? (
        <div className="flex min-h-[400px] flex-col items-center justify-center rounded-lg text-center">
          {/* <div className="mb-4 text-6xl text-gray-400">📹</div> */}
          <h3 className="mb-2 text-lg font-medium text-gray-900">
            {t("history.noWorks")}
          </h3>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
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

export default HistoryPage;
