import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";

interface AIGenerateBackgroundModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onGenerate: (prompt: string, resolution: "9:16" | "16:9") => Promise<void>;
  isGenerating?: boolean;
}

const AIGenerateBackgroundModal: React.FC<AIGenerateBackgroundModalProps> = ({
  open,
  onOpenChange,
  onGenerate,
  isGenerating = false,
}) => {
  const [prompt, setPrompt] = useState("");
  const [resolution, setResolution] = useState<"9:16" | "16:9">("16:9");
  const t = useTranslations();
  const handleGenerate = async () => {
    if (!prompt.trim()) {
      return;
    }

    try {
      await onGenerate(prompt.trim(), resolution);
      // 生成成功后关闭弹框并重置状态
      setPrompt("");
      setResolution("16:9");
      onOpenChange(false);
    } catch (error) {
      console.error("AI生成背景失败:", error);
    }
  };

  const handleCancel = () => {
    // 取消时重置状态
    setPrompt("");
    setResolution("16:9");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-lg font-medium">
            {t("create.aiGenerateBackground")}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* 背景提示词 */}
          <div className="space-y-2">
            <Label htmlFor="background-prompt" className="text-sm font-medium">
              {t("create.backgroundPromptTitle")}
            </Label>
            <Textarea
              id="background-prompt"
              placeholder={t("create.backgroundPrompt")}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              className="min-h-[100px] resize-none"
              disabled={isGenerating}
            />
          </div>

          {/* 分辨率选择 */}
          <div className="space-y-2">
            <Label htmlFor="resolution" className="text-sm font-medium">
              {t("create.resolution")}
            </Label>
            <Select
              value={resolution}
              onValueChange={(value: "9:16" | "16:9") => setResolution(value)}
              disabled={isGenerating}
            >
              <SelectTrigger id="resolution">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="16:9">16:9</SelectItem>
                <SelectItem value="9:16">9:16</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter className="flex gap-2">
          <Button
            variant="outline"
            onClick={handleCancel}
            disabled={isGenerating}
          >
            {t("create.cancel")}
          </Button>
          <Button
            onClick={handleGenerate}
            disabled={!prompt.trim() || isGenerating}
          >
            {isGenerating ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {t("create.generating")}
              </>
            ) : (
              t("create.generate")
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default AIGenerateBackgroundModal;
