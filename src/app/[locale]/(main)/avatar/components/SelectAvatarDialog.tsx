"use client";

import React, { useState, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { CirclePlus, Plus, User } from "lucide-react";
import { useAtom } from "jotai";
import { genImageAtom } from "@/stores/slices/gen_image_store";
import { useAvatarDb } from "@/hooks/db/use-avatar-db";
import { uploadVideo } from "@/services/upload-video";
import { appConfigAtom, store } from "@/stores";
import { toast } from "sonner";
import { eventBus } from "@/utils/eventBus";

interface SelectAvatarDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAvatarSelected: (avatar: any) => void;
}

export const SelectAvatarDialog: React.FC<SelectAvatarDialogProps> = ({
  open,
  onOpenChange,
  onAvatarSelected,
}) => {
  const [selectedAvatar, setSelectedAvatar] = useState<any>(null);
  const [selectedType, setSelectedType] = useState<"upload" | "created" | null>(
    null
  );
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadedImage, setUploadedImage] = useState<File | null>(null);
  const [uploadedImageUrl, setUploadedImageUrl] = useState<string>("");
  const [isUploading, setIsUploading] = useState(false);
  const [genImage] = useAtom(genImageAtom);
  const { avatarData } = useAvatarDb();
  const { apiKey } = store.get(appConfigAtom);

  const handleImageUpload = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];
    if (file) {
      setIsUploading(true);
      try {
        // 上传文件
        const uploadResult = await uploadVideo({
          apiKey: apiKey!,
          file: file,
        });

        setUploadedImage(file);
        setUploadedImageUrl(uploadResult.data);
        setSelectedAvatar({
          type: "upload",
          file: file,
          preview: URL.createObjectURL(file),
          uploadUrl: uploadResult.data,
        });
        setSelectedType("upload");
        // toast.success("图片上传成功");
      } catch (error) {
        console.error("上传失败:", error);
        toast.error("图片上传失败，请重试");
      } finally {
        setIsUploading(false);
      }
    }
  };

  const handleCreatedAvatarSelect = (avatar: any) => {
    setSelectedAvatar({
      type: "created",
      data: avatar,
    });
    setSelectedType("created");
  };

  const handleConfirm = () => {
    if (selectedAvatar) {
      onAvatarSelected(selectedAvatar);
      onOpenChange(false);
    }
  };

  const handleCancel = () => {
    setSelectedAvatar(null);
    setSelectedType(null);
    setUploadedImage(null);
    setUploadedImageUrl("");
    onOpenChange(false);
  };

  const handleCreateAvatarClick = () => {
    eventBus.emit("navigateToAppearanceTab");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl overflow-hidden p-0">
        <DialogHeader className="border-b px-6 py-4">
          <DialogTitle className="text-lg font-medium">选择人像</DialogTitle>
        </DialogHeader>

        <div className="p-6">
          {uploadedImage ? (
            // 上传后显示全屏图片
            <div className="mb-6">
              <div className="flex flex-col items-center">
                <div className="relative mb-4">
                  <img
                    src={URL.createObjectURL(uploadedImage)}
                    alt="上传的图片"
                    className="max-h-96 w-full rounded-lg object-contain"
                  />
                </div>
              </div>
            </div>
          ) : (
            // 未上传时显示选择界面
            <div className="mb-6 grid grid-cols-2 gap-6">
              {/* Local Upload Section */}
              <div className="relative">
                <div
                  className="flex min-h-[200px] cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed p-12 transition-colors hover:border-primary/50"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full border-2">
                    <Plus className="h-6 w-6" />
                  </div>
                  <span className="text-sm">
                    {isUploading ? "上传中..." : "本地上传"}
                  </span>
                </div>
                <input
                  type="file"
                  ref={fileInputRef}
                  accept="image/*"
                  onChange={handleImageUpload}
                  className="hidden"
                  disabled={isUploading}
                />
              </div>

              {/* Create Digital Avatar Section */}
              <div className="relative">
                <div
                  className="flex min-h-[200px] cursor-pointer flex-col items-center justify-center rounded-2xl border p-12 transition-colors hover:border-primary/50"
                  onClick={handleCreateAvatarClick}
                >
                  <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full border-2">
                    <Plus className="h-6 w-6" />
                  </div>
                  <span className="text-sm">创建数字人形象</span>
                </div>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex justify-end gap-3">
            <Button
              variant="outline"
              onClick={handleCancel}
              className="bg-transparent px-6"
            >
              取消
            </Button>
            <Button
              onClick={handleConfirm}
              className="px-6"
              disabled={isUploading || !selectedAvatar}
            >
              确定
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
