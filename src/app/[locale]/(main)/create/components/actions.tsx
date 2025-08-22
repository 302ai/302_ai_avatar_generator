import { Button } from "@/components/ui/button";
import { CirclePlus, Copy, Trash2, AudioLines, Type } from "lucide-react";
import React, { useCallback } from "react";
import { CreateData } from "@/db/types";
import { useAtom } from "jotai";
import { createVideoStoreAtom } from "@/stores/slices/create_video";
import { useTranslations } from "next-intl";

interface ActionsProps {
  currentItem: CreateData;
}

const Actions: React.FC<ActionsProps> = ({ currentItem }) => {
  const [createVideoStore, setCreateVideoStore] = useAtom(createVideoStoreAtom);
  const t = useTranslations();
  // CirclePlus点击：新增一个项目，只取原来item的视频、图片和背景
  const handleAddNew = useCallback(() => {
    const newItem: CreateData = {
      id: crypto.randomUUID(),
      createdAt: Date.now(),
      platform: currentItem.platform,
      voice: currentItem.voice,
      text: "", // 新增时文本为空
      avatarImage: currentItem.avatarImage,
      backgroundImage: currentItem.backgroundImage,
      videoUrl: currentItem.videoUrl,
      wavUrl: currentItem.wavUrl,
      mode: "text",
      audioFile: "",
    };

    setCreateVideoStore((prevStore) => ({
      ...prevStore,
      videoList: [...prevStore.videoList, newItem],
    }));
  }, [currentItem, setCreateVideoStore]);

  // Copy点击：复制当前项目的所有内容
  const handleCopy = useCallback(() => {
    const copiedItem: CreateData = {
      ...currentItem,
      id: crypto.randomUUID(),
      createdAt: Date.now(),
    };

    setCreateVideoStore((prevStore) => ({
      ...prevStore,
      videoList: [...prevStore.videoList, copiedItem],
    }));
  }, [currentItem, setCreateVideoStore]);

  // Delete点击：删除当前项目
  const handleDelete = useCallback(() => {
    setCreateVideoStore((prevStore) => {
      // 防止删除最后一个项目
      if (prevStore.videoList.length <= 1) {
        return prevStore;
      }

      return {
        ...prevStore,
        videoList: prevStore.videoList.filter(
          (item) => item.id !== currentItem.id
        ),
      };
    });
  }, [currentItem.id, setCreateVideoStore]);

  // 设置模式：直接设置为指定的模式
  const handleSetMode = useCallback(
    (newMode: "text" | "audio") => {
      setCreateVideoStore((prevStore) => ({
        ...prevStore,
        videoList: prevStore.videoList.map((item) =>
          item.id === currentItem.id ? { ...item, mode: newMode } : item
        ),
      }));
    },
    [currentItem.id, setCreateVideoStore]
  );

  return (
    <div className="mb-2 flex items-center justify-between">
      <div className="flex items-center gap-x-2">
        <div className="flex rounded-lg border p-1">
          <button
            className={`flex items-center rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              currentItem.mode === "text"
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
            onClick={() => handleSetMode("text")}
          >
            {t("create.textDrive")}
          </button>
          <button
            className={`flex items-center rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              currentItem.mode === "audio"
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
            onClick={() => handleSetMode("audio")}
          >
            {t("create.audioDrive")}
          </button>
        </div>
      </div>

      <div className="flex items-center gap-x-4">
        <Button
          variant="ghost"
          size="icon"
          className="size-8"
          onClick={handleAddNew}
        >
          <CirclePlus />
        </Button>

        <Button
          variant="ghost"
          size="icon"
          className="size-8"
          onClick={handleDelete}
          disabled={createVideoStore.videoList.length <= 1}
        >
          <Trash2 />
        </Button>
      </div>
    </div>
  );
};

export default React.memo(Actions);
