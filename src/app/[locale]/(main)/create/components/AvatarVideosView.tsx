"use client";

import React, { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Play } from "lucide-react";
import { Avatar } from "@/db/types";
import { VideoPlayerModal } from "./VideoPlayerModal";
import { useAvatarDb } from "@/hooks/db/use-avatar-db";
import { toast } from "sonner";
import { useTranslations } from "next-intl";

interface AvatarVideosViewProps {
  avatar: Avatar;
  onBack: () => void;
  onVideoSelected: (videoUrl: string) => void;
}

// 生成视频缩略图的hook
const useVideoThumbnail = (videoUrl: string) => {
  const [thumbnail, setThumbnail] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<boolean>(false);

  useEffect(() => {
    if (!videoUrl) {
      setLoading(false);
      setError(true);
      return;
    }

    setLoading(true);
    setError(false);
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
            setError(true);
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
            // 如果canvas被污染，直接使用视频URL作为占位符
            setThumbnail("");
            setError(true);
            setLoading(false);
          }

          // 清理
          video.removeEventListener("loadedmetadata", handleLoadedMetadata);
          video.removeEventListener("seeked", handleSeeked);
          video.removeEventListener("error", handleError);
        } catch (err) {
          console.error("Error generating thumbnail:", err);
          setError(true);
          setLoading(false);
        }
      };

      const handleError = (e: any) => {
        console.error("Video loading error:", e);
        setError(true);
        setLoading(false);

        // 清理
        video.removeEventListener("loadedmetadata", handleLoadedMetadata);
        video.removeEventListener("seeked", handleSeeked);
        video.removeEventListener("error", handleError);
      };

      video.addEventListener("loadedmetadata", handleLoadedMetadata);
      video.addEventListener("seeked", handleSeeked);
      video.addEventListener("error", handleError);

      // 设置超时
      const timeout = setTimeout(() => {
        setError(true);
        setLoading(false);
        video.removeEventListener("loadedmetadata", handleLoadedMetadata);
        video.removeEventListener("seeked", handleSeeked);
        video.removeEventListener("error", handleError);
      }, 15000); // 15秒超时

      // 清理函数
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

  return { thumbnail, loading, error };
};

const VideoThumbnailItem: React.FC<{
  videoUrl: string;
  onPlay: () => void;
  onSelect: () => void;
  isSelected: boolean;
}> = ({ videoUrl, onPlay, onSelect, isSelected }) => {
  const { thumbnail, loading, error } = useVideoThumbnail(videoUrl);
  const t = useTranslations();
  return (
    <div className="relative">
      <div
        className="group relative flex aspect-[4/3] cursor-pointer items-center justify-center overflow-hidden rounded-lg border border-solid border-gray-200 transition-all hover:border-primary hover:shadow-md"
        onClick={onPlay}
      >
        <div className="relative h-full w-full overflow-hidden">
          {thumbnail ? (
            <img
              src={thumbnail}
              alt="视频缩略图"
              className="h-full w-full bg-black object-contain"
            />
          ) : loading ? (
            <div className="flex h-full w-full items-center justify-center bg-gray-100">
              <div className="text-gray-400">
                <div className="mx-auto mb-2 h-6 w-6 animate-spin rounded-full border-b-2 border-gray-400"></div>
                <div className="text-sm">{t("create.generatingThumbnail")}</div>
              </div>
            </div>
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-gray-100">
              <div className="text-center text-gray-400">
                <Play className="mx-auto mb-2 h-8 w-8" />
                <div className="text-sm">视频素材</div>
                <div className="mt-1 text-xs">点击播放</div>
              </div>
            </div>
          )}

          {/* 播放按钮覆盖层 */}
          <div className="absolute inset-0 flex items-center justify-center bg-black/10 opacity-0 transition-opacity group-hover:opacity-100">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white/90 shadow-lg">
              <Play className="ml-1 h-5 w-5 text-gray-700" />
            </div>
          </div>
        </div>
      </div>

      {/* 选择按钮 */}
      <div className="mt-3 flex justify-center">
        <Button
          size="sm"
          className={`h-7 px-4 text-xs font-medium ${
            isSelected
              ? "bg-primary text-primary-foreground"
              : "bg-gray-50 text-gray-700 hover:bg-gray-100"
          }`}
          variant={isSelected ? "default" : "ghost"}
          onClick={(e) => {
            e.stopPropagation();
            onSelect();
          }}
        >
          {isSelected ? t("create.selected") : t("create.select")}
        </Button>
      </div>
    </div>
  );
};

