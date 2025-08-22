import React from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { avatars } from "@/constants/avatars";
import { useBackgroundChange } from "@/hooks/use-background-change";
import { useAvatarDb } from "@/hooks/db/use-avatar-db";
import { db } from "@/db";
import { useState, useRef, ChangeEvent, useEffect } from "react";
import Image from "next/image";
import { appConfigAtom, store } from "@/stores";
import { useAtom } from "jotai";
import { createVideoStoreAtom } from "@/stores/slices/create_video";
import { Plus, Trash2, ArrowLeft } from "lucide-react";
import { createImage2Video } from "@/services/gen-image-2-video";
import { createConfigAtom } from "@/stores/slices/create_config";
// 移除AI生成背景模态框，不再需要
import { useTranslations } from "next-intl";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { generateImage } from "@/services/gen-image";
import { createImageToImage } from "@/services/gen-image-to-image";
import { createImageToVideo } from "@/services/gen-image-to-video";

interface BackgroundSelectModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  avatarImage: string | undefined;
  id: string;
}

// 图片生成模型选项
const MODEL_OPTIONS = [
  { value: "doubao-seededit-3-0-i2i-250628", label: "seededit3.0" },
  { value: "302ai-flux-kontext-max-i2i", label: "flux kontext max" },
  { value: "302ai-flux-kontext-max-t2i", label: "flux kontext pro" },
];

// 视频生成模型选项
const VIDEO_MODEL_OPTIONS = [
  { value: "kling_21_i2v_hq", label: "kling2.1" },
  { value: "minimaxi_hailuo_02_i2v", label: "minimax02" },
  { value: "midjourney_i2v", label: "midjourney" },
];

// 定义 generatedResult 的类型
type GeneratedResult =
  | string
  | {
      imageUrl: string;
      videoUrl: string;
      type: string;
    }
  | null;

export async function convertWebpToJpeg(imageUrl: string) {
  try {
    // 创建图片元素
    const img = new window.Image();
    img.crossOrigin = "anonymous";

    // 等待图片加载完成
    await new Promise((resolve, reject) => {
      img.onload = resolve;
      img.onerror = reject;
      img.src = imageUrl;
    });

    // 创建canvas并绘制图片
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");

    if (!ctx) {
      throw new Error("Failed to get canvas context");
    }

    canvas.width = img.width;
    canvas.height = img.height;

    // 设置白色背景（JPG不支持透明度）
    ctx.fillStyle = "#FFFFFF";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // 绘制图片
    ctx.drawImage(img, 0, 0);

    // 转换为JPEG Blob
    return new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, "image/jpeg", 0.95);
    });
  } catch (error) {
    console.error("图片转换失败:", error);
    throw new Error("Failed to convert WebP to JPEG");
  }
}

