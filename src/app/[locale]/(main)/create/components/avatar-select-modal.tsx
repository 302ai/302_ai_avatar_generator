"use client";

import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogClose } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { avatars } from "@/constants/avatars";
import { VideoPlayerModal } from "./VideoPlayerModal";
import { useAvatarDb } from "@/hooks/db/use-avatar-db";
import { User, ArrowLeft } from "lucide-react";
import { useAtom } from "jotai";
import { createConfigAtom } from "@/stores/slices/create_config";
import { AvatarVideosView } from "./AvatarVideosView";
import { Avatar } from "@/db/types";
import { createVideoStoreAtom } from "@/stores/slices/create_video";
import { useTranslations } from "next-intl";

// 生成视频缩略图的hook
const useVideoThumbnail = (videoUrl: string) => {
  const [thumbnail, setThumbnail] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(true);
  const [configStore] = useAtom(createConfigAtom);

  useEffect(() => {
    if (!videoUrl) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setThumbnail("");

    const generateThumbnail = () => {
      const video = document.createElement("video");
      video.src = videoUrl;
      video.crossOrigin = "anonymous";
      video.preload = "metadata";
      video.muted = true;

      const handleLoadedMetadata = () => {
        // 尝试多个时间点，避免黑屏
        const timePoints = [
          2,
          1,
          3,
          video.duration * 0.1,
          video.duration * 0.25,
        ];
        let currentIndex = 0;

        const tryTimePoint = () => {
          if (currentIndex < timePoints.length) {
            const time = Math.min(
              timePoints[currentIndex],
              video.duration - 0.1
            );
            if (time > 0) {
              video.currentTime = time;
              return;
            }
          }
          currentIndex++;
          if (currentIndex < timePoints.length) {
            tryTimePoint();
          }
        };

        tryTimePoint();
      };

      let currentIndex = 0;
      const timePoints = [2, 1, 3, video.duration * 0.1, video.duration * 0.25];

      const handleSeeked = () => {
        try {
          const canvas = document.createElement("canvas");
          const ctx = canvas.getContext("2d");

          if (!ctx) {
            setLoading(false);
            return;
          }

          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
          ctx.drawImage(video, 0, 0);

          // 检查是否为黑屏
          const imageData = ctx.getImageData(
            0,
            0,
            Math.min(100, canvas.width),
            Math.min(100, canvas.height)
          );
          const data = imageData.data;
          let brightness = 0;

          for (let i = 0; i < data.length; i += 4) {
            brightness += (data[i] + data[i + 1] + data[i + 2]) / 3;
          }

          const avgBrightness = brightness / (data.length / 4);

          // 如果太暗（可能是黑屏），尝试下一个时间点
          if (avgBrightness < 15 && currentIndex < timePoints.length - 1) {
            currentIndex++;
            const nextTime = Math.min(
              timePoints[currentIndex],
              video.duration - 0.1
            );
            if (nextTime > 0) {
              video.currentTime = nextTime;
              return;
            }
          }

          try {
            const thumbnailData = canvas.toDataURL("image/jpeg", 0.9);
            setThumbnail(thumbnailData);
            setLoading(false);
          } catch (canvasError) {
            console.error("Canvas toDataURL failed:", canvasError);
            setLoading(false);
          }

          // 清理
          video.removeEventListener("loadedmetadata", handleLoadedMetadata);
          video.removeEventListener("seeked", handleSeeked);
          video.removeEventListener("error", handleError);
        } catch (err) {
          console.error("Error generating thumbnail:", err);
          setLoading(false);
        }
      };

      const handleError = () => {
        setLoading(false);
        video.removeEventListener("loadedmetadata", handleLoadedMetadata);
        video.removeEventListener("seeked", handleSeeked);
        video.removeEventListener("error", handleError);
      };

      video.addEventListener("loadedmetadata", handleLoadedMetadata);
      video.addEventListener("seeked", handleSeeked);
      video.addEventListener("error", handleError);

      const timeout = setTimeout(() => {
        setLoading(false);
        video.removeEventListener("loadedmetadata", handleLoadedMetadata);
        video.removeEventListener("seeked", handleSeeked);
        video.removeEventListener("error", handleError);
      }, 10000);

      return () => {
        clearTimeout(timeout);
        video.removeEventListener("loadedmetadata", handleLoadedMetadata);
        video.removeEventListener("seeked", handleSeeked);
        video.removeEventListener("error", handleError);
      };
    };

    const cleanup = generateThumbnail();
    return cleanup;
  }, [videoUrl]);

  return { thumbnail, loading };
};

