"use client";

import React, { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CirclePlus, Plus } from "lucide-react";
import { QuickCreateModal } from "./components/QuickCreateModal";
import { AvatarSidebar } from "./components/AvatarSidebar";
import { AvatarCard } from "./components/AvatarCard";
import { useAvatarDb } from "@/hooks/db/use-avatar-db";
import { Avatar } from "@/db/types";
import { useTranslations } from "next-intl";
import { eventBus } from "@/utils/eventBus";

const AvatarPage = () => {
  const router = useRouter();
  const params = useParams();
  const locale = params.locale as string;
  const [isQuickCreateModalOpen, setIsQuickCreateModalOpen] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [sidebarType, setSidebarType] = useState<"custom" | "text-gen">(
    "custom"
  );
  const t = useTranslations();
  // 获取Avatar数据
  const { avatarData } = useAvatarDb();

  const handleQuickCreateClick = () => {
    setIsQuickCreateModalOpen(true);
  };

  const handleCreateTypeSelect = (type: "custom" | "text-gen") => {
    setSidebarType(type);
    setIsQuickCreateModalOpen(false);
    setIsSidebarOpen(true);
  };

  const handleAvatarClick = (avatar: Avatar) => {
    router.push(`/${locale}/avatar/${avatar.id}`);
  };

  // 监听导航到创建形象tab的事件
  useEffect(() => {
    const handleNavigateToAppearanceTab = () => {
      setSidebarType("text-gen");
      setIsSidebarOpen(true);
    };

    eventBus.on("navigateToAppearanceTab", handleNavigateToAppearanceTab);

    return () => {
      eventBus.off("navigateToAppearanceTab", handleNavigateToAppearanceTab);
    };
  }, []);

  return (
    <div className="relative min-h-full">
      <div className="p-4 sm:p-6">
        <h1 className="mb-6 text-2xl font-bold sm:text-xl">
          {t("avatar.myAvatar")}
        </h1>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
          {/* 快速创建数字人卡片 */}
          <Card
            className="flex h-64 cursor-pointer items-center justify-center border-2 border-dashed transition-all duration-300 hover:border-primary/50 hover:bg-primary/5"
            onClick={handleQuickCreateClick}
          >
            <CardContent className="flex flex-col items-center">
              <div className="flex h-10 w-10 items-center justify-center">
                <CirclePlus className="size-6" />
              </div>
              {t("avatar.quickCreate")}
            </CardContent>
          </Card>

          {/* 展示已创建的Avatar */}
          {avatarData?.map((avatar) => (
            <AvatarCard
              key={avatar.id}
              avatar={avatar}
              onClick={handleAvatarClick}
            />
          ))}
        </div>
      </div>

      {/* 快速创建弹框 */}
      <QuickCreateModal
        open={isQuickCreateModalOpen}
        onOpenChange={setIsQuickCreateModalOpen}
        onCreateTypeSelect={handleCreateTypeSelect}
      />

      {/* 右侧栏 */}
      <AvatarSidebar
        open={isSidebarOpen}
        onOpenChange={setIsSidebarOpen}
        type={sidebarType}
      />
    </div>
  );
};

export default AvatarPage;
