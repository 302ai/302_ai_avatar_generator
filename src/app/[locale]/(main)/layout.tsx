"use client";
import React, { useEffect } from "react";
import {
  SidebarProvider,
  SidebarInset,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { AppSidebar } from "./app-sidebar";
import { Button } from "@/components/ui/button";
import { useAtom } from "jotai";
import { store } from "@/stores";
import { appConfigAtom } from "@/stores";
import { createVideoStoreAtom } from "@/stores/slices/create_video";
import { useHistoryDb } from "@/hooks/db/use-db";
import { createAvatar } from "@/services/create-avatar";
import { createAudio } from "@/services/create-audio";
import { genSpeech } from "@/services/gen-speech";
import { createVideo } from "@/services/gen-video";
import { useTranslations } from "next-intl";
import { useTTSProviders } from "@/hooks/use-tts-providers";
import HomeHeader from "@/components/home/header";
import AppFooter from "@/components/global/app-footer";
import AppHeader from "@/components/global/app-header";
import { WelcomeModal } from "./create/components/WelcomeModal";
import {
  welcomeModalStoreAtom,
  closeWelcomeModalAtom,
} from "@/stores/slices/welcome_modal";
import { useRouter, useParams } from "next/navigation";

const MainLayout = ({ children }: { children: React.ReactNode }) => {
  const [createVideoStore, setCreateVideoStore] = useAtom(createVideoStoreAtom);
  const { addHistoryData } = useHistoryDb();
  const t = useTranslations();
  const router = useRouter();
  const params = useParams();
  const { apiKey } = store.get(appConfigAtom);

  // Welcome Modal状态管理
  const [welcomeModalStore] = useAtom(welcomeModalStoreAtom);
  const [, closeWelcomeModal] = useAtom(closeWelcomeModalAtom);

  const handleWelcomeModalClose = (open: boolean) => {
    if (!open) {
      closeWelcomeModal();
    }
  };

  const handleWelcomeModalConfirm = () => {
    // 确认选择后跳转到创建页面（只有当前不在创建页面时才跳转）
    const currentPath = window.location.pathname;
    const locale = params.locale as string;
    const createPath: any = `/${locale}/create`;

    if (!currentPath.includes("/create")) {
      router.push(createPath);
    }
    // 如果已经在create页面，不需要跳转，让页面内部的useEffect处理视图切换
  };

  // 使用新的TTS providers hook

  useTTSProviders();

  useEffect(() => {
    // 如果videoList为空，则添加一个默认数据
    if (createVideoStore.videoList.length === 0) {
      setCreateVideoStore({
        videoList: [
          {
            id: crypto.randomUUID(),
            createdAt: Date.now(),
            platform: "Doubao",
            voice: "zh_male_beijingxiaoye_emo_v2_mars_bigtts",
            text: "",
            avatarImage:
              "https://file.302.ai/gpt/imgs/20250729/compressed_3b15118e228d40c180c1845c13d26995.jpeg",
            backgroundImage: "",
            videoUrl:
              "https://file.302.ai/gpt/imgs/20250729/b7bcad4155a94563b6586f90e80bc0b6.mp4",
            wavUrl: "",
            mode: "text",
            audioFile: "",
          },
        ],
      });
    }
  }, [createVideoStore, setCreateVideoStore]);

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <div className="flex h-screen flex-1 flex-col">
          <div className="flex items-center gap-2 border-b bg-background px-4 py-2 md:hidden">
            <SidebarTrigger />
            <HomeHeader className="mt-0 h-8" />
          </div>
          <div className="flex-1 overflow-auto">{children}</div>
          <AppFooter />
        </div>
      </SidebarInset>

      {/* WelcomeModal - 全局渲染 */}
      <WelcomeModal
        open={welcomeModalStore.isOpen}
        onOpenChange={handleWelcomeModalClose}
        onConfirm={handleWelcomeModalConfirm}
        presetData={welcomeModalStore.presetData}
      />
    </SidebarProvider>
  );
};

export default MainLayout;