// 图片素材视图组件
const AvatarImagesView: React.FC<{
  avatar: Avatar;
  onBack: () => void;
  onImageSelected: (imageUrl: string) => void;
}> = ({ avatar, onBack, onImageSelected }) => {
  const [selectedImageUrl, setSelectedImageUrl] = useState<string | null>(null);
  const t = useTranslations();

  const handleImageSelect = (imageUrl: string) => {
    setSelectedImageUrl(imageUrl);
  };

  return (
    <div className="flex h-full flex-col">
      {/* 头部导航 */}
      <div className="flex items-center gap-3 border-b p-6">
        <Button
          variant="ghost"
          size="sm"
          className="h-8 w-8 p-1"
          onClick={onBack}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h3 className="text-lg font-semibold">
            {avatar.name}-{t("create.imageMaterials")}
          </h3>
          <p className="text-sm text-gray-500">
            {t("create.totalImageMaterials", {
              count: avatar.pic_url?.length || 0,
            })}
          </p>
        </div>
      </div>

      {/* 图片素材网格 */}
      <div className="max-h-[600px] flex-1 overflow-y-auto p-6">
        {avatar.pic_url && avatar.pic_url.length > 0 ? (
          <div className="grid grid-cols-2 gap-4">
            {avatar.pic_url.map((imageUrl, index) => (
              <div key={index} className="relative">
                <div
                  className="group relative flex aspect-[4/3] cursor-pointer items-center justify-center overflow-hidden rounded-lg border border-solid border-gray-200 transition-all hover:border-primary hover:shadow-md"
                  onClick={() => handleImageSelect(imageUrl)}
                >
                  <img
                    src={imageUrl}
                    alt={`${avatar.name}图片素材${index + 1}`}
                    className="h-full w-full object-contain"
                    onError={(e) => {
                      e.currentTarget.src = "/placeholder-avatar.png";
                    }}
                  />
                </div>

                {/* 选择按钮 */}
                <div className="mt-3 flex justify-center">
                  <Button
                    size="sm"
                    className={`h-7 px-4 text-xs font-medium ${
                      selectedImageUrl === imageUrl
                        ? "bg-primary text-primary-foreground"
                        : "bg-gray-50 text-gray-700 hover:bg-gray-100"
                    }`}
                    variant={
                      selectedImageUrl === imageUrl ? "default" : "ghost"
                    }
                    onClick={(e) => {
                      e.stopPropagation();
                      handleImageSelect(imageUrl);
                    }}
                  >
                    {selectedImageUrl === imageUrl
                      ? t("create.selected")
                      : t("create.select")}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex min-h-[200px] items-center justify-center text-gray-500">
            <div className="text-center">
              <p>{t("create.noImageMaterial")}</p>
            </div>
          </div>
        )}
      </div>

      {/* 底部操作区 */}
      <div className="border-t bg-gray-50/50 px-6 py-4">
        <div className="flex justify-end">
          <Button
            className="px-6"
            disabled={!selectedImageUrl}
            onClick={() => {
              if (selectedImageUrl) {
                onImageSelected(selectedImageUrl);
              }
            }}
          >
            确定选择
          </Button>
        </div>
      </div>
    </div>
  );
};

// 数字人缩略图组件
const AvatarThumbnail: React.FC<{
  avatar: Avatar;
  onClick: () => void;
  createType?:
    | "hedra"
    | "chanjing"
    | "Omnihuman"
    | "TopView"
    | "stable"
    | "latentsync"
    | null;
}> = ({ avatar, onClick, createType }) => {
  const t = useTranslations();
  const firstVideoUrl =
    avatar.videoUrl && avatar.videoUrl.length > 0 ? avatar.videoUrl[0] : "";
  const { thumbnail, loading } = useVideoThumbnail(firstVideoUrl);
  const fallbackImage =
    avatar.pic_url && avatar.pic_url.length > 0 ? avatar.pic_url[0] : "";

  // For hedra, Omnihuman and stable types, show pic_url[0] directly
  if (
    createType === "hedra" ||
    createType === "Omnihuman" ||
    createType === "stable"
  ) {
    return (
      <div
        className="group relative flex aspect-[4/3] cursor-pointer items-center justify-center overflow-hidden rounded-lg border border-solid border-gray-200 transition-all hover:border-primary hover:shadow-md"
        onClick={onClick}
      >
        <div className="relative h-full w-full overflow-hidden">
          {fallbackImage ? (
            <img
              src={fallbackImage}
              alt={avatar.name}
              className="h-full w-full bg-gray-100 object-contain"
              onError={(e) => {
                e.currentTarget.src = "/placeholder-avatar.png";
              }}
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-gray-100">
              <div className="text-center text-gray-400">
                <User className="mx-auto mb-2 h-8 w-8" />
                <div className="text-sm">{t("create.noMaterial")}</div>
              </div>
            </div>
          )}

          {/* 查看素材按钮覆盖层 */}
          {avatar.pic_url && avatar.pic_url.length > 0 && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/10 opacity-0 transition-opacity group-hover:opacity-100">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white/90 shadow-lg">
                <svg
                  className="h-5 w-5 text-gray-700"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                  />
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                  />
                </svg>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Original video thumbnail logic for non-hedra types
  return (
    <div
      className="group relative flex aspect-[4/3] cursor-pointer items-center justify-center overflow-hidden rounded-lg border border-solid border-gray-200 transition-all hover:border-primary hover:shadow-md"
      onClick={onClick}
    >
      <div className="relative h-full w-full overflow-hidden">
        {thumbnail ? (
          <img
            src={thumbnail}
            alt={avatar.name}
            className="h-full w-full bg-black object-contain"
          />
        ) : loading && firstVideoUrl ? (
          <div className="flex h-full w-full items-center justify-center bg-gray-100">
            <div className="text-gray-400">
              <div className="mx-auto mb-2 h-6 w-6 animate-spin rounded-full border-b-2 border-solid border-gray-400"></div>
              <div className="text-sm">{t("create.generatingThumbnail")}</div>
            </div>
          </div>
        ) : fallbackImage ? (
          <img
            src={fallbackImage}
            alt={avatar.name}
            className="h-full w-full bg-gray-100 object-contain"
            onError={(e) => {
              e.currentTarget.src = "/placeholder-avatar.png";
            }}
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-gray-100">
            <div className="text-center text-gray-400">
              <User className="mx-auto mb-2 h-8 w-8" />
              <div className="text-sm">暂无素材</div>
            </div>
          </div>
        )}

        {/* 查看素材按钮覆盖层 */}
        {avatar.videoUrl && avatar.videoUrl.length > 0 && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/10 opacity-0 transition-opacity group-hover:opacity-100">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white/90 shadow-lg">
              <svg
                className="h-5 w-5 text-gray-700"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                />
              </svg>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

interface AvatarSelectModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAvatarSelected?: (avatar: {
    imageUrl: string;
    voice: string;
    video: string;
    platform?: string;
    googleModel?: string;
  }) => void;
}

export const AvatarSelectModal: React.FC<AvatarSelectModalProps> = ({
  open,
  onOpenChange,
  onAvatarSelected,
}) => {
  const [selectedAvatar, setSelectedAvatar] = useState<
    (typeof avatars)[0] | null
  >(null);
  const [videoDialogOpen, setVideoDialogOpen] = useState(false);
  const [currentVideo, setCurrentVideo] = useState<string | null>(null);
  const [imageDialogOpen, setImageDialogOpen] = useState(false);
  const [currentImage, setCurrentImage] = useState<string | null>(null);
  const { avatarData } = useAvatarDb();
  const [createConfig] = useAtom(createConfigAtom);
  const [currentView, setCurrentView] = useState<"list" | "videos" | "images">(
    "list"
  );
  const [selectedAvatarForVideos, setSelectedAvatarForVideos] =
    useState<Avatar | null>(null);
  const [selectedAvatarForImages, setSelectedAvatarForImages] =
    useState<Avatar | null>(null);
  const t = useTranslations();

  const handleVideoClick = (videoUrl: string) => {
    setCurrentVideo(videoUrl);
    setVideoDialogOpen(true);
  };

  const handleImageClick = (imageUrl: string) => {
    setCurrentImage(imageUrl);
    setImageDialogOpen(true);
  };

  const handleAvatarClick = (avatar: Avatar) => {
    if (
      createConfig.createType === "hedra" ||
      createConfig.createType === "Omnihuman" ||
      createConfig.createType === "stable"
    ) {
      // For hedra, Omnihuman and stable types, show images view
      setSelectedAvatarForImages(avatar);
      setCurrentView("images");
    } else {
      // For other types, show videos view
      setSelectedAvatarForVideos(avatar);
      setCurrentView("videos");
    }
  };

  const handleBackToList = () => {
    setCurrentView("list");
    setSelectedAvatarForVideos(null);
    setSelectedAvatarForImages(null);
  };

  const handleVideoSelected = (videoUrl: string) => {
    if (selectedAvatarForVideos) {
      // 对于自定义数字人，需要构建完整的voice字符串
      let voiceString = selectedAvatarForVideos.voice;

      // 如果voice不包含平台前缀，并且有platform信息，则构建完整格式
      if (selectedAvatarForVideos.platform && !voiceString.includes("-")) {
        const platformMap: { [key: string]: string } = {
          Minimaxi: "minimaxi",
          Doubao: "doubao",
          fish: "fish",
          OpenAI: "openai",
        };
        const platformPrefix = platformMap[selectedAvatarForVideos.platform];
        if (platformPrefix) {
          voiceString = `${platformPrefix}-${voiceString}`;
        }
      }

      onAvatarSelected?.({
        imageUrl: selectedAvatarForVideos.pic_url[0] || "",
        voice: voiceString,
        video: videoUrl,
        platform: selectedAvatarForVideos.platform,
        googleModel: selectedAvatarForVideos.googleModel,
      });
      onOpenChange(false);
    }
  };

  const handleImageSelected = (imageUrl: string) => {
    if (selectedAvatarForImages) {
      // 对于自定义数字人，需要构建完整的voice字符串
      let voiceString = selectedAvatarForImages.voice;

      // 如果voice不包含平台前缀，并且有platform信息，则构建完整格式
      if (selectedAvatarForImages.platform && !voiceString.includes("-")) {
        const platformMap: { [key: string]: string } = {
          Minimaxi: "minimaxi",
          Doubao: "doubao",
          fish: "fish",
          OpenAI: "openai",
        };
        const platformPrefix = platformMap[selectedAvatarForImages.platform];
        if (platformPrefix) {
          voiceString = `${platformPrefix}-${voiceString}`;
        }
      }

      onAvatarSelected?.({
        imageUrl: imageUrl,
        voice: voiceString,
        video: "", // No video for hedra type
        platform: selectedAvatarForImages.platform,
        googleModel: selectedAvatarForImages.googleModel,
      });
      onOpenChange(false);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="p-0 sm:max-w-[580px]">
          {currentView === "videos" && selectedAvatarForVideos ? (
            <AvatarVideosView
              avatar={selectedAvatarForVideos}
              onBack={handleBackToList}
              onVideoSelected={handleVideoSelected}
            />
          ) : currentView === "images" && selectedAvatarForImages ? (
            <AvatarImagesView
              avatar={selectedAvatarForImages}
              onBack={handleBackToList}
              onImageSelected={handleImageSelected}
            />
          ) : (
            <div className="flex w-full flex-col">
              <Tabs defaultValue="my-avatar">
                <TabsList className="flex h-12 justify-start border-b">
                  <TabsTrigger value="my-avatar" className="w-32">
                    {t("create.myAvatar")}
                  </TabsTrigger>
                  <TabsTrigger value="preset-avatar" className="w-32">
                    {t("create.presetAvatar")}
                  </TabsTrigger>
                </TabsList>

                <TabsContent
                  value="my-avatar"
                  className="mt-0 max-h-[450px] overflow-y-auto p-6"
                >
                  {avatarData && avatarData.length > 0 ? (
                    <div className="grid grid-cols-2 gap-4">
                      {avatarData.map((avatar) => (
                        <div key={avatar.id} className="w-full">
                          <div
                            className="group relative flex aspect-[4/3] cursor-pointer items-center justify-center overflow-hidden rounded-lg border border-solid border-gray-200 transition-all hover:border-primary hover:shadow-md"
                            onClick={() => handleAvatarClick(avatar)}
                          >
                            <div className="relative h-full w-full overflow-hidden">
                              <AvatarThumbnail
                                avatar={avatar}
                                onClick={() => {}}
                                createType={createConfig.createType}
                              />
                              {/* 查看素材按钮覆盖层 */}
                              {(((createConfig.createType === "hedra" ||
                                createConfig.createType === "Omnihuman" ||
                                createConfig.createType === "stable") &&
                                avatar.pic_url &&
                                avatar.pic_url.length > 0) ||
                                (createConfig.createType !== "hedra" &&
                                  createConfig.createType !== "Omnihuman" &&
                                  createConfig.createType !== "stable" &&
                                  avatar.videoUrl &&
                                  avatar.videoUrl.length > 0)) && (
                                <div className="absolute inset-0 flex items-center justify-center bg-black/10 opacity-0 transition-opacity group-hover:opacity-100">
                                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white/90 shadow-lg">
                                    <svg
                                      className="h-5 w-5 text-gray-700"
                                      fill="none"
                                      stroke="currentColor"
                                      viewBox="0 0 24 24"
                                    >
                                      <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth={2}
                                        d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                                      />
                                      <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth={2}
                                        d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                                      />
                                    </svg>
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>

                          <div className="mt-3 flex items-center justify-between">
                            <div className="text-sm font-medium text-gray-900">
                              {avatar.name}
                            </div>
                            {/* <Button
                              size="sm"
                              className={`h-7 px-3 text-xs font-medium ${
                                selectedAvatar?.id === avatar.id
                                  ? "bg-primary text-primary-foreground"
                                  : "bg-gray-50 text-gray-700 hover:bg-gray-100"
                              }`}
                              variant={
                                selectedAvatar?.id === avatar.id
                                  ? "default"
                                  : "ghost"
                              }
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedAvatar({
                                  id: avatar.id,
                                  name: avatar.name,
                                  imageUrl: avatar.pic_url[0] || "",
                                  voice: avatar.voice,
                                  video: avatar.videoUrl[0] || "",
                                } as any);
                              }}
                            >
                          
                            </Button> */}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="flex min-h-[200px] items-center justify-center text-gray-500">
                      <div className="text-center">
                        <User className="mx-auto mb-4 h-12 w-12 text-gray-300" />
                        <p>暂无自定义数字人</p>
                      </div>
                    </div>
                  )}
                </TabsContent>

                <TabsContent
                  value="preset-avatar"
                  className="mt-0 max-h-[450px] overflow-y-auto p-6"
                >
                  <div className="grid grid-cols-2 gap-4">
                    {avatars.map((avatar) => (
                      <div key={avatar.id} className="w-full">
                        <div
                          className="group relative flex aspect-[4/3] cursor-pointer items-center justify-center overflow-hidden rounded-lg border border-solid border-gray-200 transition-all hover:border-primary hover:shadow-md"
                          onClick={() => {
                            if (
                              createConfig.createType === "hedra" ||
                              createConfig.createType === "Omnihuman" ||
                              createConfig.createType === "stable"
                            ) {
                              // For hedra, Omnihuman and stable, show image preview
                              handleImageClick(avatar.imageUrl);
                            } else {
                              // For chanjing, show video player
                              handleVideoClick(avatar.video);
                            }
                          }}
                        >
                          <div className="relative h-full w-full overflow-hidden">
                            {/* 头像图片 */}
                            <img
                              src={avatar.imageUrl}
                              alt={avatar.name}
                              className="h-full w-full object-contain"
                              loading="lazy"
                            />
                            {/* 按钮覆盖层 */}
                            <div className="absolute inset-0 flex items-center justify-center bg-black/10 opacity-0 transition-opacity group-hover:opacity-100">
                              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white/90 shadow-lg">
                                {createConfig.createType === "hedra" ||
                                createConfig.createType === "Omnihuman" ||
                                createConfig.createType === "stable" ? (
                                  // 查看图标 for hedra, Omnihuman and stable
                                  <svg
                                    className="h-5 w-5 text-gray-700"
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                  >
                                    <path
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      strokeWidth={2}
                                      d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                                    />
                                    <path
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      strokeWidth={2}
                                      d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                                    />
                                  </svg>
                                ) : (
                                  // 播放图标 for chanjing
                                  <svg
                                    className="ml-1 h-5 w-5 text-gray-700"
                                    fill="currentColor"
                                    viewBox="0 0 24 24"
                                  >
                                    <path d="M8 5v14l11-7z" />
                                  </svg>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>

                        <div className="mt-3 flex items-center justify-between">
                          <div className="text-sm font-medium text-gray-900">
                            {t(`presetAvatar.${avatar.name}`)}
                          </div>
                          <Button
                            size="sm"
                            className={`h-7 px-3 text-xs font-medium ${
                              selectedAvatar?.id === avatar.id
                                ? "bg-primary text-primary-foreground"
                                : "bg-gray-50 text-gray-700 hover:bg-gray-100"
                            }`}
                            variant={
                              selectedAvatar?.id === avatar.id
                                ? "default"
                                : "ghost"
                            }
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedAvatar(avatar);
                            }}
                          >
                            {selectedAvatar?.id === avatar.id
                              ? t("create.selected")
                              : t("create.select")}
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </TabsContent>
              </Tabs>

              {/* 底部按钮区域 */}
              <div className="flex justify-end gap-3 border-t bg-gray-50/50 px-6 py-4">
                <DialogClose asChild>
                  <Button variant="outline" className="px-6">
                    {t("create.cancel")}
                  </Button>
                </DialogClose>
                <Button
                  className="px-6"
                  onClick={() => {
                    if (selectedAvatar) {
                      onAvatarSelected?.({
                        imageUrl: selectedAvatar.imageUrl,
                        voice: selectedAvatar.voice,
                        video:
                          createConfig.createType === "hedra" ||
                          createConfig.createType === "Omnihuman" ||
                          createConfig.createType === "stable"
                            ? ""
                            : selectedAvatar.video, // hedra、Omnihuman和stable不需要video
                        platform: undefined, // 预设数字人没有platform信息
                        googleModel: undefined, // 预设数字人没有googleModel信息
                      });
                    }
                    onOpenChange(false);
                  }}
                  disabled={!selectedAvatar}
                >
                  {t("create.confirm")}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Video Player Modal */}
      <VideoPlayerModal
        open={videoDialogOpen}
        onOpenChange={setVideoDialogOpen}
        videoUrl={currentVideo}
      />

      {/* Image Preview Modal */}
      <Dialog open={imageDialogOpen} onOpenChange={setImageDialogOpen}>
        <DialogContent className="sm:max-w-[700px]">
          <div className="flex flex-col items-center">
            <div className="w-full overflow-hidden rounded">
              {currentImage && (
                <img
                  src={currentImage}
                  alt="预设数字人预览"
                  className="h-auto max-h-[70vh] w-full object-contain"
                />
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default AvatarSelectModal;
