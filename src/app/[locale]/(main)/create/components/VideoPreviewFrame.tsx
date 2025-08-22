"use client";
import React, { memo, useState, useEffect } from "react";
import Image from "next/image";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BackgroundSelectModal } from "./background-select-modal";
import { CreateData } from "@/db/types";
import { Upload } from "lucide-react";
import AvatarSelectModal from "./avatar-select-modal";

import { cn } from "@/lib/utils";
import { useAtom } from "jotai";
import { createVideoStoreAtom } from "@/stores/slices/create_video";
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

// 判断URL是否是视频格式
const isVideoUrl = (url: string): boolean => {
  const videoExtensions = [".mp4", ".mov", ".avi", ".webm", ".mkv"];
  return videoExtensions.some((ext) => url.toLowerCase().includes(ext));
};

// 智能媒体显示组件
const SmartMediaDisplay: React.FC<{
  src: string;
  alt: string;
  onError: () => void;
  className?: string;
  sizes?: string;
}> = ({ src, alt, onError, className, sizes }) => {
  const isVideo = isVideoUrl(src);
  const { thumbnail, loading } = useVideoThumbnail(isVideo ? src : "");
  const t = useTranslations();
  if (isVideo) {
    if (loading) {
      return (
        <div className="flex h-full w-full items-center justify-center bg-gray-100">
          <div className="text-gray-400">
            <div className="mx-auto mb-2 h-6 w-6 animate-spin rounded-full border-b-2 border-gray-400"></div>
            <div className="text-sm">{t("create.generatingThumbnail")}</div>
          </div>
        </div>
      );
    }

    if (thumbnail) {
      return (
        <img
          src={thumbnail}
          alt={alt}
          className={className}
          onError={onError}
        />
      );
    }

    // 视频缩略图生成失败，显示默认占位符
    return (
      <div className="flex h-full w-full items-center justify-center bg-gray-100">
        <div className="text-center text-gray-400">
          <svg
            className="mx-auto mb-2 h-8 w-8"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
            />
          </svg>
          <div className="text-sm">视频预览</div>
        </div>
      </div>
    );
  }

  // 图片显示
  return (
    <Image
      src={src}
      alt={alt}
      fill
      className={className}
      onError={onError}
      sizes={sizes}
    />
  );
};

interface VideoPreviewFrameProps extends Omit<CreateData, "createdAt"> {
  onAvatarSelected?: (
    itemId: string,
    avatar: {
      imageUrl: string;
      voice: string;
      video: string;
      platform?: string;
      googleModel?: string;
    }
  ) => void;
}

const VideoPreviewFrame = memo(
  ({
    avatarImage,
    id,
    backgroundImage,
    onAvatarSelected,
  }: VideoPreviewFrameProps) => {
    const t = useTranslations();

    const [imageError, setImageError] = useState(false);
    const [backgroundSelectModalOpen, setBackgroundSelectModalOpen] =
      useState(false);
    const [avatarSelectModalOpen, setAvatarSelectModalOpen] = useState(false);

    // 处理可能包含多个URL的字符串，只取第一个
    const getFirstImageUrl = (imageUrl: string) => {
      if (!imageUrl) return "";
      // 如果包含逗号，说明是多个URL，取第一个
      return imageUrl.split(",")[0].trim();
    };

    const handleImageError = () => {
      setImageError(true);
    };

    const handleAvatarSelected = async (avatar: {
      imageUrl: string;
      voice: string;
      video: string;
      platform?: string;
      googleModel?: string;
    }) => {
      try {
        // 通过props回调来更新，避免在组件内直接操作store
        onAvatarSelected?.(id, avatar);

        // 关闭模态框
        setAvatarSelectModalOpen(false);
      } catch (error) {
        console.error("Failed to update avatar:", error);
      }
    };

    return (
      <div className="flex max-w-[280px] flex-col items-center gap-y-2">
        <Card className="w-full overflow-hidden">
          <div className="h-[240px]">
            <div className="relative h-full w-full">
              {avatarImage && !imageError ? (
                <div
                  className={cn(
                    "relative h-full w-full",
                    !backgroundImage && "bg-[#29292a]"
                  )}
                >
                  <SmartMediaDisplay
                    src={getFirstImageUrl(avatarImage)}
                    alt="Background changed preview"
                    className="rounded-md object-contain"
                    onError={handleImageError}
                    sizes="(max-width: 768px) 100vw, (max-width: 1200px) 40vw, 33vw"
                  />
                </div>
              ) : (
                <div className="flex h-full w-full flex-col items-center justify-center space-y-2 rounded-md border-2 border-dashed border-border bg-muted">
                  <div className="flex h-16 w-16 items-center justify-center rounded-lg">
                    <svg
                      className="h-8 w-8 text-muted-foreground"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
                      />
                    </svg>
                  </div>
                  <p className="text-center text-sm text-muted-foreground">
                    {/* {placeholder} */}
                  </p>
                </div>
              )}
            </div>
          </div>
        </Card>
        <div className="flex w-full gap-2">
          <Button
            className="flex-1"
            onClick={() => setAvatarSelectModalOpen(true)}
          >
            {t("create.changeAvatar")}
          </Button>
          <Button
            className="flex-1"
            variant="outline"
            onClick={() => setBackgroundSelectModalOpen(true)}
          >
            {t("create.changeBackground")}
          </Button>
        </div>
        <BackgroundSelectModal
          open={backgroundSelectModalOpen}
          onOpenChange={setBackgroundSelectModalOpen}
          avatarImage={avatarImage}
          id={id}
        />

        {/* Avatar Selection Modal */}
        <AvatarSelectModal
          open={avatarSelectModalOpen}
          onOpenChange={setAvatarSelectModalOpen}
          onAvatarSelected={handleAvatarSelected}
        />
      </div>
    );
  },
  (prevProps, nextProps) => {
    // 只比较VideoPreviewFrame实际需要的字段，忽略其他字段的变化
    // 这样可以避免当ConfigurationPanel更新text、audioFile、wavUrl等无关字段时导致的重渲染
    const shouldNotRerender =
      prevProps.avatarImage === nextProps.avatarImage &&
      prevProps.backgroundImage === nextProps.backgroundImage &&
      prevProps.id === nextProps.id &&
      prevProps.videoUrl === nextProps.videoUrl &&
      prevProps.onAvatarSelected === nextProps.onAvatarSelected;

    return shouldNotRerender;
  }
);

VideoPreviewFrame.displayName = "VideoPreviewFrame";

export default VideoPreviewFrame;