export const AvatarVideosView: React.FC<AvatarVideosViewProps> = ({
  avatar,
  onBack,
  onVideoSelected,
}) => {
  const [selectedVideoUrl, setSelectedVideoUrl] = useState<string | null>(null);
  const [videoDialogOpen, setVideoDialogOpen] = useState(false);
  const [currentVideo, setCurrentVideo] = useState<string | null>(null);
  const { updateAvatarData } = useAvatarDb();
  const t = useTranslations();
  const handleVideoPlay = (videoUrl: string) => {
    setCurrentVideo(videoUrl);
    setVideoDialogOpen(true);
  };

  const handleVideoSelect = (videoUrl: string) => {
    setSelectedVideoUrl(videoUrl);
  };

  return (
    <>
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
            <h3 className="text-lg font-semibold">{avatar.name}</h3>
            <p className="text-sm text-gray-500">
              {t("avatar.totalVideoMaterials", {
                count: avatar.videoUrl?.length || 0,
              })}
            </p>
          </div>
        </div>

        {/* 视频素材网格 */}
        <div className="flex-1 overflow-y-auto p-6">
          {avatar.videoUrl && avatar.videoUrl.length > 0 ? (
            <div className="grid grid-cols-2 gap-4">
              {avatar.videoUrl.map((videoUrl, index) => (
                <VideoThumbnailItem
                  key={index}
                  videoUrl={videoUrl}
                  onPlay={() => handleVideoPlay(videoUrl)}
                  onSelect={() => handleVideoSelect(videoUrl)}
                  isSelected={selectedVideoUrl === videoUrl}
                />
              ))}
            </div>
          ) : (
            <div className="flex min-h-[200px] items-center justify-center text-gray-500">
              <div className="text-center">
                <p>{t("create.noVideoMaterials")}</p>
              </div>
            </div>
          )}
        </div>

        {/* 底部操作区 */}
        <div className="border-t bg-gray-50/50 px-6 py-4">
          <div className="flex justify-end">
            <Button
              className="px-6"
              disabled={!selectedVideoUrl}
              onClick={async () => {
                if (selectedVideoUrl) {
                  try {
                    // 检查视频URL是否已存在
                    if (avatar.videoUrl.includes(selectedVideoUrl)) {
                      onVideoSelected(selectedVideoUrl);
                      return;
                    }

                    // 将新视频URL添加到avatar的videoUrl数组中
                    const updatedVideoUrls = [
                      ...avatar.videoUrl,
                      selectedVideoUrl,
                    ];

                    // 更新IndexDB中的avatar数据
                    await updateAvatarData({
                      ...avatar,
                      videoUrl: updatedVideoUrls,
                    });

                    // toast.success("视频已添加到素材库");
                    onVideoSelected(selectedVideoUrl);
                  } catch (error) {
                    console.error("Failed to update avatar video URLs:", error);
                    toast.error("添加视频失败，请重试");
                  }
                }
              }}
            >
              确定选择
            </Button>
          </div>
        </div>
      </div>

      {/* Video Player Modal */}
      <VideoPlayerModal
        open={videoDialogOpen}
        onOpenChange={setVideoDialogOpen}
        videoUrl={currentVideo}
      />
    </>
  );
};
