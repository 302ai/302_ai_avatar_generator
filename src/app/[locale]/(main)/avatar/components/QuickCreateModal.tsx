"use client";

import React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useTranslations } from "next-intl";

interface QuickCreateModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreateTypeSelect: (type: "custom" | "text-gen") => void;
}

export const QuickCreateModal: React.FC<QuickCreateModalProps> = ({
  open,
  onOpenChange,
  onCreateTypeSelect,
}) => {
  const t = useTranslations();
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>{t("avatar.modeSelect")}</DialogTitle>
        </DialogHeader>

        <div className="mt-4 flex flex-col gap-y-2">
          <Card
            className="cursor-pointer transition-shadow hover:shadow-md"
            onClick={() => onCreateTypeSelect("custom")}
          >
            <CardHeader className="pb-3">
              <div className="flex items-center gap-4">
                <img
                  src="https://file.302.ai/gpt/imgs/20250805/ef3b39da3ca14aacb666f9e32d085a3b.jpg"
                  alt="定制数字人"
                  className="h-12 w-12 flex-shrink-0 rounded-lg object-cover"
                />
                <div className="flex-1">
                  <CardTitle className="text-lg">
                    {t("avatar.customAvatar")}
                  </CardTitle>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {t("avatar.customAvatarDesc")}
                  </p>
                </div>
              </div>
            </CardHeader>
          </Card>

          <Card
            className="cursor-pointer transition-shadow hover:shadow-md"
            onClick={() => onCreateTypeSelect("text-gen")}
          >
            <CardHeader className="pb-3">
              <div className="flex items-center gap-4">
                <img
                  src="https://file.302.ai/gpt/imgs/20250805/5832801f7ff142f6b61786ebf8907d89.jpg"
                  alt="文生数字人"
                  className="h-12 w-12 flex-shrink-0 rounded-lg object-cover"
                />
                <div className="flex-1">
                  <CardTitle className="text-lg">
                    {t("avatar.textGenAvatar")}
                  </CardTitle>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {t("avatar.textGenAvatarDesc")}
                  </p>
                </div>
              </div>
            </CardHeader>
          </Card>
        </div>
      </DialogContent>
    </Dialog>
  );
};
