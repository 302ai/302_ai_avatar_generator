"use client";

import React, { useCallback, useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Play,
  Download,
  EllipsisVertical,
  RotateCcw,
  Trash2,
  Edit2,
  Plus,
} from "lucide-react";
import Image from "next/image";
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
import { VideoPlayerModal } from "./VideoPlayerModal";
import { useHistoryDb } from "@/hooks/db/use-db";
import { useTranslations } from "next-intl";
import { useAtom } from "jotai";
import { createVideoStoreAtom } from "@/stores/slices/create_video";
import { createConfigAtom } from "@/stores/slices/create_config";
import { openWelcomeModalAtom } from "@/stores/slices/welcome_modal";
import { appConfigAtom, store } from "@/stores";
import { pollOmnihumanVideo } from "@/services/gen-omnihuman-video";
import { mergeVideo } from "@/services/merge-video";
import { pollMergeVideo } from "@/services/poll-merge-video";
import { db } from "@/db";
import ky from "ky";

interface HistoryListViewProps {
  onSwitchToCreate: () => void;
}

export const HistoryListView: React.FC<HistoryListViewProps> = ({
  onSwitchToCreate,
}) => {
  const t = useTranslations();
  const { apiKey } = store.get(appConfigAtom);
  const [, setCreateVideoStore] = useAtom(createVideoStoreAtom);
  const [, setCreateConfig] = useAtom(createConfigAtom);
  const [, openWelcomeModal] = useAtom(openWelcomeModalAtom);

  // Company filter state
  const [companyFilter, setCompanyFilter] = useState<
    "all" | "chanjing" | "hedra" | "Omnihuman"
  >("all");

  // History data
  const {
    historyData,
    updateHistoryDataItem,
    deleteHistoryDataItem,
    mergeHistoryData,
    updateMergeHistoryItem,
    deleteMergeHistoryItem,
    findMergeHistoryByChildTask,
  } = useHistoryDb();

  // Modal states
  const [videoDialogOpen, setVideoDialogOpen] = useState(false);
  const [currentVideoUrl, setCurrentVideoUrl] = useState<string | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState<string>("");
  const [editingIsMergeTask, setEditingIsMergeTask] = useState(false);

  // Polling states
  const [pollingTasks, setPollingTasks] = useState<Set<string>>(new Set());
  const [processedTasks, setProcessedTasks] = useState<Set<string>>(new Set());

  // Video click handler
  const handleVideoClick = (videoUrl: string) => {
    setCurrentVideoUrl(videoUrl);
    setVideoDialogOpen(true);
  };

  // Regenerate handlers
  const handleRegenerate = (item: any) => {
    setCreateConfig({
      createType:
        item.createType ||
        (item.model === "hedra"
          ? "hedra"
          : item.model === "Omnihuman"
            ? "Omnihuman"
            : "chanjing"),
      resolution: "16:9",
      hedraSettings: {
        videoResolution: item.videoResolution || "720p",
      },
      chanjingSettings: {
        driveMode: item.driveMode || "",
        backway: item.backway || 2,
      },
    });

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
          videoUrl: item.originalVideoUrl || item.videoUrl,
          wavUrl: "",
          mode: item.mode,
          audioFile: "",
          subtitleConfig: item.subtitleConfig,
        },
      ],
    });

    onSwitchToCreate();
  };

  const handleRegenerateMerge = async (mergeTask: any) => {
    const childTasks = await Promise.all(
      mergeTask.childTaskIds.map(async (childId: string) => {
        const childItem = historyData?.find((h) => h.id === childId);
        return childItem;
      })
    );

    const validChildTasks = childTasks.filter((child) => child != null);

    if (validChildTasks.length === 0) {
      console.error("No valid child tasks found for merge task");
      return;
    }

    const firstChild = validChildTasks[0];
    setCreateConfig({
      createType:
        firstChild.createType ||
        (firstChild.model === "hedra"
          ? "hedra"
          : firstChild.model === "Omnihuman"
            ? "Omnihuman"
            : "chanjing"),
      resolution: "16:9",
      hedraSettings: {
        videoResolution: firstChild.videoResolution || "720p",
      },
      chanjingSettings: {
        driveMode: firstChild.driveMode || "",
        backway: firstChild.backway || 2,
      },
    });

    setCreateVideoStore({
      videoList: validChildTasks.map((child) => ({
        id: crypto.randomUUID(),
        createdAt: Date.now(),
        platform: child.platform,
        voice: child.voice,
        text: child.text,
        avatarImage: child.avatarImage,
        backgroundImage: child.backgroundImage || "",
        videoUrl: child.originalVideoUrl || child.videoUrl,
        wavUrl: "",
        mode: child.mode,
        audioFile: "",
        subtitleConfig: child.subtitleConfig,
      })),
    });

    onSwitchToCreate();
  };

  // Edit handlers
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

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditingName("");
    setEditingIsMergeTask(false);
    setEditDialogOpen(false);
  };

  // Download handler
  const handleDownload = async (item: any) => {
    if (!item.video_url && !item.videoUrl) {
      console.error("No video URL available for download");
      return;
    }

    const videoUrl = item.video_url || item.videoUrl;
    const fileName = `${item.name || t("avatar.noName")}.mp4`;

    try {
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
      const link = document.createElement("a");
      const blobUrl = window.URL.createObjectURL(blob);

      link.href = blobUrl;
      link.download = fileName;
      link.rel = "noopener";
      link.click();
      window.URL.revokeObjectURL(blobUrl);
    } catch (error) {
      console.error("Download failed:", error);
      try {
        const link = document.createElement("a");
        link.href = videoUrl;
        link.download = fileName;
        link.target = "_blank";
        link.rel = "noopener noreferrer";
        link.click();
      } catch (fallbackError) {
        console.error("Fallback download also failed:", fallbackError);
        navigator.clipboard.writeText(videoUrl).then(() => {
          alert("下载失败，视频链接已复制到剪贴板");
        });
      }
    }
  };

  // Delete handler
  const handleDelete = async (id: string, isMergeTask: boolean = false) => {
    if (isMergeTask) {
      await deleteMergeHistoryItem(id);
    } else {
      await deleteHistoryDataItem(id);
    }
  };

  // Status badge helpers
  const getStatusBadge = (item: any) => {
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

  const getMergeStatusBadge = (mergeTask: any) => {
    switch (mergeTask.status) {
      case "pending":
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

  // Data filtering
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

  const individualTasks =
    historyData?.filter((item) => {
      return !mergeHistoryData?.some((merge) =>
        merge.childTaskIds.includes(item.id)
      );
    }) || [];

  const filteredIndividualTasks = filterItemsByCompany(individualTasks);

  const filteredMergeHistoryData =
    mergeHistoryData?.filter((merge) => {
      if (companyFilter === "all") {
        return true;
      }

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

  // Render functions
  const renderCreateCard = () => {
    return (
      <div className="relative w-full overflow-hidden rounded-2xl border border-solid">
        <div
          className="group relative aspect-video cursor-pointer overflow-hidden bg-gray-50 transition-colors hover:bg-gray-100"
          onClick={() => {
            console.log("🎯 Create card clicked, opening welcome modal");
            // 打开modal前清空createType，确保只有用户选择公司后才有有效值
            setCreateConfig((prev) => ({ ...prev, createType: "" as any }));
            openWelcomeModal();
          }}
        >
          {/* 左上角标签位置 - 保持和历史记录一致 */}
          <div className="absolute left-2 top-2 z-10">
            <Badge variant="secondary" className="bg-blue-100 text-blue-700">
              新建
            </Badge>
          </div>

          {/* 中心内容 */}
          <div className="flex h-full items-center justify-center">
            <div className="flex flex-col items-center gap-2 text-gray-500">
              <Plus className="h-12 w-12" />
              <span className="text-sm font-medium">创建新视频</span>
            </div>
          </div>
        </div>

        {/* 底部信息区域 - 和历史记录保持一致的结构 */}
        <div className="border-t border-solid p-4">
          <div className="flex items-center justify-between">
            <div className="flex flex-1 flex-col gap-1">
              <div className="text-sm font-medium text-gray-600">
                点击开始创建
              </div>
              <div className="text-xs text-gray-400">选择平台和配置</div>
            </div>
            <div className="flex items-center">
              <Badge variant="outline" className="text-xs">
                就绪
              </Badge>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderIndividualTask = (item: any) => {
    return (
      <div className="relative w-full overflow-hidden rounded-2xl border border-solid">
        <div className="group relative aspect-video overflow-hidden">
          <div className="absolute left-2 top-2 z-10">
            <Badge variant="secondary">
              {item.model === "chanjing"
                ? "蝉镜"
                : item.model === "hedra"
                  ? "Hedra"
                  : "Omnihuman"}
            </Badge>
          </div>

          {((item.video_url || item.videoUrl) &&
            item.taskStatus === "success") ||
          item.taskStatus === "failed" ? (
            <div className="absolute right-2 top-2 z-10 flex gap-1">
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

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button size="sm" variant="ghost" className="h-8 w-8 p-0">
                    <EllipsisVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => handleRegenerate(item)}>
                    <RotateCcw className="mr-2 h-4 w-4" />
                    {t("history.regenerate")}
                  </DropdownMenuItem>
                  {item.taskStatus === "success" && (
                    <DropdownMenuItem
                      onClick={() => handleStartEdit(item.id, item.name)}
                    >
                      <Edit2 className="mr-2 h-4 w-4" />
                      {t("history.renameVideo")}
                    </DropdownMenuItem>
                  )}
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
            const getFirstImageUrl = (imageUrl: string) => {
              if (!imageUrl) return "";
              return imageUrl.split(",")[0].trim();
            };

            const shouldShowPreview =
              item.taskStatus === "success" ||
              (item.taskStatus !== "pending" &&
                item.taskStatus !== "failed" &&
                item.status === 30);

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
                <div></div>
              </div>
            );
          })()}
        </div>
        <div className="border-t border-solid p-4">
          <div className="flex items-center justify-between">
            <div className="flex flex-1 flex-col gap-1">
              <div className="text-sm font-medium">
                {item.name || t("avatar.noName")}
              </div>
              <div className="text-xs text-gray-500">
                {formatDate(item.createdAt)}
              </div>
            </div>
            <div className="flex items-center">{getStatusBadge(item)}</div>
          </div>
        </div>
      </div>
    );
  };

  const renderMergeTask = (mergeTask: any) => {
    const childTasks = mergeTask.childTasks || [];

    return (
      <div className="relative w-full overflow-hidden rounded-2xl border border-solid">
        <div className="group relative aspect-video overflow-hidden">
          <div className="absolute left-2 top-2 z-10">
            <Badge variant="secondary">
              {(() => {
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
                return "Hedra";
              })()}
            </Badge>
          </div>

          <div className="absolute right-2 top-2 z-10 flex gap-1">
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
            const firstSuccessChild = childTasks.find(
              (child: any) => child.status === "success"
            );
            const shouldShowThumbnail =
              mergeTask.status === "completed" && mergeTask.mergedVideoUrl;

            let thumbnailUrl = "";
            if (firstSuccessChild && historyData) {
              const childHistoryItem = historyData.find(
                (item) => item.id === firstSuccessChild.taskId
              );
              if (childHistoryItem) {
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
        <div className="border-t border-solid p-4">
          <div className="flex items-center justify-between">
            <div className="flex flex-1 flex-col gap-1">
              <div className="text-sm font-medium">
                {mergeTask.name || "未命名合并任务"}
              </div>
              <div className="text-xs text-gray-500">
                {formatDate(mergeTask.createdAt)}
              </div>
            </div>
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
          <h3 className="mb-2 text-lg font-medium text-gray-900">
            {t("history.noWorks")}
          </h3>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          <div className="w-full">{renderCreateCard()}</div>
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
