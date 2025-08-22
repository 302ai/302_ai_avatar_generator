"use client";

import React from "react";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Avatar } from "@/db/types";
import { Button } from "@/components/ui/button";
import { useTranslations } from "next-intl";
import { X } from "lucide-react";
import { useAvatarDb } from "@/hooks/db/use-avatar-db";
import { toast } from "sonner";
import { useAtom } from "jotai";
import { createVideoStoreAtom } from "@/stores/slices/create_video";
import { openWelcomeModalAtom } from "@/stores/slices/welcome_modal";

interface AvatarCardProps {
  avatar: Avatar;
  onClick?: (avatar: Avatar) => void;
}

export const AvatarCard: React.FC<AvatarCardProps> = ({ avatar, onClick }) => {
  const t = useTranslations();
  const { deleteAvatarData } = useAvatarDb();
  const [, setCreateVideoStore] = useAtom(createVideoStoreAtom);
  const [, openWelcomeModal] = useAtom(openWelcomeModalAtom);

  const handleClick = () => {
    if (onClick) {
      onClick(avatar);
    }
  };

  const handleDeleteAvatar = async (e: React.MouseEvent) => {
    e.stopPropagation(); // 阻止触发卡片点击事件

    try {
      await deleteAvatarData(avatar.id);
      toast.success(t("avatar.deleteSuccess"));
    } catch (error) {
      console.error("删除失败:", error);
      toast.error(t("avatar.deleteFail"));
    }
  };

  // 处理去创作
  const handleGoToCreate = (e: React.MouseEvent) => {
    e.stopPropagation(); // 阻止触发卡片点击事件

    // 获取第一张图片作为avatarImage
    const avatarImage = getFirstImageUrl(avatar.pic_url) || "";
    const videoUrl =
      avatar.videoUrl && avatar.videoUrl.length > 0 ? avatar.videoUrl[0] : "";

    // 检查素材情况
    const hasImageMaterials = !!(
      avatar.pic_url &&
      ((Array.isArray(avatar.pic_url) && avatar.pic_url.length > 0) ||
        (typeof avatar.pic_url === "string" && avatar.pic_url))
    );

    const hasVideoMaterials = !!(avatar.videoUrl && avatar.videoUrl.length > 0);

    // 更新create store，回填数字人信息
    setCreateVideoStore((prevStore: any) => ({
      ...prevStore,
      videoList: prevStore.videoList.map((item: any, index: any) =>
        index === 0
          ? {
              ...item,
              avatarImage: avatarImage,
              platform: avatar.platform || "",
              voice: avatar.voice || "",
              videoUrl: videoUrl,
              ...(avatar.googleModel && { googleModel: avatar.googleModel }),
            }
          : item
      ),
    }));
    console.log("asd", avatar.voice);
    let language = "";
    if (avatar.voice) {
      language = avatar.voice?.split("-")[0];
    }

    // 打开welcome弹框，传递预设数据和素材检查信息
    const presetData: any = {
      platform: avatar.platform || "",
      voice: avatar.voice || "",
      avatarImage: avatarImage,
      azureLanguage: language || "",
      videoUrl: videoUrl,
      source: "avatar", // 标识来源为数字人
      hasImageMaterials: hasImageMaterials,
      hasVideoMaterials: hasVideoMaterials,
      ...(avatar.googleModel && { googleModel: avatar.googleModel }),
    };

    openWelcomeModal(presetData);
  };

  // 处理pic_url数组，取第一个URL
  const getFirstImageUrl = (urls: string[] | string): string => {
    if (!urls) return "";
    if (Array.isArray(urls)) {
      return urls.length > 0 ? urls[0] : "";
    }
    return urls;
  };

  return (
    <Card
      className="group relative flex h-64 cursor-pointer flex-col overflow-hidden transition-all duration-300 hover:shadow-lg hover:shadow-primary/10"
      onClick={handleClick}
    >
      {/* 删除按钮 */}
      <button
        onClick={handleDeleteAvatar}
        className="absolute right-2 top-2 z-20 flex h-6 w-6 items-center justify-center rounded-full bg-red-500 text-white opacity-0 shadow-md transition-all duration-200 hover:bg-red-600 group-hover:opacity-100"
      >
        <X className="h-3 w-3" />
      </button>
      <CardContent className="relative h-48 flex-shrink-0 p-0">
        <div className="h-full w-full overflow-hidden">
          {avatar.pic_url ? (
            <img
              src={getFirstImageUrl(avatar.pic_url)}
              className="h-full w-full object-contain transition-transform duration-300 group-hover:scale-105"
              alt={avatar.name || "数字人头像"}
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-gray-100 via-gray-50 to-gray-100 text-gray-400">
              <div className="text-center transition-transform duration-300 group-hover:scale-110">
                <div className="text-xs font-medium">{t("avatar.noVideo")}</div>
              </div>
            </div>
          )}
        </div>
      </CardContent>
      <CardFooter className="relative z-10 flex h-16 flex-shrink-0 items-center justify-between p-3 pt-2">
        <h1 className="truncate text-sm text-gray-900 transition-colors duration-200 group-hover:text-primary">
          {avatar.name || t("avatar.noName")}
        </h1>
        <Button size="sm" onClick={handleGoToCreate}>
          {t("avatar.goToCreate")}
        </Button>
      </CardFooter>
    </Card>
  );
};