const BackgroundSelectModalComponent = ({
  open,
  onOpenChange,
  avatarImage,
  id,
}: BackgroundSelectModalProps) => {
  const [backgroundFile, setBackgroundFile] = useState<File | null>(null);
  const [backgroundPreview, setBackgroundPreview] = useState<string | null>(
    null
  );
  const [prompt, setPrompt] = useState("");
  const [aspectRatio, setAspectRatio] = useState<"16:9" | "9:16">("16:9");
  const [isUploading, setIsUploading] = useState(false);
  const [currentView, setCurrentView] = useState<"select" | "result">("select");
  const [generatedResult, setGeneratedResult] = useState<GeneratedResult>(null);
  // 新增：图片提示词和模型选择
  const [imagePrompt, setImagePrompt] = useState("");
  const [selectedModel, setSelectedModel] = useState<string>(
    "doubao-seededit-3-0-i2i-250628"
  );
  // 新增：生成结果预览状态
  const [generatedImagePreview, setGeneratedImagePreview] = useState<
    string | null
  >(null);

  // 新增：禅镜和topview的多步骤状态
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3>(1);
  const [videoPrompt, setVideoPrompt] = useState("");
  const [selectedVideoModel, setSelectedVideoModel] = useState<string>("");
  const [videoDuration, setVideoDuration] = useState<string>("3");
  const [generatedVideoPreview, setGeneratedVideoPreview] = useState<
    string | null
  >(null);
  const [step1Data, setStep1Data] = useState<{
    imagePrompt: string;
    selectedModel: string;
    generatedImage: string | null;
  } | null>(null);

  const { apiKey } = store.get(appConfigAtom);

  // 当modal打开时重置状态
  useEffect(() => {
    if (open) {
      setBackgroundPreview(null);
      setBackgroundFile(null);
      setImagePrompt("");
      setSelectedModel("doubao-seededit-3-0-i2i-250628");
      setCurrentView("select");
      setGeneratedResult(null);
      setGeneratedImagePreview(null);
      setIsGenerating(false);
      // 重置多步骤状态
      setCurrentStep(1);
      setVideoPrompt("");
      setSelectedVideoModel("");
      setVideoDuration("");
      setGeneratedVideoPreview(null);
      setStep1Data(null);
    }
  }, [open]);
  // 根据不同模型的视频时长选项映射

  const t = useTranslations();

  const MODEL_DURATION_MAP = {
    kling_21_i2v_hq: [
      { value: "5", label: `5 ${t("create.sec")}` },
      { value: "10", label: `10 ${t("create.sec")}` },
    ],
    minimaxi_hailuo_02_i2v: [
      { value: "6", label: `6 ${t("create.sec")}` },
      { value: "10", label: `10 ${t("create.sec")}` },
    ],
    midjourney_i2v: [{ value: "5", label: `5 ${t("create.sec")}` }],
  };

  // 当视频模型改变时，自动设置该模型的第一个可用时长选项
  useEffect(() => {
    if (
      selectedVideoModel &&
      MODEL_DURATION_MAP[selectedVideoModel as keyof typeof MODEL_DURATION_MAP]
    ) {
      const availableDurations =
        MODEL_DURATION_MAP[
          selectedVideoModel as keyof typeof MODEL_DURATION_MAP
        ];
      if (availableDurations.length > 0) {
        setVideoDuration(availableDurations[0].value);
      }
    }
  }, [selectedVideoModel]);
  const [isGenerating, setIsGenerating] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const uploadInputRef = useRef<HTMLInputElement>(null);
  const [createConfig] = useAtom(createConfigAtom);
  const [createVideoStore, setCreateVideoStore] = useAtom(createVideoStoreAtom);
  const { updateAvatarDataItemVideoUrl } = useAvatarDb();
  const { changeBackgroundWithImage, isLoadingImage, error } =
    useBackgroundChange({
      onError: (error) => {
        console.error("Background change failed:", error);
      },
    });

  // 移除handlePresetClick，不再需要预设背景功能

  // 新的生成函数，根据createType决定使用哪种生成方式
  const handleGenerate = async () => {
    if (!avatarImage) {
      console.error("Missing required parameters: avatarImage or imagePrompt");
      return;
    }

    setIsGenerating(true);

    try {
      if (
        createConfig.createType === "hedra" ||
        createConfig.createType === "Omnihuman" ||
        createConfig.createType === "chanjing" ||
        createConfig.createType === "TopView" ||
        createConfig.createType === "stable" ||
        createConfig.createType === "latentsync"
      ) {
        // 对于Hedra、Omnihuman、禅镜和topview，使用AI生成背景图片
        console.log(prompt, selectedModel, avatarImage);

        const res = await createImageToImage({
          prompt: imagePrompt === "" ? "将背景修改为户外" : imagePrompt,
          model: selectedModel,
          apiKey: apiKey!,
          image: avatarImage,
        });

        console.log(res);

        if (res?.image_urls && res.image_urls.length > 0 && res.image_urls[0]) {
          const imageUrl = res.image_urls[0];
          console.log(
            `${createConfig.createType} image generation completed:`,
            imageUrl
          );

          // 生成成功后设置预览图片
          setGeneratedImagePreview(imageUrl);
          setGeneratedResult(imageUrl);

          // 对于禅镜、topview和latentsync，自动进入下一步
          if (
            createConfig.createType === "chanjing" ||
            createConfig.createType === "TopView" ||
            createConfig.createType === "latentsync"
          ) {
            // 保存第一步数据
            setStep1Data({
              imagePrompt,
              selectedModel,
              generatedImage: imageUrl,
            });
            // 自动进入第二步
            setCurrentStep(2);
            setSelectedVideoModel(VIDEO_MODEL_OPTIONS[0].value); // 设置默认视频模型
            // setTimeout(() => {
            // }, 500); // 稍微延迟一下，让用户看到生成结果
          }
        } else {
          throw new Error("生成结果中没有找到有效的图片URL");
        }
      } else {
        // 对于其他类型，切换到生成结果视图
        setCurrentView("result");
        setGeneratedResult(null);
        // 对于其他类型（如chanjing），保持原有逻辑
        console.log(
          "Using legacy background change logic for:",
          createConfig.createType
        );

        if (!backgroundFile) {
          console.error("Background file is required for legacy logic");
          setCurrentView("select");
          return;
        }

        const res = await changeBackgroundWithImage({
          imageUrl: avatarImage,
          backgroundFile: backgroundFile,
          apiKey: apiKey,
          aspect_ratio: aspectRatio,
        });

        if (res && res.newImageUrl) {
          if (createConfig.createType === ("chanjing" as any)) {
            const newImageBlob = await convertWebpToJpeg(res.newImageUrl);
            if (newImageBlob) {
              const imageFile = new File(
                [newImageBlob],
                "converted_image.jpg",
                {
                  type: "image/jpeg",
                }
              );

              const result = await createImage2Video({
                apiKey: apiKey!,
                prompt: prompt.trim() || "人物正在侃侃而谈",
                input_image: imageFile,
                aspect_ratio: aspectRatio,
              });

              let videoUrl: string | undefined;
              if (result.video_url) {
                videoUrl = result.video_url;
              } else if (result.data?.video?.url) {
                videoUrl = result.data.video.url;
              } else if (result.video?.url) {
                videoUrl = result.video.url;
              } else if (result.url) {
                videoUrl = result.url;
              }

              if (videoUrl) {
                setGeneratedResult({
                  imageUrl: res.newImageUrl,
                  videoUrl: videoUrl,
                  type: "chanjing",
                });
              } else {
                setGeneratedResult(res.newImageUrl);
              }
            } else {
              setGeneratedResult(res.newImageUrl);
            }
          } else {
            setGeneratedResult(res.newImageUrl);
          }
        } else {
          throw new Error("背景更换失败");
        }
      }
    } catch (error) {
      console.error("Generation failed:", error);
      // 只有传统类型才切换回选择视图
      if (
        createConfig.createType !== "hedra" &&
        createConfig.createType !== "Omnihuman" &&
        createConfig.createType !== "chanjing" &&
        createConfig.createType !== "TopView" &&
        createConfig.createType !== "latentsync"
      ) {
        setCurrentView("select");
      }
    } finally {
      setIsGenerating(false);
    }
  };

  const handleBackToSelect = () => {
    setCurrentView("select");
    setGeneratedResult(null);
  };

  // 处理视频生成
  const handleVideoGenerate = async () => {
    if (!step1Data?.generatedImage || !selectedVideoModel) {
      console.error("Missing required parameters for video generation");
      return;
    }

    setIsGenerating(true);

    try {
      // TODO: 这里需要实现真实的视频生成API调用
      // 暂时模拟生成过程
      // await new Promise((resolve) => setTimeout(resolve, 3000));

      const res = await createImageToVideo({
        apiKey: apiKey!,
        prompt: videoPrompt === "" ? "人物正在侃侃而谈，镜头固定" : videoPrompt,
        image: step1Data.generatedImage, // 使用第一步生成的背景替换后的图片
        model: selectedVideoModel, // 使用选择的视频模型而不是图片模型
        duration: videoDuration, // 传递选择的时长
      });
      console.log(res, "resres");
      const videoUrl = res.url;
      setGeneratedVideoPreview(videoUrl);

      // 同时设置完整的generatedResult，确保handleConfirmResult能正确处理
      if (step1Data?.generatedImage) {
        setGeneratedResult({
          imageUrl: step1Data.generatedImage,
          videoUrl: videoUrl,
          type: createConfig.createType! || "",
        });
      }

      // 视频生成成功后自动跳转到第三步
      setCurrentStep(3);

      console.log("Video generation completed:", {
        imageUrl: step1Data.generatedImage,
        videoPrompt,
        selectedVideoModel,
        videoDuration,
        // mockVideoUrl,
      });
    } catch (error) {
      console.error("Video generation failed:", error);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleConfirmResult = async (resultParam?: string) => {
    // 对于禅镜、topview和latentsync的第三步，需要构造包含图片和视频的结果对象
    let resultToUse;
    if (
      (createConfig.createType === "chanjing" ||
        createConfig.createType === "TopView" ||
        createConfig.createType === "latentsync") &&
      currentStep === 3 &&
      step1Data?.generatedImage &&
      generatedVideoPreview
    ) {
      resultToUse = {
        imageUrl: step1Data.generatedImage,
        videoUrl: generatedVideoPreview,
        type: createConfig.createType,
      };
    } else {
      // 使用传入的参数或者现有的generatedResult
      resultToUse = resultParam || generatedResult;
    }

    console.log("=== handleConfirmResult called ===", {
      resultParam,
      generatedResult,
      resultToUse,
      id,
      createType: createConfig.createType,
      hasResult: !!resultToUse,
      hasId: !!id,
      resultType: typeof resultToUse,
      idType: typeof id,
    });

    if (!resultToUse) {
      console.error("❌ result is missing:", { resultParam, generatedResult });
      return;
    }

    if (!id) {
      console.error("❌ id is missing:", id);
      return;
    }

    try {
      console.log("✅ About to save video URL to avatar:", {
        id,
        resultToUse,
      });

      // 检查是否是预设数字人
      const currentCreateDataItem = createVideoStore.videoList.find(
        (item) => item.id === id
      );
      const isPresetAvatar =
        currentCreateDataItem &&
        avatars.some(
          (preset) =>
            preset.imageUrl === currentCreateDataItem.avatarImage ||
            preset.video === currentCreateDataItem.videoUrl
        );

      console.log("🔍 Is preset avatar:", isPresetAvatar, {
        currentCreateDataItem: currentCreateDataItem
          ? {
              id: currentCreateDataItem.id,
              avatarImage: currentCreateDataItem.avatarImage,
              videoUrl: currentCreateDataItem.videoUrl,
            }
          : null,
      });

      if (isPresetAvatar) {
        // 预设数字人：直接更新 createVideoStore，不操作数据库
        console.log(
          "✅ Processing preset avatar - skipping database operations"
        );

        const updatedVideoList = createVideoStore.videoList.map((item) =>
          item.id === id
            ? {
                ...item,
                avatarImage:
                  typeof resultToUse === "string"
                    ? resultToUse
                    : resultToUse.imageUrl, // 始终使用图片作为头像显示
                videoUrl:
                  typeof resultToUse === "string"
                    ? resultToUse
                    : createConfig.createType === "chanjing" ||
                        createConfig.createType === "TopView" ||
                        createConfig.createType === "latentsync"
                      ? resultToUse.videoUrl
                      : resultToUse.imageUrl, // 禅镜、TopView和latentsync类型使用视频URL，其他使用图片URL
              }
            : item
        );

        console.log("🔍 After mapping - updatedVideoList:", {
          targetItem: updatedVideoList.find((item) => item.id === id),
          allIds: updatedVideoList.map((item) => item.id),
        });

        setCreateVideoStore({
          ...createVideoStore,
          videoList: updatedVideoList,
        });

        console.log(
          "✅ Preset avatar updated successfully in createVideoStore",
          {
            newAvatarImage:
              typeof resultToUse === "string"
                ? resultToUse
                : resultToUse.imageUrl,
            targetId: id,
          }
        );
      } else {
        // 自定义数字人：原有的数据库操作逻辑
        console.log(
          "✅ Processing custom avatar - performing database operations"
        );

        // 传递的id是CreateData的id，我们需要找到对应的avatar
        // 首先获取所有avatars，然后找到匹配的那个
        const allAvatars = await db.avatar.toArray();
        console.log("🔍 All avatars in database:", allAvatars);

        // 如果传递的id直接匹配avatar.id
        let targetAvatar = await db.avatar.get(id);

        // 如果没找到，可能需要通过其他方式匹配（比如avatar_id字段）
        if (!targetAvatar) {
          targetAvatar = allAvatars.find((avatar) => avatar.avatar_id === id);
          console.log("🔍 Found avatar by avatar_id:", targetAvatar);
        }

        // 如果还是没找到，尝试其他方式
        if (!targetAvatar && allAvatars.length > 0) {
          // 可能需要通过其他关联关系找到对应的avatar
          console.log(
            "🔍 No direct match found. Available avatars:",
            allAvatars.map((a) => ({
              id: a.id,
              avatar_id: a.avatar_id,
              name: a.name,
            }))
          );
          // 暂时使用第一个avatar作为fallback（用于测试）
          targetAvatar = allAvatars[0];
          console.log("🔍 Using first avatar as fallback:", targetAvatar);
        }

        if (!targetAvatar) {
          console.error(
            "❌ No avatar found. ID:",
            id,
            "Available avatars:",
            allAvatars.length
          );
          return;
        }

        console.log("✅ Target avatar found:", targetAvatar);

        // 根据createType决定保存位置
        if (createConfig.createType === "hedra") {
          // hedra类型：保存图片到pic_url数组
          const imageUrl =
            typeof resultToUse === "string"
              ? resultToUse
              : resultToUse.imageUrl;
          const updatedPicUrls = [...(targetAvatar.pic_url || []), imageUrl];
          await db.avatar.update(targetAvatar.id, {
            pic_url: updatedPicUrls,
          });
          console.log(
            "✅ Image URL saved successfully to avatar pic_url:",
            id,
            imageUrl
          );
        } else if (
          createConfig.createType === "chanjing" &&
          typeof resultToUse === "object"
        ) {
          // chanjing类型：保存图片和视频
          // 保存图片到pic_url数组
          if (resultToUse.imageUrl) {
            const updatedPicUrls = [
              ...(targetAvatar.pic_url || []),
              resultToUse.imageUrl,
            ];
            await db.avatar.update(targetAvatar.id, {
              pic_url: updatedPicUrls,
            });
            console.log(
              "✅ Image URL saved successfully to avatar pic_url:",
              id,
              resultToUse.imageUrl
            );
          }

          // 保存视频到videoUrl数组
          if (resultToUse.videoUrl) {
            await updateAvatarDataItemVideoUrl(
              targetAvatar.id,
              resultToUse.videoUrl
            );
            console.log(
              "✅ Video URL saved successfully to avatar:",
              id,
              resultToUse.videoUrl
            );
          }
        } else {
          // 默认情况：保存到videoUrl数组
          const url =
            typeof resultToUse === "string"
              ? resultToUse
              : resultToUse.imageUrl;
          await updateAvatarDataItemVideoUrl(targetAvatar.id, url);
          console.log("✅ URL saved successfully to avatar:", id, url);
        }

        // 验证是否保存成功
        const updatedAvatar = await db.avatar.get(targetAvatar.id);
        console.log("🎯 Avatar after update:", updatedAvatar);
        if (createConfig.createType === "hedra") {
          console.log("🎯 PicUrl array after update:", updatedAvatar?.pic_url);
        } else {
          console.log(
            "🎯 VideoUrl array after update:",
            updatedAvatar?.videoUrl
          );
        }

        // 同时更新 createVideoStoreAtom，让结果回填到 VideoPreviewFrame
        const updatedVideoList = createVideoStore.videoList.map((item) =>
          item.id === id
            ? {
                ...item,
                avatarImage:
                  typeof resultToUse === "string"
                    ? resultToUse
                    : resultToUse.imageUrl, // 始终使用图片作为头像显示
                videoUrl:
                  typeof resultToUse === "string"
                    ? resultToUse
                    : createConfig.createType === "chanjing" ||
                        createConfig.createType === "TopView" ||
                        createConfig.createType === "latentsync"
                      ? resultToUse.videoUrl
                      : resultToUse.imageUrl, // 禅镜、TopView和latentsync类型使用视频URL，其他使用图片URL
              }
            : item
        );

        setCreateVideoStore({
          ...createVideoStore,
          videoList: updatedVideoList,
        });

        console.log(
          `✅ Updated createVideoStore with new ${createConfig.createType === "hedra" ? "image" : "video"}:`,
          resultToUse
        );
      }

      // 关闭弹框并重置状态
      onOpenChange(false);
      setCurrentView("select");
      setGeneratedResult(null);
      setGeneratedImagePreview(null);
    } catch (error) {
      console.error(
        `❌ Failed to save ${createConfig.createType === "hedra" ? "image" : "video"} URL to avatar:`,
        error
      );
    }
  };

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // 重置之前的错误状态和结果
      setCurrentView("select");
      setGeneratedResult(null);

      setBackgroundFile(file);

      // 创建预览URL
      const reader = new FileReader();
      reader.onloadend = () => {
        setBackgroundPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }

    // 重置文件输入的值，确保相同文件也能重新选择
    if (e.target) {
      e.target.value = "";
    }
  };

  // 移除handleUpload函数，不再需要上传功能

  const handleUploadFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // 对于传统布局，保留基本的文件处理逻辑
    setBackgroundFile(file);
    const reader = new FileReader();
    reader.onloadend = () => {
      setBackgroundPreview(reader.result as string);
    };
    reader.readAsDataURL(file);

    // 重置文件输入的值
    if (e.target) {
      e.target.value = "";
    }
  };

  // 移除handleDeleteBackground，不再需要删除背景功能

  // 移除handleAiGenerateBackground，由新的生成逻辑替代

  // 移除清理无效blob URL的代码，不再需要

  // 渲染步骤条
  const renderStepIndicator = () => {
    const steps = [
      { number: 1, title: t("create.replacePic") },
      { number: 2, title: t("create.createVideoThing") },
    ];

    return (
      <div className="flex items-center justify-center py-4">
        {steps.map((step, index) => (
          <div key={step.number} className="flex items-center">
            <div className="flex items-center">
              <div
                className={`flex h-8 w-8 items-center justify-center rounded-full border-2 ${
                  currentStep >= step.number
                    ? "border-primary bg-primary text-white"
                    : "border-gray-300 text-gray-500"
                }`}
              >
                {step.number}
              </div>
              <span
                className={`ml-2 text-sm ${
                  currentStep >= step.number
                    ? "font-medium text-primary"
                    : "text-gray-500"
                }`}
              >
                {step.title}
              </span>
            </div>
            {index < steps.length - 1 && (
              <div
                className={`mx-4 h-0.5 w-12 ${
                  currentStep > step.number ? "bg-primary" : "bg-gray-300"
                }`}
              />
            )}
          </div>
        ))}
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl p-0">
        {currentView === "select" ? (
          // 背景选择视图
          <>
            {/* Header */}
            <div className="border-b p-4">
              <h2 className="text-lg font-medium">
                {t("create.changeBackground")}
              </h2>
              {/* 为禅镜、topview和latentsync显示步骤条 */}
              {(createConfig.createType === "chanjing" ||
                createConfig.createType === "TopView" ||
                createConfig.createType === "latentsync") &&
                renderStepIndicator()}
            </div>

            {error && (
              <div className="mx-4 mt-2 flex items-center gap-2 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">
                <svg
                  className="h-4 w-4 flex-shrink-0 text-red-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                <span>{error.error.messageCn}</span>
              </div>
            )}

            <div className="p-4">
              {createConfig.createType === "hedra" ||
              createConfig.createType === "Omnihuman" ||
              createConfig.createType === "stable" ? (
                // Hedra、Omnihuman 和 stable 的新布局：左侧原图，右侧模型选择+提示词
                <div className="grid grid-cols-2 gap-6">
                  {/* 左侧：原图/生成结果 */}
                  <div className="space-y-2">
                    <h3 className="text-sm font-medium">
                      {generatedImagePreview
                        ? t("create.createResult")
                        : t("create.originalImage")}
                    </h3>
                    <div className="relative aspect-[3/4] overflow-hidden rounded-2xl border bg-gray-100">
                      {isGenerating && (
                        <div className="absolute inset-0 z-10 flex items-center justify-center rounded-lg bg-white bg-opacity-80">
                          <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-300 border-t-primary"></div>
                        </div>
                      )}
                      {generatedImagePreview ? (
                        <Image
                          className="h-full w-full object-contain"
                          src={generatedImagePreview}
                          alt="生成的图片"
                          width={300}
                          height={400}
                        />
                      ) : avatarImage ? (
                        <Image
                          className="h-full w-full object-contain"
                          src={avatarImage}
                          alt="原图"
                          width={300}
                          height={400}
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center text-sm text-gray-500">
                          原图预览区域
                        </div>
                      )}
                    </div>
                  </div>

                  {/* 右侧：模型选择和提示词 */}
                  <div className="space-y-4">
                    {/* 模型选择 */}
                    <div className="space-y-2">
                      <h3 className="text-sm font-medium">
                        {t("avatar.selectModel")}
                      </h3>
                      <Select
                        value={selectedModel}
                        onValueChange={setSelectedModel}
                        disabled={isGenerating}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="选择模型" />
                        </SelectTrigger>
                        <SelectContent>
                          {MODEL_OPTIONS.map((model) => (
                            <SelectItem key={model.value} value={model.value}>
                              {model.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* 图片提示词 */}
                    <div className="space-y-2">
                      <h3 className="text-sm font-medium">
                        {t("create.imagePrompt")}
                      </h3>
                      <Textarea
                        placeholder={t("create.backgroundPrompt")}
                        className="min-h-[120px] resize-none rounded-xl text-sm"
                        value={imagePrompt}
                        onChange={(e) => setImagePrompt(e.target.value)}
                        disabled={isGenerating}
                      />
                    </div>

                    {/* 纵横比选择 */}
                    {/* <div className="space-y-2">
                      <h3 className="text-sm font-medium">纵横比</h3>
                      <Select
                        value={aspectRatio}
                        onValueChange={(value: "16:9" | "9:16") =>
                          setAspectRatio(value)
                        }
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="16:9">16:9 (横屏)</SelectItem>
                          <SelectItem value="9:16">9:16 (竖屏)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div> */}
                  </div>
                </div>
              ) : createConfig.createType === "chanjing" ||
                createConfig.createType === "TopView" ||
                createConfig.createType === "latentsync" ? (
                // 禅镜和topview的多步骤布局
                <>
                  {currentStep === 1 && (
                    // 第一步：图片替换
                    <div className="grid grid-cols-2 gap-6">
                      {/* 左侧：原图/生成结果 */}
                      <div className="space-y-2">
                        <h3 className="text-sm font-medium">
                          {generatedImagePreview
                            ? "生成结果"
                            : t("create.originalImage")}
                        </h3>
                        <div className="relative aspect-[3/4] overflow-hidden rounded-2xl border bg-gray-100">
                          {isGenerating && (
                            <div className="absolute inset-0 z-10 flex items-center justify-center rounded-lg bg-white bg-opacity-80">
                              <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-300 border-t-primary"></div>
                            </div>
                          )}
                          {generatedImagePreview ? (
                            <Image
                              className="h-full w-full object-contain"
                              src={generatedImagePreview}
                              alt="生成的图片"
                              width={300}
                              height={400}
                            />
                          ) : avatarImage ? (
                            <Image
                              className="h-full w-full object-contain"
                              src={avatarImage}
                              alt="原图"
                              width={300}
                              height={400}
                            />
                          ) : (
                            <div className="flex h-full items-center justify-center text-sm text-gray-500">
                              原图预览区域
                            </div>
                          )}
                        </div>
                      </div>

                      {/* 右侧：模型选择和提示词 */}
                      <div className="space-y-4">
                        {/* 模型选择 */}
                        <div className="space-y-2">
                          <h3 className="text-sm font-medium">
                            {t("avatar.selectModel")}
                          </h3>
                          <Select
                            value={selectedModel}
                            onValueChange={setSelectedModel}
                            disabled={isGenerating}
                          >
                            <SelectTrigger className="w-full">
                              <SelectValue placeholder="选择模型" />
                            </SelectTrigger>
                            <SelectContent>
                              {MODEL_OPTIONS.map((model) => (
                                <SelectItem
                                  key={model.value}
                                  value={model.value}
                                >
                                  {model.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        {/* 图片提示词 */}
                        <div className="space-y-2">
                          <h3 className="text-sm font-medium">
                            {t("create.imagePrompt")}
                          </h3>
                          <Textarea
                            placeholder={t("create.backgroundPrompt")}
                            className="min-h-[120px] resize-none rounded-xl text-sm"
                            value={imagePrompt}
                            onChange={(e) => setImagePrompt(e.target.value)}
                            disabled={isGenerating}
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {currentStep === 2 && (
                    // 第二步：生成视频素材
                    <div className="grid grid-cols-2 gap-6">
                      {/* 左侧：生成的图片 */}
                      <div className="space-y-2">
                        <div className="relative aspect-[3/4] overflow-hidden rounded-2xl border bg-gray-100">
                          {isGenerating && (
                            <div className="absolute inset-0 z-10 flex items-center justify-center rounded-lg bg-white bg-opacity-80">
                              <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-300 border-t-primary"></div>
                            </div>
                          )}
                          {step1Data?.generatedImage ? (
                            <Image
                              className="h-full w-full object-contain"
                              src={step1Data.generatedImage}
                              alt="生成的图片"
                              width={300}
                              height={400}
                            />
                          ) : (
                            <div className="flex h-full items-center justify-center text-sm text-gray-500">
                              图片预览区域
                            </div>
                          )}
                        </div>
                      </div>

                      {/* 右侧：视频配置 */}
                      <div className="space-y-4">
                        {/* 视频提示词 */}
                        <div className="space-y-2">
                          <h3 className="text-sm font-medium">
                            {t("create.videoPrompt")}
                          </h3>
                          <Textarea
                            placeholder={t("create.promptPlaceholder")}
                            className="min-h-[120px] resize-none rounded-xl text-sm"
                            value={videoPrompt}
                            onChange={(e) => setVideoPrompt(e.target.value)}
                            disabled={isGenerating}
                          />
                        </div>

                        {/* 选择模型 */}
                        <div className="space-y-2">
                          <h3 className="text-sm font-medium">
                            {t("avatar.selectModel")}
                          </h3>
                          <Select
                            value={selectedVideoModel}
                            onValueChange={setSelectedVideoModel}
                            disabled={isGenerating}
                          >
                            <SelectTrigger className="w-full">
                              <SelectValue placeholder="选择视频模型" />
                            </SelectTrigger>
                            <SelectContent>
                              {VIDEO_MODEL_OPTIONS.map((model) => (
                                <SelectItem
                                  key={model.value}
                                  value={model.value}
                                >
                                  {model.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        {/* 视频时长 */}
                        <div className="space-y-2">
                          <h3 className="text-sm font-medium">
                            {t("create.videoDuration")}
                          </h3>
                          <Select
                            value={videoDuration}
                            onValueChange={setVideoDuration}
                            disabled={isGenerating || !selectedVideoModel}
                          >
                            <SelectTrigger className="w-full">
                              <SelectValue placeholder="选择时长" />
                            </SelectTrigger>
                            <SelectContent>
                              {selectedVideoModel &&
                              MODEL_DURATION_MAP[
                                selectedVideoModel as keyof typeof MODEL_DURATION_MAP
                              ]
                                ? MODEL_DURATION_MAP[
                                    selectedVideoModel as keyof typeof MODEL_DURATION_MAP
                                  ].map((duration) => (
                                    <SelectItem
                                      key={duration.value}
                                      value={duration.value}
                                    >
                                      {duration.label}
                                    </SelectItem>
                                  ))
                                : null}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    </div>
                  )}

                  {currentStep === 3 && (
                    // 第三步：视频预览
                    <div className="flex items-center justify-center">
                      <div className="w-full max-w-lg space-y-4">
                        {generatedVideoPreview ? (
                          <video
                            src={generatedVideoPreview}
                            controls
                            className="h-auto max-h-96 w-full rounded-lg"
                          />
                        ) : (
                          <div className="flex h-64 items-center justify-center rounded-lg border bg-gray-100">
                            <span className="text-gray-500">视频预览区域</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </>
              ) : (
                // 其他类型的传统布局
                <>
                  {/* Hidden file input */}
                  <input
                    type="file"
                    ref={fileInputRef}
                    className="hidden"
                    accept="image/*"
                    onChange={handleFileChange}
                  />

                  {/* Hidden upload file input */}
                  <input
                    type="file"
                    ref={uploadInputRef}
                    className="hidden"
                    accept="image/*"
                    onChange={handleUploadFileChange}
                  />

                  <div className="grid grid-cols-3 gap-4">
                    {/* Original Image */}
                    <div className="space-y-2">
                      <h3 className="text-xs">{t("create.originalImage")}</h3>
                      <div className="aspect-[3/4] overflow-hidden rounded-2xl border bg-gray-100">
                        {avatarImage ? (
                          <Image
                            className="h-full w-full object-contain"
                            src={avatarImage}
                            alt="原图"
                            width={200}
                            height={250}
                          />
                        ) : (
                          <div className="flex h-full items-center justify-center text-sm">
                            原图预览区域
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Background Image - 上传区域 */}
                    <div className="space-y-2">
                      <h3 className="text-xs">{t("create.backgroundImage")}</h3>
                      <div
                        className="group flex aspect-[3/4] cursor-pointer items-center justify-center rounded-2xl border-2 border-dashed border-gray-300 bg-gray-50 transition-all hover:border-gray-400 hover:bg-gray-100"
                        onClick={() => {
                          if (fileInputRef.current) {
                            fileInputRef.current.click();
                          }
                        }}
                      >
                        {backgroundPreview ? (
                          <div className="relative h-full w-full">
                            <Image
                              src={backgroundPreview}
                              alt="背景预览"
                              width={200}
                              height={250}
                              className="h-full w-full rounded-2xl object-contain"
                            />
                            {/* 上传提示覆盖层 */}
                            <div className="absolute inset-0 flex items-center justify-center rounded-2xl bg-black bg-opacity-0 transition-all group-hover:bg-opacity-50">
                              <div className="flex flex-col items-center gap-2 text-white opacity-0 transition-opacity group-hover:opacity-100">
                                <svg
                                  className="h-8 w-8"
                                  fill="none"
                                  stroke="currentColor"
                                  viewBox="0 0 24 24"
                                >
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                                  />
                                </svg>
                                <span className="text-sm">点击上传新背景</span>
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div className="flex flex-col items-center gap-2 p-3 text-center">
                            {isUploading ? (
                              <>
                                <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-gray-400"></div>
                                <span className="text-sm text-gray-500">
                                  上传中...
                                </span>
                              </>
                            ) : (
                              <>
                                <svg
                                  className="h-8 w-8 text-gray-400"
                                  fill="none"
                                  stroke="currentColor"
                                  viewBox="0 0 24 24"
                                >
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                                  />
                                </svg>
                                <div className="text-sm text-gray-500">
                                  点击上传背景图片
                                </div>
                                <div className="text-xs text-gray-400">
                                  或使用随机背景
                                </div>
                              </>
                            )}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Prompt Settings */}
                    <div className="space-y-2">
                      <h3 className="text-xs">{t("create.prompt")}</h3>
                      <div className="aspect-[3/4] space-y-3">
                        {/* Aspect Ratio Selector */}
                        <div className="space-y-1">
                          <Select
                            value={aspectRatio}
                            onValueChange={(value: "16:9" | "9:16") =>
                              setAspectRatio(value)
                            }
                          >
                            <SelectTrigger className="h-8 text-sm">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="16:9">16:9</SelectItem>
                              <SelectItem value="9:16">9:16</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        <Textarea
                          placeholder={t("create.promptPlaceholder")}
                          className="h-full resize-none rounded-xl text-sm"
                          value={prompt}
                          onChange={(e) => setPrompt(e.target.value)}
                        />
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Generate Button - Bottom Right */}
            <div className="flex justify-end border-t p-4">
              {createConfig.createType === "hedra" ||
              createConfig.createType === "Omnihuman" ||
              createConfig.createType === "stable" ? (
                // Hedra/Omnihuman/stable 的按钮逻辑
                <div className="flex gap-3">
                  {generatedImagePreview && !isGenerating && (
                    <Button
                      variant="outline"
                      onClick={handleGenerate}
                      disabled={isGenerating}
                      className="px-6"
                    >
                      {t("create.generate")}
                    </Button>
                  )}
                  <Button
                    onClick={
                      generatedImagePreview
                        ? () => handleConfirmResult()
                        : handleGenerate
                    }
                    disabled={isGenerating}
                    className="px-6"
                  >
                    {isGenerating ? (
                      <div className="flex items-center gap-2">
                        <div className="h-4 w-4 animate-spin rounded-full border-b-2 border-white"></div>
                        <span>{t("create.generating")}</span>
                      </div>
                    ) : generatedImagePreview ? (
                      t("create.saveAndReplace")
                    ) : (
                      t("create.generate")
                    )}
                  </Button>
                </div>
              ) : createConfig.createType === "chanjing" ||
                createConfig.createType === "TopView" ||
                createConfig.createType === "latentsync" ? (
                // 禅镜和topview的多步骤按钮逻辑
                <div className="flex gap-3">
                  {currentStep > 1 && (
                    <Button
                      variant="outline"
                      onClick={() => {
                        if (currentStep === 2) {
                          setCurrentStep(1);
                        } else if (currentStep === 3) {
                          setCurrentStep(1);
                          // 重新生成时回到第一步，恢复数据
                          if (step1Data) {
                            setImagePrompt(step1Data.imagePrompt);
                            setSelectedModel(step1Data.selectedModel);
                            setGeneratedImagePreview(step1Data.generatedImage);
                          }
                        }
                      }}
                      disabled={isGenerating}
                      className="px-6"
                    >
                      {currentStep === 3
                        ? t("create.reGenerate")
                        : t("create.back")}
                    </Button>
                  )}
                  <Button
                    onClick={() => {
                      if (currentStep === 1) {
                        // 第一步只需要生成图片，成功后会自动进入第二步
                        handleGenerate();
                      } else if (currentStep === 2) {
                        // 生成视频 (这里暂时模拟，后续需要实现真实的视频生成API)
                        handleVideoGenerate();
                      } else if (currentStep === 3) {
                        // 保存并替换
                        handleConfirmResult();
                      }
                    }}
                    disabled={
                      isGenerating || (currentStep === 2 && !selectedVideoModel)
                    }
                    className="px-6"
                  >
                    {isGenerating ? (
                      <div className="flex items-center gap-2">
                        <div className="h-4 w-4 animate-spin rounded-full border-b-2 border-white"></div>
                        <span>{t("create.generating")}</span>
                      </div>
                    ) : currentStep === 1 ? (
                      t("create.generate")
                    ) : currentStep === 2 ? (
                      t("create.generate")
                    ) : (
                      t("create.saveAndReplace")
                    )}
                  </Button>
                </div>
              ) : (
                // 其他类型的原有逻辑
                <Button
                  onClick={handleGenerate}
                  disabled={isLoadingImage || !backgroundFile}
                  className="px-6"
                >
                  {t("create.generate")}
                </Button>
              )}
            </div>
          </>
        ) : (
          // 生成结果视图
          <>
            {/* Header with Back Button */}
            <div className="flex items-center border-b p-4">
              <Button
                variant="ghost"
                size="sm"
                className="mr-3 h-8 w-8 p-1"
                onClick={handleBackToSelect}
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <h2 className="text-lg font-medium"> </h2>
            </div>

            {/* Result Content */}
            <div className="flex-1 p-6">
              <div className="flex items-center justify-center">
                {generatedResult ? (
                  <div className="w-full max-w-lg space-y-4">
                    {/* 根据createType和结果类型显示不同的内容 */}
                    {/* 始终显示图片，不论是hedra还是chanjing类型 */}
                    <img
                      src={
                        typeof generatedResult === "string"
                          ? generatedResult
                          : generatedResult.imageUrl
                      }
                      alt="背景更换结果"
                      className="h-auto max-h-96 w-full rounded-lg object-contain"
                    />
                    <div className="flex justify-center">
                      <Button
                        onClick={() => handleConfirmResult()}
                        className="px-6"
                      >
                        {t("create.confirmUse")}
                      </Button>
                    </div>
                  </div>
                ) : (
                  // Loading State
                  <div className="flex flex-col items-center space-y-4">
                    <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-primary"></div>
                    <p className="text-sm text-muted-foreground">
                      {t("create.generatingBackground")}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </DialogContent>

      {/* 移除AI生成背景弹框 */}
    </Dialog>
  );
};

export const BackgroundSelectModal = React.memo(BackgroundSelectModalComponent);
