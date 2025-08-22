"use client";
import { useState } from "react";
import { Volume2, Play, Pause, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useFavoriteVoice } from "@/hooks/db/use-favorite-voice";
import { useAtom } from "jotai";
import { voiceStoreAtom } from "@/stores/slices/voice_store";
import { useTranslations } from "next-intl";

const FavoriteVoices = () => {
  const [playingVoiceId, setPlayingVoiceId] = useState<string | null>(null);
  const { favoriteVoices, removeFromFavorites } = useFavoriteVoice();
  const [voiceStore] = useAtom(voiceStoreAtom);
  const t = useTranslations();

  // 处理音频播放
  const handlePlayVoice = (voiceId: string, audioUrl: string) => {
    if (playingVoiceId === voiceId) {
      const audio = document.getElementById(
        `favorite-audio-${voiceId}`
      ) as HTMLAudioElement;
      audio?.pause();
      setPlayingVoiceId(null);
    } else {
      // 先暂停所有正在播放的音频
      if (playingVoiceId) {
        const currentAudio = document.getElementById(
          `favorite-audio-${playingVoiceId}`
        ) as HTMLAudioElement;
        currentAudio?.pause();
      }

      // 播放新的音频
      const audio = document.getElementById(
        `favorite-audio-${voiceId}`
      ) as HTMLAudioElement;
      if (audio) {
        audio.play();
        setPlayingVoiceId(voiceId);

        audio.onended = () => {
          setPlayingVoiceId(null);
        };
      }
    }
  };

  // 获取声音的音频URL
  const getVoiceAudioUrl = (
    voiceKey: string,
    voiceValue: string,
    groupKey: string
  ) => {
    // 从voiceStore中查找对应的声音数据
    const group = voiceStore.voiceList.find((g) => g.key === groupKey);
    if (!group) return undefined;

    const findVoiceInGroup = (children: any[]): any => {
      for (const child of children) {
        if ("children" in child) {
          const result = findVoiceInGroup(child.children);
          if (result) return result;
        } else if (
          child.key === voiceKey &&
          child.value === voiceValue &&
          child.originData
        ) {
          return child.originData;
        }
      }
      return null;
    };

    const originData = findVoiceInGroup(group.children);
    if (!originData || !("sample" in originData)) return undefined;

    if (Array.isArray(originData.sample)) {
      return originData.sample[0];
    } else if (typeof originData.sample === "object") {
      return Object.values(originData.sample)[0];
    }
    return undefined;
  };

  // 根据性别获取头像
  const getVoiceImage = (gender?: string) => {
    if (gender === "female") {
      return "https://file.302.ai/gpt/imgs/20250723/compressed_46d00fbe6fb54a81bf860bb4f910e38e.jpeg";
    } else if (gender === "male") {
      return "https://file.302.ai/gpt/imgs/20250723/compressed_e479e8fa4af9488aa095c27cb078b462.jpeg";
    } else {
      return "https://file.302.ai/gpt/imgs/20250723/compressed_066bd9011dda4583beba98f53417b7c1.jpeg";
    }
  };

  // 处理取消收藏
  const handleRemoveFavorite = async (voiceKey: string, voiceValue: string) => {
    // 如果正在播放这个声音，先停止播放
    const voiceId = `${voiceKey}-${voiceValue}`;
    if (playingVoiceId === voiceId) {
      const audio = document.getElementById(
        `favorite-audio-${voiceId}`
      ) as HTMLAudioElement;
      audio?.pause();
      setPlayingVoiceId(null);
    }
    await removeFromFavorites(voiceKey, voiceValue);
  };

  if (!favoriteVoices) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="text-muted-foreground">加载中...</div>
        </div>
      </div>
    );
  }

  if (favoriteVoices.length === 0) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <Star className="mx-auto h-12 w-12 text-muted-foreground" />
          <h3 className="mt-4 text-lg font-medium">{t("voice.noFavorite")}</h3>
          <p className="mt-2 text-sm text-muted-foreground">
            {t("voice.goToVoiceLibrary")}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* 我的收藏区域 */}
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold">{t("voice.myFavorite")}</h2>
          {/* <div className="text-sm text-muted-foreground">
            {favoriteVoices.length} 个收藏
          </div> */}
        </div>

        {/* 收藏声音卡片网格 */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {favoriteVoices.map((favorite) => {
            const voiceId = `${favorite.voiceKey}-${favorite.voiceValue}`;
            const audioUrl = getVoiceAudioUrl(
              favorite.voiceKey,
              favorite.voiceValue,
              favorite.groupKey
            );

            return (
              <div
                key={`${favorite.voiceKey}-${favorite.voiceValue}-${favorite.id}`}
                className="group relative flex min-h-[100px] flex-row items-center gap-3 rounded-lg border p-4 transition-shadow hover:shadow-sm"
              >
                {/* 左侧：声音图标（可点击播放） */}
                <button
                  className="relative flex h-12 w-12 flex-shrink-0 items-center justify-center overflow-hidden rounded-full transition-all hover:scale-105 disabled:cursor-not-allowed disabled:opacity-50"
                  onClick={() => audioUrl && handlePlayVoice(voiceId, audioUrl)}
                  disabled={!audioUrl}
                >
                  <img
                    src={getVoiceImage(favorite.voiceGender)}
                    alt="声音图标"
                    className="h-full w-full object-cover"
                  />
                  {/* 播放状态覆盖层 - 悬浮时显示 */}
                  <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-40 opacity-0 transition-opacity hover:opacity-100">
                    {audioUrl ? (
                      playingVoiceId === voiceId ? (
                        <Pause className="h-6 w-6 text-white" />
                      ) : (
                        <Play className="ml-0.5 h-6 w-6 text-white" />
                      )
                    ) : (
                      <Volume2 className="h-6 w-6 text-white" />
                    )}
                  </div>
                </button>

                {/* 中间：声音信息 */}
                <div className="min-w-0 flex-1">
                  <div className="truncate text-lg font-medium">
                    {favorite.voiceName}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    <span className="text-xs text-gray-500">
                      {favorite.groupKey}
                    </span>
                    {favorite.voiceGender && (
                      <>
                        {" · "}
                        <span className="capitalize">
                          {favorite.voiceGender === "male"
                            ? t("voice.voiceClone.male")
                            : favorite.voiceGender === "female"
                              ? t("voice.voiceClone.female")
                              : favorite.voiceGender}
                        </span>
                      </>
                    )}
                  </div>
                </div>

                {/* 右侧：取消收藏和去创作按钮 */}
                <div className="flex flex-shrink-0 items-center gap-2">
                  {/* 取消收藏按钮 */}
                  <button
                    onClick={() =>
                      handleRemoveFavorite(
                        favorite.voiceKey,
                        favorite.voiceValue
                      )
                    }
                    className="flex h-8 w-8 items-center justify-center rounded-full transition-colors hover:bg-red-50"
                    title="取消收藏"
                  >
                    <Star className="h-4 w-4 fill-yellow-400 text-yellow-400 transition-colors hover:fill-red-400 hover:text-red-400" />
                  </button>

                  {/* 去创作按钮 */}
                  {/* <Button
                    size="sm"
                    variant="outline"
                    className="h-8 px-3 text-xs"
                    onClick={() => {
                      console.log("去创作:", favorite);
                    }}
                  >
                    去创作
                  </Button> */}
                </div>

                {/* 隐藏的音频元素 */}
                {audioUrl && (
                  <audio
                    id={`favorite-audio-${voiceId}`}
                    preload="none"
                    className="hidden"
                  >
                    <source src={audioUrl} type="audio/mpeg" />
                  </audio>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default FavoriteVoices;
