"use client";

import React, { useState, useEffect } from "react";
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
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { fonts, Font } from "@/constants/fonts";
import { CreateData } from "@/db/types";
import { useTranslations } from "next-intl";
import { subtitlePresets } from "@/constants/subtitle-presets";
import { Ban } from "lucide-react";

type SubtitleConfig = NonNullable<CreateData["subtitleConfig"]>;

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
      }, 15000); // 延长超时时间到15秒

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
  if (!url) return false;
  const videoExtensions = [".mp4", ".mov", ".avi", ".webm", ".mkv"];
  return videoExtensions.some((ext) => url.toLowerCase().includes(ext));
};

// 智能媒体显示组件用于字幕预览
const SmartAvatarPreview: React.FC<{
  src: string;
  alt: string;
  className?: string;
}> = ({ src, alt, className }) => {
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
      return <img src={thumbnail} alt={alt} className={className} />;
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
              d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 002 2v8a2 2 0 002 2z"
            />
          </svg>
          <div className="text-sm">视频预览</div>
        </div>
      </div>
    );
  }

  // 图片显示
  return <img src={src} alt={alt} className={className} />;
};

interface SubtitleConfigModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  config: SubtitleConfig;
  onConfigChange: (config: SubtitleConfig) => void;
  avatarImage?: string;
}

