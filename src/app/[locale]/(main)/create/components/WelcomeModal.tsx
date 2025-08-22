"use client";

import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";
import { useAtom } from "jotai";
import { createConfigAtom } from "@/stores/slices/create_config";
import { createVideoStoreAtom } from "@/stores/slices/create_video";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

interface WelcomeModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm?: () => void;
  presetData?: {
    platform?: string;
    voice?: string;
    language?: string;
    avatarImage?: string;
    videoUrl?: string;
    googleModel?: string;
    source?: "voice" | "avatar";
    hasImageMaterials?: boolean;
    hasVideoMaterials?: boolean;
    azureLanguage?: string;
  };
}
const companies = [
  {
    id: "chanjing",
    name: "禅镜",
  },
  {
    id: "hedra",
    name: "Hedra",
  },
  {
    id: "Omnihuman",
    name: "OmniHuman",
  },
  {
    id: "TopView",
    name: "TopView",
  },
  {
    id: "stable",
    name: "StableAvatar",
  },
  {
    id: "latentsync",
    name: "Latentsync",
  },
];

const companyImageMap = {
  hedra: "/images/global/hedra.png",
  chanjing: "/images/global/蝉镜.png",
  Omnihuman: "/images/global/Omnihuman.png",
  TopView: "/images/global/topview.png",
  stable: "/images/global/Stable-Avatar.png",
  latentsync: "/images/global/latentsync.png",
};
export const WelcomeModal: React.FC<WelcomeModalProps> = ({
  open,
  onOpenChange,
  onConfirm,
  presetData,
}) => {
  const [createConfig, setCreateConfig] = useAtom(createConfigAtom);
  const [createVideoStore, setCreateVideoStore] = useAtom(createVideoStoreAtom);
  const t = useTranslations();

  // 检查是否可以选择某个公司
  const canSelectCompany = (companyId: string) => {
    if (presetData?.source !== "avatar") {
      return true; // 非数字人来源的情况下都可以选择
    }

    const companyRequirements = {
      hedra: "hasImageMaterials",
      chanjing: "hasVideoMaterials",
      Omnihuman: "hasImageMaterials",
      TopView: "hasVideoMaterials",
      latentsync: "hasVideoMaterials",
    };

    const requirement =
      companyRequirements[companyId as keyof typeof companyRequirements];
    if (requirement) {
      return presetData?.[requirement as keyof typeof presetData] === true;
    }

    return true;
  };

  // 处理公司选择点击
  const handleCompanyClick = (companyId: string) => {
    console.log(
      "🎯 Company clicked:",
      companyId,
      "with presetData:",
      presetData
    );

    if (!canSelectCompany(companyId)) {
      const errorMessages = {
        hedra: "当前数字人缺少图片素材，无法使用 Hedra 创建作品",
        chanjing: "当前数字人缺少视频素材，无法使用蝉镜创建作品",
        Omnihuman: "当前数字人缺少图片素材，无法使用 Omnihuman 创建作品",
        TopView: "当前数字人缺少视频素材，无法使用 Topview 创建作品",
        stable: "当前数字人缺少视频素材，无法使用 stable 创建作品",
        latentsync: "当前数字人缺少视频素材，无法使用 Latentsync 创建作品",
      };

      const errorMessage =
        errorMessages[companyId as keyof typeof errorMessages];
      if (errorMessage) {
        toast.error(errorMessage);
      }
      return;
    }

    console.log("✅ Company can be selected, proceeding...");

    // 清空视频存储中的所有数据
    setCreateVideoStore({
      videoList: [],
    });

    // 重置创建配置，保留预设数据
    setCreateConfig({
      createType: companyId as
        | "hedra"
        | "chanjing"
        | "Omnihuman"
        | "TopView"
        | "stable"
        | "latentsync",
      resolution: "16:9",
      hedraSettings: {
        videoResolution: "720p",
      },
      chanjingSettings: {
        driveMode: "",
        backway: 2,
      },
    });

    console.log("📝 Set createType to:", companyId);

    // 如果有预设数据，需要创建初始的视频数据项
    if (presetData) {
      console.log("📋 Creating video data with preset:", presetData);

      const initialVideoData = {
        id: Date.now().toString(),
        createdAt: Date.now(),
        platform: presetData.platform || "",
        voice: presetData.voice || "",
        text: "",
        avatarImage: presetData.avatarImage || "",
        backgroundImage: "",
        videoUrl: presetData.videoUrl || "",
        wavUrl: "",
        mode: "text" as const,
        audioFile: "",
        googleModel: presetData.googleModel as
          | "Gemini Flash"
          | "Gemini Pro"
          | undefined,
        azureLanguage: presetData.azureLanguage || "",
      };

      setCreateVideoStore({
        videoList: [initialVideoData],
      });
    }

    console.log("🚪 Closing modal and calling onConfirm");
    onOpenChange(false);
    onConfirm?.();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-full max-w-5xl rounded-3xl p-6 [&>button]:hidden">
        <DialogHeader className="relative">
          <DialogTitle className="text-left text-lg font-medium">
            {t("create.createWork")}
          </DialogTitle>
          <button
            onClick={() => onOpenChange(false)}
            className="absolute right-0 top-0 rounded-full p-1 hover:bg-gray-100"
          >
            <X className="h-4 w-4" />
          </button>
        </DialogHeader>

        <div className="mt-6">
          <div className="mb-8 flex gap-4">
            {companies.map((company) => {
              const canSelect = canSelectCompany(company.id);
              const isDisabled = !canSelect;

              return (
                <div
                  key={company.id}
                  className={`flex-1 rounded-2xl border-2 p-6 transition-all duration-200 ${
                    isDisabled
                      ? "cursor-not-allowed border-gray-200 bg-gray-50 opacity-50"
                      : "cursor-pointer border-gray-200 hover:border-primary hover:bg-primary/5 hover:shadow-md"
                  }`}
                  onClick={() => handleCompanyClick(company.id)}
                >
                  <div className="flex flex-col items-center">
                    <img
                      src={
                        companyImageMap[
                          company.id as keyof typeof companyImageMap
                        ]
                      }
                      alt={company.name}
                      className="h-12 w-12 rounded-lg bg-white object-contain"
                    />
                    <span
                      className={`mt-2 text-sm font-medium transition-colors ${
                        isDisabled
                          ? "text-gray-400"
                          : "text-gray-700 group-hover:text-primary"
                      }`}
                    >
                      {company.name}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
