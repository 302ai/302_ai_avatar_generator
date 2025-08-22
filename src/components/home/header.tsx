"use client";

import AppLogo from "@/components/global/app-logo";
import { useIsHideBrand } from "@/hooks/global/use-is-hide-brand";
import { cn } from "@/lib/utils";
import { useTranslations } from "next-intl";

interface HomeHeaderProps {
  className?: string;
}

export default function HomeHeader({ className }: HomeHeaderProps) {
  const t = useTranslations();

  const isHideBrand = useIsHideBrand();

  return (
    <div className={cn("flex items-center justify-center gap-2", className)}>
      {isHideBrand ? null : <AppLogo size="mini" height={32} width={32} />}
      <h1 className="text-2xl font-bold">{t("home.header.title")}</h1>
    </div>
  );
}