const SubtitleConfigModal: React.FC<SubtitleConfigModalProps> = ({
  open,
  onOpenChange,
  config,
  onConfigChange,
  avatarImage,
}) => {
  const [localConfig, setLocalConfig] = useState<SubtitleConfig>(config);
  const [fontLoaded, setFontLoaded] = useState<string>("");
  const t = useTranslations();

  // 当modal打开时，更新本地配置为当前配置
  React.useEffect(() => {
    if (open) {
      setLocalConfig(config);
    }
  }, [open, config]);

  // 动态加载字体
  useEffect(() => {
    const selectedFont = fonts.find((font) => font.id === localConfig.font_id);
    if (selectedFont && selectedFont.ttf_path) {
      const fontFace = new FontFace(
        selectedFont.name,
        `url(${selectedFont.ttf_path})`
      );
      fontFace
        .load()
        .then(() => {
          document.fonts.add(fontFace);
          setFontLoaded(selectedFont.name);
        })
        .catch((error) => {
          console.error("Font loading failed:", error);
          setFontLoaded(""); // 回退到默认字体
        });
    } else {
      setFontLoaded("");
    }
  }, [localConfig.font_id]);

  // 获取选中的字体信息
  const selectedFont = fonts.find((font) => font.id === localConfig.font_id);

  // 过滤重复的字体名称，保留第一个出现的
  const uniqueFonts = fonts.filter(
    (font, index, arr) => arr.findIndex((f) => f.name === font.name) === index
  );

  const handleSave = () => {
    onConfigChange(localConfig);
    onOpenChange(false);
  };

  const handleCancel = () => {
    setLocalConfig(config); // 重置为原始配置
    onOpenChange(false);
  };

  const updateConfig = (updates: Partial<SubtitleConfig>) => {
    setLocalConfig((prev) => ({ ...prev, ...updates }));
  };

  // 生成描边效果的文本阴影
  const getTextShadow = (strokeColor: string, strokeWidth: number) => {
    if (strokeWidth === 0) return "none";

    // 使用实际的描边宽度，但对预览进行适当缩放
    const shadows: any = [];
    const width = Math.max(strokeWidth * 0.3, 1); // 缩放描边宽度以适应预览

    // 创建多层阴影以模拟描边效果
    const directions = [
      [-width, -width],
      [0, -width],
      [width, -width],
      [-width, 0],
      [width, 0],
      [-width, width],
      [0, width],
      [width, width],
    ];

    // 根据描边宽度创建多层效果
    for (let i = 1; i <= Math.ceil(width); i++) {
      directions.forEach(([x, y]) => {
        const scale = i / Math.ceil(width);
        shadows.push(`${x * scale}px ${y * scale}px 0 ${strokeColor}`);
      });
    }

    return shadows.join(", ");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl">
        <DialogHeader>
          <DialogTitle>{t("create.subtitleConfig")}</DialogTitle>
        </DialogHeader>

        <div className="flex gap-6 py-4">
          {/* 左侧预览区域 */}
          {avatarImage && (
            <div className="flex flex-1 flex-col">
              <label className="mb-2 text-sm font-medium leading-none">
                {t("create.preview")}
              </label>
              <div className="relative min-h-[300px] flex-1 overflow-hidden rounded border bg-gray-100">
                <SmartAvatarPreview
                  src={avatarImage}
                  alt="Avatar Preview"
                  className="h-auto max-h-[400px] w-full object-contain"
                />
                <div className="absolute bottom-16 left-1/2 -translate-x-1/2 transform px-4">
                  <span
                    style={{
                      fontSize: `${localConfig.font_size * 0.3}px`,
                      color: localConfig.color,
                      textShadow: getTextShadow(
                        localConfig.stroke_color,
                        localConfig.stroke_width
                      ),
                      fontFamily: fontLoaded || selectedFont?.name || "inherit",
                      WebkitTextFillColor: localConfig.color,
                    }}
                    className="block text-center font-bold"
                  >
                    这是字幕预览文本
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* 右侧配置区域 */}
          <div
            className={`space-y-6 ${avatarImage ? "flex-1" : "w-full"} ${avatarImage ? "mt-8" : ""}`}
          >
            {/* 字体选择和字号 */}
            <div className="flex gap-4">
              <div className="flex-1">
                <Select
                  value={localConfig.font_id}
                  onValueChange={(value) => updateConfig({ font_id: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={t("create.selectFont")}>
                      {selectedFont
                        ? selectedFont.name
                        : t("create.selectFont")}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent className="max-h-[300px]">
                    {uniqueFonts.map((font: Font) => (
                      <SelectItem key={font.id} value={font.id}>
                        {font.preview ? (
                          <img
                            src={font.preview}
                            alt={font.name}
                            className="h-8 w-auto max-w-[250px] object-contain"
                            loading="lazy"
                          />
                        ) : (
                          <span>{font.name}</span>
                        )}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="w-24">
                <Input
                  type="number"
                  min="12"
                  max="100"
                  value={localConfig.font_size}
                  onChange={(e) =>
                    updateConfig({ font_size: parseInt(e.target.value) || 64 })
                  }
                  placeholder={t("create.fontSize")}
                />
              </div>
            </div>

            {/* 字体颜色、描边颜色和描边宽度 */}
            <div className="flex items-center gap-4">
              {/* 字体颜色 */}
              <div className="flex items-center space-x-2">
                <Label
                  htmlFor="font-color"
                  className="whitespace-nowrap text-sm"
                >
                  {t("create.fontColor")}
                </Label>
                <Input
                  id="font-color"
                  type="color"
                  value={localConfig.color}
                  onChange={(e) => updateConfig({ color: e.target.value })}
                  className="h-8 w-12"
                />
                <Input
                  type="text"
                  value={localConfig.color}
                  onChange={(e) => updateConfig({ color: e.target.value })}
                  placeholder="#FFFFFF"
                  className="h-8 w-20 text-xs"
                />
              </div>

              {/* 描边颜色 */}
              <div className="flex items-center space-x-2">
                <Label
                  htmlFor="stroke-color"
                  className="whitespace-nowrap text-sm"
                >
                  {t("create.strokeColor")}
                </Label>
                <Input
                  id="stroke-color"
                  type="color"
                  value={localConfig.stroke_color}
                  onChange={(e) =>
                    updateConfig({ stroke_color: e.target.value })
                  }
                  className="h-8 w-12"
                />
                <Input
                  type="text"
                  value={localConfig.stroke_color}
                  onChange={(e) =>
                    updateConfig({ stroke_color: e.target.value })
                  }
                  placeholder="#000000"
                  className="h-8 w-20 text-xs"
                />
              </div>

              {/* 描边宽度 */}
              <div className="flex items-center space-x-2">
                <Label
                  htmlFor="stroke-width"
                  className="whitespace-nowrap text-sm"
                >
                  {t("create.strokeWidth")}
                </Label>
                <Input
                  id="stroke-width"
                  type="number"
                  min="0"
                  max="10"
                  value={localConfig.stroke_width || 0}
                  onChange={(e) =>
                    updateConfig({
                      stroke_width: parseInt(e.target.value) || 0,
                    })
                  }
                  placeholder="0"
                  className="h-8 w-16"
                />
              </div>
            </div>

            {/* 字幕样式预设 */}
            <div className="space-y-2">
              <Label>{t("create.subtitlePresets")}</Label>
              <div className="max-h-54 overflow-y-auto">
                <div className="grid grid-cols-5 gap-x-1 gap-y-3">
                  {subtitlePresets.map((preset) => (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() =>
                        updateConfig({
                          color: preset.color,
                          stroke_color: preset.stroke_color,
                          stroke_width: preset.stroke_width,
                        })
                      }
                      className="flex h-[54px] w-[54px] items-center justify-center rounded-lg border-2 border-transparent bg-gray-100 text-center transition-all hover:border-blue-400"
                      title={preset.name || `样式 ${preset.id}`}
                    >
                      {preset.name === "默认" ? (
                        <Ban className="h-4 w-4 text-gray-400" />
                      ) : (
                        <div
                          className="text-sm font-bold"
                          style={{
                            color: preset.color,
                            textShadow: getTextShadow(
                              preset.stroke_color,
                              preset.stroke_width
                            ),
                            WebkitTextFillColor: preset.color,
                          }}
                        >
                          T
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleCancel}>
            {t("create.cancel")}
          </Button>
          <Button onClick={handleSave}>{t("create.confirm")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default SubtitleConfigModal;
