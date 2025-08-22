"use client";

import React, { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  CirclePlus,
  Play,
  SquarePen,
  Download,
  Trash2,
  OctagonAlert,
  RefreshCcw,
  Languages,
  Loader2,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { createTextToImage } from "@/services/gen-text-to-image";
import { appConfigAtom, store } from "@/stores";
import { chat } from "@/services/chat";
import { getImageDesc } from "@/services/get-image-desc";
import { uploadVideo } from "@/services/upload-video";
import { eventBus } from "@/utils/eventBus";
import { toast } from "sonner";
import { useGenImageDb } from "@/hooks/db/use-gen-image-db";
import { GeneratedImage } from "@/db/types";
import { SaveAsMaterialModal } from "./save-as-material-modal";
import { useAvatarDb } from "@/hooks/db/use-avatar-db";
import { CreateAvatarDialog } from "./CreateAvatarDialog";
import { useTranslations } from "next-intl";
import { examples } from "@/constants/examples";

interface CreateAppearanceTabProps {
  type: "custom" | "text-gen";
  imageFile: File | null;
  setImageFile: (file: File | null) => void;
  textDescription: string;
  setTextDescription: (text: string) => void;
  age: string;
  setAge: (age: string) => void;
  gender: string;
  setGender: (gender: string) => void;
  region: string;
  setRegion: (region: string) => void;
  prompt: string;
  setPrompt: (prompt: string) => void;
  referenceType: string;
  setReferenceType: (type: string) => void;
  model: string;
  setModel: (model: string) => void;
  aspectRatio: string;
  setAspectRatio: (ratio: string) => void;
  quantity: number;
  setQuantity: (quantity: number) => void;
  isGenerating: boolean;
  setIsGenerating: (generating: boolean) => void;
  editingImageData: GeneratedImage | null;
  setEditingImageData: (data: GeneratedImage | null) => void;
}

export const CreateAppearanceTab: React.FC<CreateAppearanceTabProps> = ({
  type,
  imageFile,
  setImageFile,
  textDescription,
  setTextDescription,
  age,
  setAge,
  gender,
  setGender,
  region,
  setRegion,
  prompt,
  setPrompt,
  referenceType,
  setReferenceType,
  model,
  setModel,
  aspectRatio,
  setAspectRatio,
  quantity,
  setQuantity,
  isGenerating,
  setIsGenerating,
  editingImageData,
  setEditingImageData,
}) => {
  const { apiKey } = store.get(appConfigAtom);
  const { generatedImages, addGeneratedImages, deleteGeneratedImage } =
    useGenImageDb();
  const { updateAvatarDataItemPicUrl } = useAvatarDb();

  // 保存为图片素材的状态
  const [isSaveImageModalOpen, setIsSaveImageModalOpen] = useState(false);
  const [selectedImage, setSelectedImage] = useState<GeneratedImage | null>(
    null
  );
  const [selectedAvatarId, setSelectedAvatarId] = useState<string | null>(null);
  const t = useTranslations();
  const [isTranslating, setIsTranslating] = useState(false);

  // 创建数字人弹框状态
  const [isCreateAvatarDialogOpen, setIsCreateAvatarDialogOpen] =
    useState(false);
  const [selectedImageForAvatar, setSelectedImageForAvatar] =
    useState<GeneratedImage | null>(null);

  // 随机填充示例内容
  const handleRefreshPrompt = () => {
    const randomExample = examples[Math.floor(Math.random() * examples.length)];
    setPrompt(t(`avatar.${randomExample.name}`));
  };

  // 翻译文本
  const handleTranslate = async (targetLanguage: "ZH" | "EN" | "JA") => {
    if (!prompt.trim()) {
      toast.error("请先输入要翻译的文本");
      return;
    }

    if (!apiKey) {
      toast.error("请先配置API Key");
      return;
    }

    try {
      setIsTranslating(true);

      const response = await fetch("/api/translate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          language: targetLanguage,
          apiKey: apiKey,
          message: prompt.trim(),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error?.messageCn || data.error || "翻译失败");
      }

      if (data.translatedText) {
        setPrompt(data.translatedText);
      } else {
        throw new Error("翻译结果为空");
      }
    } catch (error) {
      console.error("翻译失败:", error);
      toast.error(error instanceof Error ? error.message : "翻译失败，请重试");
    } finally {
      setIsTranslating(false);
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
  const handleDeleteImage = async (imageId: string) => {
    try {
      await deleteGeneratedImage(imageId);
      // toast.success("图片已删除");
    } catch (error) {
      console.error("删除失败:", error);
      toast.error("删除失败");
    }
  };

  // 添加为参考图功能
  const handleAddAsReference = async (image: GeneratedImage) => {
    try {
      // 清空当前上传的文件，使用生成的图片作为参考图
      setImageFile(null);

      // 重置文件输入
      const fileInput = document.getElementById(
        "image-upload"
      ) as HTMLInputElement;
      if (fileInput) {
        fileInput.value = "";
      }

      // 直接使用图片URL，不下载文件避免CORS问题
      // 通过设置编辑数据来传递参考图片信息
      const editingData = {
        ...image,
        referenceImageUrl: image.image_url,
      };

      // 如果有setEditingImageData函数，使用它
      if (typeof setEditingImageData === "function") {
        setEditingImageData(editingData);
      }

      setReferenceType("character-appearance");
      // toast.success("已添加为参考图");
    } catch (error) {
      console.error("添加参考图失败:", error);
      toast.error("添加参考图失败");
    }
  };

  // 创建数字人功能
  const handleCreateAvatar = (imageData: GeneratedImage) => {
    setSelectedImageForAvatar(imageData);
    setIsCreateAvatarDialogOpen(true);
  };

  // 生成数字人动作功能
  const handleCreateAction = (imageData: GeneratedImage) => {
    eventBus.emit("createActionWithImage", imageData);
    // toast.success("已将图片设置为动作生成的参考图");
  };

  // 保存为图片素材功能
  const handleSaveImage = (image: GeneratedImage) => {
    setSelectedImage(image);
    setIsSaveImageModalOpen(true);
  };

  // 保存图片到Avatar的函数
  const handleSaveImageToAvatar = async (avatarId: string) => {
    if (!selectedImage) return;
    await updateAvatarDataItemPicUrl(avatarId, selectedImage.image_url);
    // toast.success("图片已保存到数字人");
  };

  // 监听编辑事件
  useEffect(() => {
    const handleEditImage = (data: GeneratedImage) => {
      // 保存编辑数据用于模型选择判断
      setEditingImageData(data);

      // 回填所有字段
      setPrompt(data.prompt);
      setAge(data.age);
      setGender(data.gender);
      setRegion(data.region);
      setReferenceType(data.referenceType);
      setModel(data.model);
      setAspectRatio(data.aspectRatio);
      setQuantity(data.quantity);

      // 如果有参考图，显示提示信息
      if (data.referenceImageUrl) {
        console.log("原参考图URL:", data.referenceImageUrl);
        // 清空当前选择的文件，但保留URL信息用于重新生成
        setImageFile(null);
      }
    };

    eventBus.on("editImage", handleEditImage);

    return () => {
      eventBus.off("editImage", handleEditImage);
    };
  }, []);

  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setImageFile(file);
      // 清空编辑数据，因为用户选择了新的图片
      setEditingImageData(null);
    }
  };

  const handleImageDelete = () => {
    setImageFile(null);
    setEditingImageData(null);
    // 重置文件输入，避免重复上传同名文件时不触发onChange
    const fileInput = document.getElementById(
      "image-upload"
    ) as HTMLInputElement;
    if (fileInput) {
      fileInput.value = "";
    }
  };

  const handleGenerate = async () => {
    setIsGenerating(true);
    let currentReferenceType = "no-reference";
    let referenceContent = "";
    let imageUrl = "";
    try {
      if (imageFile) {
        // 用户上传了新的图片
        const res = await uploadVideo({
          apiKey: apiKey!,
          file: imageFile,
        });
        imageUrl = res.data;
        const { result } = await getImageDesc({
          apiKey: apiKey!,
          image: imageUrl,
          referenceType: referenceType,
        });
        currentReferenceType = referenceType;
        referenceContent = result;
      } else if (editingImageData && editingImageData.referenceImageUrl) {
        // 编辑模式且原来有参考图，使用原有的参考图
        imageUrl = editingImageData.referenceImageUrl;
        currentReferenceType = referenceType;
        referenceContent = editingImageData.referenceContent;
      }

      const data = await chat({
        apiKey: apiKey!,
        prompt: prompt,
        gender: gender,
        age: age,
        region: region,
        referenceType: currentReferenceType,
        referenceContent: referenceContent,
      });

      // 根据数量循环生成图片，每生成一个就立即添加到数据库
      for (let i = 0; i < quantity; i++) {
        try {
          const image = await createTextToImage({
            apiKey: apiKey!,
            prompt: data.result,
            model: model,
            image: imageUrl,
            aspectRatio: aspectRatio,
          });

          const generatedImageData: GeneratedImage = {
            id: `${Date.now()}-${i}`,
            image_url: image.image_url,
            prompt: prompt,
            age: age,
            gender: gender,
            region: region,
            referenceType: currentReferenceType,
            referenceContent: referenceContent,
            referenceImageUrl: imageUrl || undefined,
            model: model,
            aspectRatio: aspectRatio,
            quantity: quantity,
            createdAt: new Date(),
          };

          // 立即添加单个生成的图片到数据库
          await addGeneratedImages([generatedImageData]);

          console.log(`图片 ${i + 1}/${quantity} 生成并保存成功`);
          // toast.success(`图片 ${i + 1}/${quantity} 生成完成`);
        } catch (imageError) {
          console.error(`图片 ${i + 1} 生成失败:`, imageError);
          toast.error(`生成失败`);
          // 继续生成下一个图片，不中断整个流程
        }
      }

      // 清空编辑状态
      setEditingImageData(null);
    } catch (error) {
      console.error("生成图片失败:", error);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="flex h-full gap-6 overflow-hidden">
      {/* 左侧操作栏 */}
      <div className="flex min-w-[400px] flex-[3] flex-col overflow-hidden">
        <div className="mb-2 flex-1 space-y-4 overflow-y-auto px-4 pb-2">
          <div className="mb-4">
            <Label className="mb-2 block text-sm">
              {t("avatar.contentNotRequired")}
            </Label>
          </div>

          {/* Image Upload Area */}
          <Card className="h-[210px] overflow-hidden border-2 border-dashed text-center hover:border-primary/50 hover:bg-primary/5">
            <div className="flex h-full flex-col items-center justify-center gap-3 py-2">
              {!imageFile &&
              (!editingImageData || !editingImageData.referenceImageUrl) ? (
                // 上传状态
                <div
                  className="flex h-full w-full cursor-pointer flex-col items-center justify-center gap-y-2 rounded transition-colors hover:bg-gray-50"
                  onClick={() =>
                    document.getElementById("image-upload")?.click()
                  }
                >
                  <CirclePlus className="size-6" />
                  <span className="text-sm">
                    {t("avatar.uploadReferenceImage")}
                  </span>
                </div>
              ) : (
                // 已上传状态 - 显示本地文件或引用图片
                <div className="flex flex-col items-center gap-2">
                  <div className="relative">
                    <div className="h-48 w-48 overflow-hidden rounded-lg border bg-gray-50">
                      <img
                        src={
                          imageFile
                            ? URL.createObjectURL(imageFile)
                            : editingImageData?.referenceImageUrl || ""
                        }
                        alt="参考图预览"
                        className="h-full w-full object-contain"
                      />
                    </div>
                    <button
                      onClick={handleImageDelete}
                      className="absolute -right-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full bg-red-500 text-white shadow-md transition-colors hover:bg-red-600"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                </div>
              )}

              <input
                type="file"
                accept="image/*"
                onChange={handleImageUpload}
                className="hidden"
                id="image-upload"
              />
              {/* 
              {editingImageData &&
                editingImageData.referenceImageUrl &&
                !imageFile && (
                  <div className="mt-2 text-sm text-orange-600">
                    原有参考图已保存，可重新上传或直接生成
                  </div>
                )} */}
            </div>
          </Card>

          {/* Reference Type Selection - Only show when image is uploaded */}
          {(imageFile ||
            (editingImageData && editingImageData.referenceImageUrl)) && (
            <div className="mb-6 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Label className="text-sm">{t("avatar.referenceType")}</Label>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <OctagonAlert className="h-4 w-4 text-gray-500" />
                    </TooltipTrigger>
                    <TooltipContent className="max-w-xs">
                      <div className="space-y-1">
                        <p>
                          <strong>{t("avatar.referenceCharacter")}</strong>
                          {t("avatar.referenceCharacterDescription")}
                        </p>
                        <p>
                          <strong>{t("avatar.referenceTheme")}</strong>
                          {t("avatar.referenceThemeDescription")}
                        </p>
                      </div>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              <div className="flex rounded-lg border border-border bg-background">
                <button
                  className={`rounded-l-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                    referenceType === "character-appearance"
                      ? "bg-primary text-primary-foreground"
                      : "hover:bg-muted"
                  }`}
                  onClick={() => setReferenceType("character-appearance")}
                >
                  {t("avatar.characterAppearance")}
                </button>
                <button
                  className={`rounded-r-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                    referenceType === "theme-style"
                      ? "bg-primary text-primary-foreground"
                      : "hover:bg-muted"
                  }`}
                  onClick={() => setReferenceType("theme-style")}
                >
                  {t("avatar.themeStyle")}
                </button>
              </div>
            </div>
          )}

          {/* Form Fields */}
          <div className="space-y-4">
            {/* Age */}
            <div>
              <Label className="mb-2 block text-sm">{t("avatar.age")}</Label>
              <Select value={age} onValueChange={setAge}>
                <SelectTrigger className="bg-transparent">
                  <SelectValue placeholder="青年" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="young">{t("avatar.young")}</SelectItem>
                  <SelectItem value="middle-aged">
                    {t("avatar.middleAged")}
                  </SelectItem>
                  <SelectItem value="elderly">{t("avatar.elderly")}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Gender */}
            <div>
              <Label className="mb-2 block text-sm">{t("avatar.gender")}</Label>
              <Select value={gender} onValueChange={setGender}>
                <SelectTrigger className="bg-transparent">
                  <SelectValue placeholder={t("voice.voiceClone.male")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="male">
                    {t("voice.voiceClone.male")}
                  </SelectItem>
                  <SelectItem value="female">
                    {t("voice.voiceClone.female")}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Region */}
            <div>
              <Label className="mb-2 block text-sm">{t("avatar.region")}</Label>
              <Select value={region} onValueChange={setRegion}>
                <SelectTrigger className="bg-transparent">
                  <SelectValue placeholder="中国" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="any">{t("avatar.any")}</SelectItem>
                  <SelectItem value="china">{t("avatar.china")}</SelectItem>
                  <SelectItem value="europe">{t("avatar.europe")}</SelectItem>
                  <SelectItem value="africa">{t("avatar.africa")}</SelectItem>
                  <SelectItem value="south-asia">
                    {t("avatar.southAsia")}
                  </SelectItem>
                  <SelectItem value="east-asia">
                    {t("avatar.eastAsia")}
                  </SelectItem>
                  <SelectItem value="middle-east">
                    {t("avatar.middleEast")}
                  </SelectItem>
                  <SelectItem value="south-america">
                    {t("avatar.southAmerica")}
                  </SelectItem>
                  <SelectItem value="north-america">
                    {t("avatar.northAmerica")}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Prompt */}
            <div>
              <Label className="mb-2 block text-sm">{t("avatar.prompt")}</Label>
              <div className="relative">
                <Textarea
                  className="min-h-[80px] resize-none bg-transparent"
                  placeholder=""
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                />
                {/* 自定义 placeholder 带图标 */}
                {!prompt && (
                  <div className="pointer-events-none absolute left-3 top-3 flex items-center gap-2 text-sm text-gray-400">
                    <span className="flex items-center">
                      {t("avatar.promptPlaceholdertruncat1")}
                      <RefreshCcw className="mx-1 h-3 w-3" />
                      {t("avatar.promptPlaceholdertruncat2")}
                    </span>
                  </div>
                )}
                <div className="pointer-events-none absolute inset-0 flex items-end justify-end p-2">
                  <div className="pointer-events-auto flex gap-1">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button
                          type="button"
                          className="flex h-6 w-6 items-center justify-center rounded border border-gray-200/50 text-gray-500 shadow-sm backdrop-blur-sm hover:bg-gray-100/80 hover:text-gray-700"
                          title={t("avatar.translate")}
                          disabled={isTranslating || !prompt.trim()}
                        >
                          {isTranslating ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Languages className="h-4 w-4" />
                          )}
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onClick={() => handleTranslate("ZH")}
                          disabled={isTranslating}
                        >
                          {t("create.chinese")}
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => handleTranslate("EN")}
                          disabled={isTranslating}
                        >
                          {t("create.english")}
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => handleTranslate("JA")}
                          disabled={isTranslating}
                        >
                          {t("create.japanese")}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                    <button
                      type="button"
                      onClick={handleRefreshPrompt}
                      className="flex h-6 w-6 items-center justify-center rounded border border-gray-200/50 text-gray-500 shadow-sm backdrop-blur-sm hover:bg-gray-100/80 hover:text-gray-700"
                      title={t("avatar.randomFillExampleContent")}
                    >
                      <RefreshCcw className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Model Selection and Settings */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label className="text-sm">{t("avatar.selectModel")}</Label>
                <Select value={model} onValueChange={setModel}>
                  <SelectTrigger className="w-32 bg-transparent text-xs">
                    <SelectValue placeholder="Doubao 3.0" />
                  </SelectTrigger>
                  <SelectContent>
                    {imageFile ||
                    (editingImageData && editingImageData.referenceImageUrl) ? (
                      // 图生图模型
                      <>
                        <SelectItem value="302ai-flux-kontext-max-i2i">
                          Flux kontext max
                        </SelectItem>
                        <SelectItem value="302ai-flux-kontext-pro-i2i">
                          Flux kontext pro
                        </SelectItem>

                        <SelectItem value="kling-v2-i2i">Kling v2</SelectItem>
                        <SelectItem value="Seededit 3.0">
                          Seededit 3.0
                        </SelectItem>
                      </>
                    ) : (
                      <>
                        <SelectItem value="302ai-flux-kontext-max-t2i">
                          Flux kontext max
                        </SelectItem>
                        <SelectItem value="302ai-flux-kontext-pro-t2i">
                          Flux kontext pro
                        </SelectItem>
                        <SelectItem value="kling-v2-t2i">Kling v2</SelectItem>

                        <SelectItem value="higgsfield-t2i">Soul</SelectItem>
                        <SelectItem value="302ai-flux-v1.1-pro-t2i">
                          Flux v1.1 pro
                        </SelectItem>
                        <SelectItem value="doubao-v3-t2i">
                          Doubao 3.0
                        </SelectItem>
                        <SelectItem value="google-v4-preview-t2i">
                          Imagen-4-Preview
                        </SelectItem>
                      </>
                    )}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center justify-between">
                <Label className="text-sm">{t("avatar.size")}</Label>
                <Select value={aspectRatio} onValueChange={setAspectRatio}>
                  <SelectTrigger className="w-24 bg-transparent text-xs">
                    <SelectValue placeholder="9:16" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="9:16">9:16</SelectItem>
                    <SelectItem value="16:9">16:9</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center justify-between">
                <Label className="text-sm">{t("avatar.quantity")}</Label>
                <Input
                  type="number"
                  value={quantity}
                  onChange={(e) => setQuantity(Number(e.target.value))}
                  min="1"
                  max="10"
                  className="w-20"
                />
              </div>
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

      {/* 右侧图片展示栏 */}
      <div className="flex min-w-[450px] max-w-[500px] flex-[2] flex-col overflow-hidden border-l pl-6">
        <div className="mb-4">
          {/* <h3 className="text-lg font-semibold">
            {t("avatar.generatedImages")}
          </h3> */}
        </div>
        <div className="flex-1 overflow-y-auto">
          {generatedImages && generatedImages.length > 0 ? (
            <div className="grid grid-cols-2 gap-3 pb-4">
              {generatedImages.map((image, index) => (
                <div key={index} className="group relative rounded-lg border">
                  <div className="h-56 w-full overflow-hidden rounded-lg bg-gray-50">
                    <img
                      src={image.image_url}
                      alt={`生成的图片 ${index + 1}`}
                      className="h-full w-full object-contain"
                      onError={(e) => {
                        console.error(`图片加载失败: ${image.image_url}`);
                        e.currentTarget.style.display = "none";
                      }}
                    />
                  </div>

                  {/* 右上角按钮组 - 使用更高的 z-index */}
                  <div className="absolute right-1 top-1 z-20 flex gap-1 opacity-0 transition-opacity duration-300 group-hover:opacity-100">
                    <Button
                      size="sm"
                      variant="secondary"
                      className="h-6 w-6 rounded-md bg-white/90 p-0 hover:bg-white"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDownloadImage(
                          image.image_url,
                          `generated-${image.id}.png`
                        );
                      }}
                    >
                      <Download className="h-3 w-3 text-gray-700" />
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      className="h-6 w-6 rounded-md bg-white/90 p-0 hover:bg-white"
                      onClick={(e) => {
                        e.stopPropagation();
                        // 触发编辑事件，传递当前图片的生成数据
                        eventBus.emit("editImage", image);
                      }}
                    >
                      <SquarePen className="h-3 w-3 text-gray-700" />
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      className="h-6 w-6 rounded-md bg-red-500/90 p-0 hover:bg-red-500"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteImage(image.id);
                      }}
                    >
                      <Trash2 className="h-3 w-3 text-white" />
                    </Button>
                  </div>

                  {/* 悬停时显示的操作按钮 - 调整位置避免与右上角重叠，使用较低的 z-index */}
                  <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-black/60 opacity-0 transition-opacity duration-300 group-hover:opacity-100">
                    <div className="flex flex-col gap-1 p-2 pt-16">
                      <Button
                        size="sm"
                        variant="secondary"
                        className="w-full bg-white/90 text-xs text-gray-900 hover:bg-white"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleAddAsReference(image);
                        }}
                      >
                        {t("avatar.addAsReference")}
                      </Button>
                      <Button
                        size="sm"
                        variant="secondary"
                        className="w-full bg-white/90 text-xs text-gray-900 hover:bg-white"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleCreateAction(image);
                        }}
                      >
                        {t("avatar.generateAction")}
                      </Button>
                      <Button
                        size="sm"
                        variant="secondary"
                        className="w-full bg-white/90 text-xs text-gray-900 hover:bg-white"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSaveImage(image);
                        }}
                      >
                        {t("avatar.saveAsMaterial")}
                      </Button>
                      <Button
                        size="sm"
                        variant="secondary"
                        className="w-full bg-white/90 text-xs text-gray-900 hover:bg-white"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleCreateAvatar(image);
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
                <p>{t("avatar.noGeneratedImages")}</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 保存为图片素材弹框 */}
      <SaveAsMaterialModal
        isOpen={isSaveImageModalOpen}
        setIsOpen={setIsSaveImageModalOpen}
        selectedAvatarId={selectedAvatarId}
        setSelectedAvatarId={setSelectedAvatarId}
        title={t("avatar.saveAsMaterial")}
        onSave={handleSaveImageToAvatar}
      />

      {/* 创建数字人弹框 */}
      <CreateAvatarDialog
        open={isCreateAvatarDialogOpen}
        onOpenChange={setIsCreateAvatarDialogOpen}
        imageData={selectedImageForAvatar}
      />
    </div>
  );
};
