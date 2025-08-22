"use client";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { createConfigAtom } from "@/stores/slices/create_config";
import { useAtom } from "jotai";
import { Settings } from "lucide-react";
import { useTranslations } from "next-intl";

interface AdvancedSettingsProps {
  disabled?: boolean;
}

export const AdvancedSettings = ({
  disabled = false,
}: AdvancedSettingsProps) => {
  const [createConfig, setCreateConfig] = useAtom(createConfigAtom);
  const t = useTranslations();
  const handleResolutionChange = (value: "720p" | "540p") => {
    setCreateConfig({
      ...createConfig,
      hedraSettings: {
        ...createConfig.hedraSettings,
        videoResolution: value,
      },
    });
  };

  const handleDriveModeChange = (value: "" | "random") => {
    setCreateConfig({
      ...createConfig,
      chanjingSettings: {
        backway: 2,
        ...createConfig.chanjingSettings,
        driveMode: value,
      },
    });
  };

  const handleVideoLoopChange = (value: 1 | 2) => {
    console.log("value", value);
    setCreateConfig({
      ...createConfig,
      chanjingSettings: {
        driveMode: "",
        ...createConfig.chanjingSettings,
        backway: value,
      },
    });
  };

  // 只有当createType为hedra或chanjing时才显示高级设置
  if (
    !createConfig.createType ||
    (createConfig.createType !== "hedra" &&
      createConfig.createType !== "chanjing")
  ) {
    return null;
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          disabled={disabled}
          className="flex items-center gap-2"
        >
          <Settings className="h-4 w-4" />
          {t("create.advancedSettings")}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80">
        <div className="space-y-4">
          <div>
            <h4 className="mb-3 font-medium leading-none">
              {t("create.advancedSettings")}
            </h4>
            <div className="space-y-3">
              {/* hedra设置 */}
              {createConfig.createType === "hedra" && (
                <div className="flex items-center gap-4">
                  <Label className="text-sm font-medium">
                    {t("create.videoResolution")}
                  </Label>
                  <RadioGroup
                    value={
                      createConfig.hedraSettings?.videoResolution || "720p"
                    }
                    onValueChange={handleResolutionChange}
                    className="flex items-center gap-4"
                  >
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="720p" id="720p" />
                      <Label htmlFor="720p" className="text-sm">
                        720p
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="540p" id="540p" />
                      <Label htmlFor="540p" className="text-sm">
                        540p
                      </Label>
                    </div>
                  </RadioGroup>
                </div>
              )}

              {/* chanjing设置 */}
              {createConfig.createType === "chanjing" && (
                <>
                  <div className="flex items-center gap-4">
                    <Label className="text-sm font-medium">
                      {t("create.driveMode")}
                    </Label>
                    <RadioGroup
                      value={createConfig.chanjingSettings?.driveMode || ""}
                      onValueChange={handleDriveModeChange}
                      className="flex items-center gap-4"
                    >
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="" id="sequential" />
                        <Label htmlFor="sequential" className="text-sm">
                          {t("create.sequentialMode")}
                        </Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="random" id="random" />
                        <Label htmlFor="random" className="text-sm">
                          {t("create.randomMode")}
                        </Label>
                      </div>
                    </RadioGroup>
                  </div>

                  <div className="flex items-center gap-4">
                    <Label className="text-sm font-medium">
                      {t("create.videoLoop")}
                    </Label>
                    <RadioGroup
                      value={String(
                        createConfig.chanjingSettings?.backway || 2
                      )}
                      onValueChange={(value) =>
                        handleVideoLoopChange(Number(value) as 1 | 2)
                      }
                      className="flex items-center gap-4"
                    >
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="2" id="normal" />
                        <Label htmlFor="normal" className="text-sm">
                          {t("create.videoLoopDesc")}
                        </Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="1" id="reverse" />
                        <Label htmlFor="reverse" className="text-sm">
                          {t("create.videoLoopDesc2")}
                        </Label>
                      </div>
                    </RadioGroup>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
};
