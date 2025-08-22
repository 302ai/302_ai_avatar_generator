import type * as React from "react";
import Link from "next/link";
import { useParams, usePathname, useRouter } from "next/navigation";
import { Youtube, User, Mic, FolderKanban } from "lucide-react";
import { useAtom } from "jotai";

import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { useTranslations } from "next-intl";
import Image from "next/image";
import { openWelcomeModalAtom } from "@/stores/slices/welcome_modal";
import { useDomain } from "@/hooks/global/use-domain";

const navigationItems = [
  {
    title: "创建作品",
    value: "create",
    icon: Youtube,
    url: "/create",
  },
  {
    title: "数字人像",
    value: "avatar",
    icon: User,
    url: "/avatar",
  },
  {
    title: "声音克隆",
    value: "voice",
    icon: Mic,
    url: "/voice",
  },
  // {
  //   title: "作品管理",
  //   value: "history",
  //   icon: FolderKanban,
  //   url: "/history",
  // },
];

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const params = useParams();
  const pathname = usePathname();
  const router = useRouter();
  const locale = params.locale as string;
  const t = useTranslations();
  const domain = useDomain();

  // 使用store管理弹框状态
  const [, openWelcomeModal] = useAtom(openWelcomeModalAtom);

  const handleCreateClick = (e: React.MouseEvent) => {
    e.preventDefault();
    openWelcomeModal();
  };
  return (
    <Sidebar className="">
      <SidebarHeader className="border-b p-4">
        <SidebarMenu>
          <SidebarMenuItem className="">
            <SidebarMenuButton size="lg" className="cursor-default">
              <div className="flex items-center justify-center gap-3">
                <div className="flex aspect-square size-10 items-center justify-center rounded-lg">
                  <a href={domain} target="_blank" rel="noreferrer">
                    <Image
                      alt="ai-302"
                      priority
                      src="/images/global/logo-mini.png"
                      width={30}
                      height={30}
                    />
                  </a>
                </div>
                <div className="flex flex-col gap-0.5 leading-none">
                  <span className="text-lg font-semibold">
                    {t("home.header.title")}
                  </span>
                </div>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent className="px-2 pt-2">
        <SidebarMenu>
          {navigationItems.map((item) => {
            const isActive =
              pathname === `/${locale}${item.url}` ||
              pathname.startsWith(`/${locale}${item.url}/`);
            const isCreateItem = item.value === "create";

            return (
              <SidebarMenuItem key={item.title}>
                <SidebarMenuButton
                  asChild
                  isActive={isActive}
                  className="w-full justify-start gap-3 px-6 py-6 text-base"
                >
                  <Link
                    href={`/${locale}${item.url}` as any}
                    className="flex items-center justify-start gap-3"
                  >
                    <item.icon className="h-6 w-6" />
                    <span>{t(`sideBar.${item.value}`)}</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            );
          })}
        </SidebarMenu>
      </SidebarContent>
    </Sidebar>
  );
}
