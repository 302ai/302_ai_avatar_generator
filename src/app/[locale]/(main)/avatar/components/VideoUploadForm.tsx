"use client";

import React, { useRef, useState } from "react";
import { Label } from "@/components/ui/label";
import { Upload, FileVideo, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useAtomValue } from "jotai";
import { appConfigAtom } from "@/stores";
import ky from "ky";
import { useTranslations } from "next-intl";

interface VideoUploadFormProps {
  selectedVideo: File | null;
  onVideoChange: (file: File | null) => void;
  uploadedVideoUrl: string;
  onUploadedVideoUrl: (url: string) => void;
}

export const VideoUploadForm: React.FC<VideoUploadFormProps> = ({
  selectedVideo,
  onVideoChange,
  uploadedVideoUrl,
  onUploadedVideoUrl,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const appConfig = useAtomValue(appConfigAtom);
  const t = useTranslations();

  const uploadVideo = async (file: File): Promise<string> => {
    try {
      setIsUploading(true);

      if (!appConfig.apiKey) {
        throw new Error("API Key is required");
      }

      const formData = new FormData();
      formData.append("apiKey", appConfig.apiKey);
      formData.append("file", file);

      const response = await ky
        .post("/api/upload-video", {
          body: formData,
          timeout: 120000,
        })
        .json<{ data?: string }>();

      const videoUrl = response.data;
      if (!videoUrl) {
        throw new Error("上传响应中未找到视频URL");
      }

      return videoUrl;
    } catch (error) {
      console.error("视频上传失败:", error);
      throw error;
    } finally {
      setIsUploading(false);
    }
  };

  const handleVideoUpload = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];
    if (file) {
      if (!file.type.startsWith("video/")) {
        toast.error("请选择视频文件");
        return;
      }

      const maxSize = 100 * 1024 * 1024; // 100MB
      if (file.size > maxSize) {
        toast.error("视频文件大小不能超过100MB");
        return;
      }

      onVideoChange(file);

      try {
        const videoUrl = await uploadVideo(file);
        onUploadedVideoUrl(videoUrl);
      } catch (error) {
        toast.error("视频上传失败，请重试", { id: "video-upload" });
        onVideoChange(null);
      }
    }
  };

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className="mr-2 space-y-2">
      <Label>{t("avatar.uploadVideo")}</Label>
      <div
        className={`cursor-pointer rounded-lg border-2 border-dashed p-6 text-center transition-colors hover:border-primary/50 hover:bg-primary/5 ${
          isUploading
            ? "border-blue-300 bg-blue-50"
            : "border-[1px] border-solid border-gray-300 hover:border-gray-400"
        }`}
        onClick={!isUploading ? handleUploadClick : undefined}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="video/*"
          onChange={handleVideoUpload}
          className="hidden"
          disabled={isUploading}
        />
        {isUploading ? (
          <div className="flex flex-col items-center space-y-2">
            <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
            <p className="text-sm text-blue-600">
              {t("avatar.uploadingVideo")}
            </p>
          </div>
        ) : selectedVideo ? (
          <div className="flex items-center justify-center space-x-2">
            <FileVideo className="h-6 w-6 text-green-600" />
            <span className="text-sm text-gray-700">{selectedVideo.name}</span>
          </div>
        ) : (
          <div className="flex flex-col items-center space-y-2">
            <Upload className="h-8 w-8 text-gray-400" />
            <p className="text-sm text-gray-500">{t("avatar.dragAndDrop")}</p>
            <p className="text-xs text-gray-400">
              {t("avatar.supportedFormats")}： .mp4/.mov
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
