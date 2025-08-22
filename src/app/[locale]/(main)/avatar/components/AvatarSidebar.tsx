"use client";

import React, { useState, useRef, useEffect } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CreateAppearanceTab } from "./CreateAppearanceTab";
import { CreateActionTab } from "./CreateActionTab";
import { CustomAvatarForm } from "./CustomAvatarForm";
import { CreateAvatarDialog } from "./CreateAvatarDialog";
import { toast } from "sonner";
import ky from "ky";
import { appConfigAtom, store } from "@/stores";
import {
  genImageAtom,
  GeneratedImageData,
} from "@/stores/slices/gen_image_store";
import { useAtom } from "jotai";
import { eventBus } from "@/utils/eventBus";
import { useTranslations } from "next-intl";

interface AvatarSidebarProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  type: "custom" | "text-gen";
}

export const AvatarSidebar: React.FC<AvatarSidebarProps> = ({
  open,
  onOpenChange,
  type,
}) => {
  const t = useTranslations();
  const title =
    type === "custom" ? t("avatar.customAvatar") : t("avatar.textGenAvatar");
  const [_, setIsUploading] = useState(false);
  const { apiKey } = store.get(appConfigAtom);
  const [genImage, setGenImage] = useAtom(genImageAtom);

  // 创建数字人弹框状态
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [selectedImageData, setSelectedImageData] = useState<any>(null);

  // 定制数字人状态
  const [avatarName, setAvatarName] = useState("");
  const [selectedVideo, setSelectedVideo] = useState<File | null>(null);
  const [uploadedVideoUrl, setUploadedVideoUrl] = useState<string>("");

  // 声音选择方式状态
  const [voiceSelectionType, setVoiceSelectionType] = useState<
    "library" | "clone" | null
  >(null);

  // 音色库选择状态
  const [selectedPlatform, setSelectedPlatform] = useState("");
  const [selectedVoice, setSelectedVoice] = useState("");
  const [googleModel, setGoogleModel] = useState("Gemini Flash");
  const [azureLanguage, setAzureLanguage] = useState("");

  // 人声克隆状态
  const [cloneInputText, setCloneInputText] = useState("");
  const [cloneModel, setCloneModel] = useState("");

  const [clonedVoiceName, setClonedVoiceName] = useState("");
  const [selectedModel, setSelectedModel] = useState("");

  // CreateActionTab 状态管理
  const [actionSelectDialogOpen, setActionSelectDialogOpen] = useState(false);
  const [selectedActionAvatar, setSelectedActionAvatar] = useState<any>(null);
  const [generatedActions, setGeneratedActions] = useState<any[]>([]);
  const [actionPrompt, setActionPrompt] = useState("");
  const [actionModel, setActionModel] = useState("kling_21_i2v_hq");
  const [actionIsGenerating, setActionIsGenerating] = useState(false);

  // 标签页状态
  const [activeTab, setActiveTab] = useState("appearance");

  // 重置定制数字人表单状态
  const resetCustomAvatarForm = () => {
    setAvatarName("");
    setSelectedVideo(null);
    setUploadedVideoUrl("");
    setVoiceSelectionType(null);
    setSelectedPlatform("");
    setSelectedVoice("");
    setGoogleModel("Gemini Flash");
    setAzureLanguage("");
    setCloneInputText("");
    setCloneModel("");
    setClonedVoiceName("");
    setSelectedModel("");
  };

  // 当弹框打开时重置表单
  useEffect(() => {
    if (open && type === "custom") {
      resetCustomAvatarForm();
    }
  }, [open, type]);

  // 处理创建成功
  const handleCreateSuccess = () => {
    onOpenChange(false); // 关闭弹框
    resetCustomAvatarForm(); // 重置表单
  };

  // 处理创建失败
  const handleCreateError = (error: string) => {
    // 失败时不关闭弹框，只显示错误信息（toast已在CustomAvatarForm中处理）
    console.error("Avatar creation failed:", error);
  };

  // 监听生成数字人动作事件
  useEffect(() => {
    const handleCreateActionWithImage = (imageData: GeneratedImageData) => {
      // 将图片数据转换为适合CreateActionTab的格式
      const avatarData = {
        type: "upload",
        preview: imageData.image_url,
        uploadUrl: imageData.image_url,
        data: imageData,
      };

      setSelectedActionAvatar(avatarData);
      setActiveTab("action");
    };

    const handleNavigateToAppearanceTab = () => {
      setActiveTab("appearance");
    };

    eventBus.on("createActionWithImage", handleCreateActionWithImage);
    eventBus.on("navigateToAppearanceTab", handleNavigateToAppearanceTab);

    return () => {
      eventBus.off("createActionWithImage", handleCreateActionWithImage);
      eventBus.off("navigateToAppearanceTab", handleNavigateToAppearanceTab);
    };
  }, []);

  // CreateAppearanceTab 状态管理
  const [appearanceImageFile, setAppearanceImageFile] = useState<File | null>(
    null
  );
  const [appearanceTextDescription, setAppearanceTextDescription] =
    useState("");
  const [appearanceAge, setAppearanceAge] = useState<string>("young");
  const [appearanceGender, setAppearanceGender] = useState<string>("male");
  const [appearanceRegion, setAppearanceRegion] = useState<string>("china");
  const [appearancePrompt, setAppearancePrompt] = useState<string>("");
  const [appearanceReferenceType, setAppearanceReferenceType] =
    useState<string>("character-appearance");
  const [appearanceModel, setAppearanceModel] = useState<string>(
    "flux-kontext-pro-t2i"
  );
  const [appearanceAspectRatio, setAppearanceAspectRatio] =
    useState<string>("9:16");
  const [appearanceQuantity, setAppearanceQuantity] = useState<number>(1);
  const [appearanceIsGenerating, setAppearanceIsGenerating] =
    useState<boolean>(false);
  const [appearanceEditingImageData, setAppearanceEditingImageData] =
    useState<GeneratedImageData | null>(null);

  // 根据是否有参考图片动态设置默认模型
  useEffect(() => {
    const hasReferenceImage =
      appearanceImageFile ||
      (appearanceEditingImageData &&
        appearanceEditingImageData.referenceImageUrl);

    if (hasReferenceImage) {
      // 图生图模式：默认使用 302ai-flux-kontext-max-i2i
      setAppearanceModel("302ai-flux-kontext-max-i2i");
    } else {
      // 文生图模式：默认使用 gpt-image-1-t2i
      setAppearanceModel("302ai-flux-kontext-max-t2i");
    }
  }, [appearanceImageFile, appearanceEditingImageData]);

  // 上传视频到服务器
  const uploadVideo = async (file: File): Promise<string> => {
    try {
      setIsUploading(true);

      if (!apiKey) {
        throw new Error("API Key is required");
      }

      // 创建FormData对象
      const formData = new FormData();
      formData.append("apiKey", apiKey);
      formData.append("file", file);

      const response = await ky
        .post("/api/upload-video", {
          body: formData,
          timeout: 120000,
        })
        .json<{ data?: string }>();

      // 处理不同的响应格式
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
      // 检查文件类型
      if (!file.type.startsWith("video/")) {
        toast.error("请选择视频文件");
        return;
      }

      // 检查文件大小 (例如限制为100MB)
      const maxSize = 100 * 1024 * 1024; // 100MB
      if (file.size > maxSize) {
        toast.error("视频文件大小不能超过100MB");
        return;
      }

      setSelectedVideo(file);

      try {
        toast.loading("正在上传视频...", { id: "video-upload" });
        const videoUrl = await uploadVideo(file);
        setUploadedVideoUrl(videoUrl);
        // toast.success("视频上传成功", { id: "video-upload" });
      } catch (error) {
        toast.error("视频上传失败，请重试", { id: "video-upload" });
        setSelectedVideo(null);
      }
    }
  };

  // 下载图片功能
  const handleDownloadImage = async (imageUrl: string, filename?: string) => {
    try {
      const response = await fetch(imageUrl);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename || `generated-image-${Date.now()}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      // toast.success("图片下载成功");
    } catch (error) {
      console.error("下载失败:", error);
      toast.error("图片下载失败");
    }
  };

  // 删除图片功能
  const handleDeleteImage = (imageId: string) => {
    const updatedImages = genImage.filter((img) => img.id !== imageId);
    setGenImage(updatedImages);
    // toast.success("图片已删除");
  };

  // 创建数字人功能
  const handleCreateAvatar = (imageData: any) => {
    setSelectedImageData(imageData);
    setCreateDialogOpen(true);
  };

  // 渲染定制数字人界面
  const renderCustomAvatarContent = () => (
    <div className="flex h-full flex-col overflow-hidden">
      <CustomAvatarForm
        apiKey={apiKey!}
        avatarName={avatarName}
        onAvatarNameChange={setAvatarName}
        selectedVideo={selectedVideo}
        onVideoChange={setSelectedVideo}
        uploadedVideoUrl={uploadedVideoUrl}
        onUploadedVideoUrl={setUploadedVideoUrl}
        voiceSelectionType={voiceSelectionType}
        onVoiceSelectionTypeChange={setVoiceSelectionType}
        selectedPlatform={selectedPlatform}
        onSelectedPlatformChange={setSelectedPlatform}
        selectedVoice={selectedVoice}
        onSelectedVoiceChange={setSelectedVoice}
        cloneInputText={cloneInputText}
        onCloneInputTextChange={setCloneInputText}
        cloneModel={cloneModel}
        onCloneModelChange={setCloneModel}
        clonedVoiceName={clonedVoiceName}
        onClonedVoiceNameChange={setClonedVoiceName}
        selectedModel={selectedModel}
        onSelectedModelChange={setSelectedModel}
        googleModel={googleModel}
        onGoogleModelChange={setGoogleModel}
        azureLanguage={azureLanguage}
        onAzureLanguageChange={setAzureLanguage}
        onSuccess={handleCreateSuccess}
        onError={handleCreateError}
      />
    </div>
  );

  // 渲染文生数字人界面（保持原有的tabs结构）
  const renderTextGenAvatarContent = () => (
    <div className="flex h-full overflow-hidden">
      <div className="flex w-full flex-col overflow-hidden">
        <div className="mt-6 flex flex-1 flex-col overflow-hidden">
          <Tabs
            value={activeTab}
            onValueChange={setActiveTab}
            className="flex flex-1 flex-col overflow-hidden"
          >
            <TabsList className="mb-4 grid w-full grid-cols-2">
              <TabsTrigger value="appearance">
                {t("avatar.createAppearance")}
              </TabsTrigger>
              <TabsTrigger value="action">
                {t("avatar.createAction")}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="appearance" className="flex-1 overflow-hidden">
              <CreateAppearanceTab
                type={type}
                // 状态 props
                imageFile={appearanceImageFile}
                setImageFile={setAppearanceImageFile}
                textDescription={appearanceTextDescription}
                setTextDescription={setAppearanceTextDescription}
                age={appearanceAge}
                setAge={setAppearanceAge}
                gender={appearanceGender}
                setGender={setAppearanceGender}
                region={appearanceRegion}
                setRegion={setAppearanceRegion}
                prompt={appearancePrompt}
                setPrompt={setAppearancePrompt}
                referenceType={appearanceReferenceType}
                setReferenceType={setAppearanceReferenceType}
                model={appearanceModel}
                setModel={setAppearanceModel}
                aspectRatio={appearanceAspectRatio}
                setAspectRatio={setAppearanceAspectRatio}
                quantity={appearanceQuantity}
                setQuantity={setAppearanceQuantity}
                isGenerating={appearanceIsGenerating}
                setIsGenerating={setAppearanceIsGenerating}
                editingImageData={appearanceEditingImageData}
                setEditingImageData={setAppearanceEditingImageData}
              />
            </TabsContent>

            <TabsContent value="action" className="flex-1 overflow-hidden">
              <CreateActionTab
                // 状态 props
                selectDialogOpen={actionSelectDialogOpen}
                setSelectDialogOpen={setActionSelectDialogOpen}
                selectedAvatar={selectedActionAvatar}
                setSelectedAvatar={setSelectedActionAvatar}
                prompt={actionPrompt}
                setPrompt={setActionPrompt}
                model={actionModel}
                setModel={setActionModel}
                isGenerating={actionIsGenerating}
                setIsGenerating={setActionIsGenerating}
              />
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className={`flex w-full flex-col overflow-hidden ${
          type === "text-gen"
            ? "max-w-screen-xl sm:max-w-screen-lg"
            : "max-w-2xl sm:max-w-xl"
        }`}
      >
        <SheetHeader className="flex-shrink-0">
          <SheetTitle>{title}</SheetTitle>
        </SheetHeader>

        <div className="flex-1 overflow-hidden">
          {type === "custom"
            ? renderCustomAvatarContent()
            : renderTextGenAvatarContent()}
        </div>

        {/* 创建数字人弹框 */}
        <CreateAvatarDialog
          open={createDialogOpen}
          onOpenChange={setCreateDialogOpen}
          imageData={selectedImageData}
        />
      </SheetContent>
    </Sheet>
  );
};
