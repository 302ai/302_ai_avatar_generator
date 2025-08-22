"use client";

import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Plus, Download, Trash2, CirclePlus } from "lucide-react";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { SelectAvatarDialog } from "./SelectAvatarDialog";
import { VideoPlayerModal } from "../../create/components/VideoPlayerModal";
import { createImageToVideo } from "@/services/gen-image-to-video";
import { appConfigAtom, store } from "@/stores";
import { useMovementsDb } from "@/hooks/db/use-movements-db";
import { Movement } from "@/db/types";
import { toast } from "sonner";
import { SaveAsMaterialModal } from "./save-as-material-modal";
import { useAvatarDb } from "@/hooks/db/use-avatar-db";
import { CreateAvatarDialog } from "./CreateAvatarDialog";
import { useTranslations } from "next-intl";

interface CreateActionTabProps {
  // 状态 props
  selectDialogOpen: boolean;
  setSelectDialogOpen: (open: boolean) => void;
  selectedAvatar: any;
  setSelectedAvatar: (avatar: any) => void;
  prompt: string;
  setPrompt: (prompt: string) => void;
  model: string;
  setModel: (model: string) => void;
  isGenerating?: boolean;
  setIsGenerating?: (generating: boolean) => void;
}

export const CreateActionTab: React.FC<CreateActionTabProps> = ({
  selectDialogOpen,
  setSelectDialogOpen,
  selectedAvatar,
  setSelectedAvatar,
  prompt,
  setPrompt,
  model,
  setModel,
  isGenerating = false,
  setIsGenerating,
}) => {
  const { apiKey } = store.get(appConfigAtom);
  const { movementsData, addMovementData, deleteMovementData } =
    useMovementsDb();
  const { updateAvatarDataItemVideoUrl } = useAvatarDb();
  const [isVideoModalOpen, setIsVideoModalOpen] = useState(false);
  const [currentVideoUrl, setCurrentVideoUrl] = useState<string | null>(null);
  const [isSaveVideoModalOpen, setIsSaveVideoModalOpen] = useState(false);
  const [selectedMovement, setSelectedMovement] = useState<Movement | null>(
    null
  );
  const [selectedAvatarId, setSelectedAvatarId] = useState<string | null>(null);
  const t = useTranslations();

  // 创建数字人弹框状态
  const [isCreateAvatarDialogOpen, setIsCreateAvatarDialogOpen] =
    useState(false);
  const [selectedMovementForAvatar, setSelectedMovementForAvatar] =
    useState<Movement | null>(null);

  const handleAvatarSelected = (avatar: any) => {
    setSelectedAvatar(avatar);
  };

  const handlePlayVideo = (videoUrl: string) => {
    setCurrentVideoUrl(videoUrl);
    setIsVideoModalOpen(true);
  };

  const handleDownloadVideo = async (
    videoUrl: string,
    fileName: string = "video.mp4"
  ) => {
    try {
      const response = await fetch(videoUrl);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error("下载视频失败:", error);
      toast.error("下载失败，请重试");
    }
  };

  const handleDeleteMovement = async (movementId: string) => {
    try {
      await deleteMovementData(movementId);
      // toast.success("删除成功");
    } catch (error) {
      console.error("删除动作失败:", error);
      toast.error("删除失败，请重试");
    }
  };

  const handleSaveVideo = (movement: Movement) => {
    setSelectedMovement(movement);
    setIsSaveVideoModalOpen(true);
  };

  // 保存视频到Avatar的函数
  const handleSaveVideoToAvatar = async (avatarId: string) => {
    if (!selectedMovement) return;
    await updateAvatarDataItemVideoUrl(avatarId, selectedMovement.url);
    // toast.success("视频链接已保存到数字人");
  };

  // 创建数字人功能
  const handleCreateAvatar = (movement: Movement) => {
    setSelectedMovementForAvatar(movement);
    setIsCreateAvatarDialogOpen(true);
  };

  // 将 Movement 数据转换为 CreateAvatarDialog 期望的格式
  const convertMovementToImageData = (movement: Movement | null) => {
    if (!movement) return null;

    return {
      id: movement.id,
      image_url: movement.thumbnailImage,
      prompt: movement.prompt,
      age: "young",
      gender: "male",
      region: "china",
      referenceType: "character-appearance",
      referenceContent: "",
      model: movement.model,
      aspectRatio: "9:16",
      quantity: 1,
      createdAt: movement.createdAt,
    };
  };

  const handleGenerate = async () => {
    if (!selectedAvatar) {
      toast.error("请先选择数字人员");
      return;
    }

    // 获取图片URL，根据不同类型处理
    let imageUrl = "";
    if (selectedAvatar.type === "upload") {
      imageUrl = selectedAvatar.uploadUrl || selectedAvatar.preview;
    } else if (selectedAvatar.type === "created" && selectedAvatar.data) {
      imageUrl = selectedAvatar.data.pic_url;
    }

    if (!imageUrl) {
      toast.error("未找到有效的图片URL");
      return;
    }

    try {
      // 设置生成中状态
      if (setIsGenerating) {
        setIsGenerating(true);
      }

      toast.loading("正在生成视频...", { id: "video-generation" });

      const res = await createImageToVideo({
        apiKey: apiKey!,
        prompt: prompt === "" ? t("avatar.promptPlaceholder2") : prompt,
        model,
        image: imageUrl,
      });

      // 检查响应结果 - 根据新的返回结构 {status, url}
      if (res.status === "success" && res.url) {
        // 获取缩略图（使用选择的头像图片作为缩略图）
        let thumbnailImage = "";
        if (selectedAvatar.type === "upload") {
          thumbnailImage = selectedAvatar.uploadUrl || selectedAvatar.preview;
        } else if (selectedAvatar.type === "created" && selectedAvatar.data) {
          thumbnailImage = selectedAvatar.data.pic_url;
        }

        const newMovement: Movement = {
          id: `movement-${Date.now()}`,
          url: res.url,
          status: res.status,
          prompt: prompt,
          model: model,
          selectedAvatar: selectedAvatar,
          thumbnailImage: thumbnailImage,
          createdAt: new Date(),
        };

        // 添加到数据库
        await addMovementData(newMovement);

        toast.success("视频生成成功！", { id: "video-generation" });
      } else {
        throw new Error("视频生成失败：响应格式错误");
      }
    } catch (error) {
      console.error("生成动作失败:", error);
      toast.error("视频生成失败，请重试", { id: "video-generation" });
    } finally {
      // 重置生成中状态
      if (setIsGenerating) {
        setIsGenerating(false);
      }
    }
  };

  return (
    <div className="flex h-full gap-6 overflow-hidden">
      {/* 左侧操作栏 */}
      <div className="flex min-w-[400px] flex-[3] flex-col overflow-hidden">
        <div className="mb-2 flex-1 space-y-4 overflow-y-auto px-4 pb-2">
          <div className="mb-4">
            <Label className="mb-2 block text-sm">
              {t("avatar.avatarMaterial")}
            </Label>
          </div>

          <div className="space-y-6">
            <div
              className="flex h-[200px] cursor-pointer items-center rounded-lg border-2 border-dashed p-4 text-center transition-colors hover:border-primary/50 hover:bg-primary/5"
              onClick={() => setSelectDialogOpen(true)}
            >
              {selectedAvatar ? (
                <div className="flex h-full w-full flex-col items-center justify-center">
                  <div className="flex h-full w-full items-center justify-center">
                    <div className="relative flex h-40 w-40 items-center justify-center rounded-lg border bg-gray-50">
                      <img
                        src={
                          selectedAvatar.type === "upload"
                            ? selectedAvatar.preview
                            : selectedAvatar.data?.pic_url || ""
                        }
                        alt="选择的头像"
                        className="h-full w-full object-contain"
                      />
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedAvatar(null);
                        }}
                        className="absolute -right-2 top-0 flex h-6 w-6 items-center justify-center rounded-full bg-red-500 text-white shadow-md transition-colors hover:bg-red-600"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex h-full w-full cursor-pointer flex-col items-center justify-center gap-y-2 rounded py-4 transition-colors">
                  <CirclePlus className="size-6" />
                  <span className="text-sm">{t("avatar.selectAvatar")}</span>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label className="text-sm">{t("avatar.prompt")}</Label>
              <Textarea
                placeholder={t("avatar.promptPlaceholder2")}
                className="min-h-[80px] resize-none"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
              />
            </div>

            <div className="flex items-center justify-between">
              <Label className="text-sm">{t("avatar.selectModel")}</Label>
              <Select value={model} onValueChange={setModel}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="kling_21_i2v_hq">kling2.1</SelectItem>
                  <SelectItem value="minimaxi_hailuo_02_i2v">
                    minimax02
                  </SelectItem>
                  {/* <SelectItem value="seadance">seadance</SelectItem> */}
                  <SelectItem value="midjourney_i2v">midjourney</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* 固定在底部的生成按钮 */}
        <div className="flex flex-shrink-0 items-center justify-end px-4">
          <Button
            className="rounded-lg py-3 font-medium"
            onClick={handleGenerate}
            disabled={isGenerating}
          >
            {isGenerating ? t("avatar.generating") : t("avatar.generate")}
          </Button>
        </div>
      </div>

      {/* 右侧动作展示栏 */}
      <div className="flex min-w-[450px] max-w-[500px] flex-[2] flex-col overflow-hidden border-l pl-6">
        {/* <div className="mb-4">
          <h3 className="text-lg font-semibold">生成的动作</h3>
        </div> */}
        <div className="flex-1 overflow-y-auto">
          {movementsData && movementsData.length > 0 ? (
            <div className="space-y-3 pb-4">
              {movementsData.map((action, index) => (
                <div
                  key={index}
                  className="group relative overflow-hidden rounded-lg border"
                >
                  <div className="flex h-48 w-full items-center justify-center bg-gray-100">
                    <img
                      src={action.thumbnailImage}
                      alt="Generated movement thumbnail"
                      className="max-h-full max-w-full object-contain"
                    />
                  </div>

                  {/* 右上角操作按钮 */}
                  <div className="absolute right-2 top-2 z-10 flex gap-2 opacity-0 transition-opacity duration-300 group-hover:opacity-100">
                    <Button
                      size="sm"
                      variant="secondary"
                      className="h-8 w-8 rounded-full bg-white/90 p-0 text-gray-900 hover:bg-white"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDownloadVideo(
                          action.url,
                          `video-${action.id}.mp4`
                        );
                      }}
                    >
                      <Download className="h-4 w-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      className="h-8 w-8 rounded-full bg-red-500/90 p-0 text-white hover:bg-red-600"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteMovement(action.id);
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>

                  {/* 悬停时显示的操作按钮 */}
                  <div className="absolute inset-0 z-0 flex flex-col items-center justify-center bg-black/60 opacity-0 transition-opacity duration-300 group-hover:opacity-100">
                    <div className="flex flex-col gap-1 p-2">
                      <Button
                        size="sm"
                        variant="secondary"
                        className="w-full bg-white/90 text-xs text-gray-900 hover:bg-white"
                        onClick={(e) => {
                          e.stopPropagation();
                          handlePlayVideo(action.url);
                        }}
                      >
                        {t("avatar.play")}
                      </Button>
                      <Button
                        size="sm"
                        variant="secondary"
                        className="w-full bg-white/90 text-xs text-gray-900 hover:bg-white"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSaveVideo(action);
                        }}
                      >
                        {t("avatar.saveAsVideoMaterial")}
                      </Button>
                      <Button
                        size="sm"
                        variant="secondary"
                        className="w-full bg-white/90 text-xs text-gray-900 hover:bg-white"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleCreateAvatar(action);
                        }}
                      >
                        {t("avatar.createAvatar")}
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex h-full items-center justify-center text-center text-gray-500">
              <div>
                <p>{t("avatar.noGeneratedActions")}</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 选择头像弹框 */}
      <SelectAvatarDialog
        open={selectDialogOpen}
        onOpenChange={setSelectDialogOpen}
        onAvatarSelected={handleAvatarSelected}
      />

      {/* 视频播放弹框 */}
      <VideoPlayerModal
        open={isVideoModalOpen}
        onOpenChange={setIsVideoModalOpen}
        videoUrl={currentVideoUrl}
      />

      {/* 保存为视频素材弹框 */}
      <SaveAsMaterialModal
        isOpen={isSaveVideoModalOpen}
        setIsOpen={setIsSaveVideoModalOpen}
        selectedAvatarId={selectedAvatarId}
        setSelectedAvatarId={setSelectedAvatarId}
        title={t("avatar.saveAsVideoMaterial")}
        onSave={handleSaveVideoToAvatar}
      />

      {/* 创建数字人弹框 */}
      <CreateAvatarDialog
        open={isCreateAvatarDialogOpen}
        onOpenChange={setIsCreateAvatarDialogOpen}
        imageData={convertMovementToImageData(selectedMovementForAvatar)}
      />
    </div>
  );
};
