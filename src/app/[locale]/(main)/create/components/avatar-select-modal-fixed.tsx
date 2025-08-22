"use client";

import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogClose } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { avatars } from "@/constants/avatars";
import { VideoPlayerModal } from "./VideoPlayerModal";
import { useAvatarDb } from "@/hooks/db/use-avatar-db";
import { User } from "lucide-react";
import { useAtom } from "jotai";
import { createConfigAtom } from "@/stores/slices/create_config";
import { AvatarVideosView } from "./AvatarVideosView";
import { Avatar } from "@/db/types";
import { useTranslations } from "next-intl";

// 生成视频缩略图的hook
const useVideoThumbnail = (videoUrl: string) => {
  const [thumbnail, setThumbnail] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(true);

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
        video.currentTime = Math.min(1, video.duration / 2);
      };

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

          const thumbnailData = canvas.toDataURL("image/jpeg", 0.9);
          setThumbnail(thumbnailData);
          setLoading(false);

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

// 数字人缩略图组件
const AvatarThumbnail: React.FC<{ avatar: Avatar; onClick: () => void }> = ({
  avatar,
  onClick,
}) => {
  const firstVideoUrl =
    avatar.videoUrl && avatar.videoUrl.length > 0 ? avatar.videoUrl[0] : "";
  const { thumbnail, loading } = useVideoThumbnail(firstVideoUrl);
  const fallbackImage =
    avatar.pic_url && avatar.pic_url.length > 0 ? avatar.pic_url[0] : "";
  const t = useTranslations();
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
              <div className="mx-auto mb-2 h-6 w-6 animate-spin rounded-full border-b-2 border-gray-400"></div>
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
                  d="M15 12a3 3 0 11-6 0 3 3 0 616 0z"
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
  const { avatarData } = useAvatarDb();
  const [createConfig] = useAtom(createConfigAtom);
  const [currentView, setCurrentView] = useState<"list" | "videos">("list");
  const [selectedAvatarForVideos, setSelectedAvatarForVideos] =
    useState<Avatar | null>(null);
  const t = useTranslations();

  const handleVideoClick = (videoUrl: string) => {
    setCurrentVideo(videoUrl);
    setVideoDialogOpen(true);
  };

  const handleAvatarClick = (avatar: Avatar) => {
    setSelectedAvatarForVideos(avatar);
    setCurrentView("videos");
  };

  const handleBackToList = () => {
    setCurrentView("list");
    setSelectedAvatarForVideos(null);
  };

  const handleVideoSelected = (videoUrl: string) => {
    if (selectedAvatarForVideos) {
      onAvatarSelected?.({
        imageUrl: selectedAvatarForVideos.pic_url[0] || "",
        voice: selectedAvatarForVideos.voice,
        video: videoUrl,
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
          ) : (
            <div className="flex w-full flex-col">
              <Tabs defaultValue="my-avatar" className="w-full">
                <TabsList className="grid h-12 w-full grid-cols-2 rounded-none border-b">
                  <TabsTrigger value="my-avatar" className="rounded-none">
                    {t("create.myAvatar")}
                  </TabsTrigger>
                  <TabsTrigger value="preset-avatar" className="rounded-none">
                    {t("create.presetAvatar")}
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="my-avatar" className="mt-0 p-6">
                  {avatarData && avatarData.length > 0 ? (
                    <div className="grid grid-cols-2 gap-4">
                      {avatarData.map((avatar) => (
                        <div key={avatar.id} className="w-full">
                          <AvatarThumbnail
                            avatar={avatar}
                            onClick={() => handleAvatarClick(avatar)}
                          />

                          <div className="mt-3 flex items-center justify-between">
                            <div className="text-sm font-medium text-gray-900">
                              {avatar.name}
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
                                setSelectedAvatar({
                                  id: avatar.id,
                                  name: avatar.name,
                                  imageUrl: avatar.pic_url[0] || "",
                                  voice: avatar.voice,
                                  video: avatar.videoUrl[0] || "",
                                } as any);
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
                  ) : (
                    <div className="flex min-h-[200px] items-center justify-center text-gray-500">
                      <div className="text-center">
                        <User className="mx-auto mb-4 h-12 w-12 text-gray-300" />
                        <p>{t("create.noCustomAvatar")}</p>
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
                          onClick={() => handleVideoClick(avatar.video)}
                        >
                          <div className="relative h-full w-full overflow-hidden">
                            {/* 背景模糊视频 */}
                            <video
                              src={avatar.video}
                              className="absolute inset-0 h-full w-full scale-150 object-cover blur-sm"
                              muted
                              playsInline
                              preload="metadata"
                              onLoadedData={(e) => {
                                const video = e.target as HTMLVideoElement;
                                video.currentTime = 0.1;
                              }}
                            />
                            {/* 前景清晰视频 */}
                            <video
                              src={avatar.video}
                              className="relative z-10 h-full w-full object-contain"
                              muted
                              playsInline
                              preload="metadata"
                              onLoadedData={(e) => {
                                const video = e.target as HTMLVideoElement;
                                video.currentTime = 0.1;
                              }}
                            />
                            {/* 播放按钮覆盖层 */}
                            <div className="absolute inset-0 flex items-center justify-center bg-black/10 opacity-0 transition-opacity group-hover:opacity-100">
                              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white/90 shadow-lg">
                                <svg
                                  className="ml-1 h-5 w-5 text-gray-700"
                                  fill="currentColor"
                                  viewBox="0 0 24 24"
                                >
                                  <path d="M8 5v14l11-7z" />
                                </svg>
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
                        video: selectedAvatar.video,
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
    </>
  );
};

export default AvatarSelectModal;
