import { db } from "@/db";
import { FavoriteVoice } from "@/db/types";
import { useCallback } from "react";
import { useLiveQuery } from "dexie-react-hooks";

export const useFavoriteVoice = () => {
  // 获取所有收藏的声音，按收藏时间倒序排列
  const favoriteVoices = useLiveQuery(async () => {
    const favorites = await db.favoriteVoices
      .orderBy("createdAt")
      .reverse()
      .toArray();
    return favorites;
  }, []);

  // 检查某个声音是否已收藏
  const isFavorite = useCallback(
    async (voiceKey: string, voiceValue: string) => {
      const favorite = await db.favoriteVoices
        .where("voiceKey")
        .equals(voiceKey)
        .and((item) => item.voiceValue === voiceValue)
        .first();
      return !!favorite;
    },
    []
  );

  // 使用useLiveQuery检查收藏状态 - 实时更新
  const useFavoriteStatus = (voiceKey: string, voiceValue: string) => {
    return useLiveQuery(async () => {
      const favorite = await db.favoriteVoices
        .where("voiceKey")
        .equals(voiceKey)
        .and((item) => item.voiceValue === voiceValue)
        .first();
      return !!favorite;
    }, [voiceKey, voiceValue]);
  };

  // 添加收藏
  const addToFavorites = useCallback(
    async (
      voiceKey: string,
      voiceValue: string,
      groupKey: string,
      voiceName: string,
      voiceGender?: string
    ) => {
      // 检查是否已经收藏
      const existing = await db.favoriteVoices
        .where("voiceKey")
        .equals(voiceKey)
        .and((item) => item.voiceValue === voiceValue)
        .first();

      if (existing) {
        console.log("Voice already in favorites");
        return existing;
      }

      const favoriteVoice: FavoriteVoice = {
        voiceKey,
        voiceValue,
        groupKey,
        voiceName,
        voiceGender,
        createdAt: Date.now(),
      };

      const id = await db.favoriteVoices.add(favoriteVoice);
      return { ...favoriteVoice, id };
    },
    []
  );

  // 从收藏中移除
  const removeFromFavorites = useCallback(
    async (voiceKey: string, voiceValue: string) => {
      return await db.favoriteVoices
        .where("voiceKey")
        .equals(voiceKey)
        .and((item) => item.voiceValue === voiceValue)
        .delete();
    },
    []
  );

  // 切换收藏状态
  const toggleFavorite = useCallback(
    async (
      voiceKey: string,
      voiceValue: string,
      groupKey: string,
      voiceName: string,
      voiceGender?: string
    ) => {
      const isCurrentlyFavorite = await isFavorite(voiceKey, voiceValue);

      if (isCurrentlyFavorite) {
        await removeFromFavorites(voiceKey, voiceValue);
        return false;
      } else {
        await addToFavorites(
          voiceKey,
          voiceValue,
          groupKey,
          voiceName,
          voiceGender
        );
        return true;
      }
    },
    [isFavorite, removeFromFavorites, addToFavorites]
  );

  // 根据平台获取收藏
  const getFavoritesByGroup = useCallback(async (groupKey: string) => {
    return await db.favoriteVoices
      .where("groupKey")
      .equals(groupKey)
      .reverse()
      .sortBy("createdAt");
  }, []);

  // 清空所有收藏
  const clearAllFavorites = useCallback(async () => {
    return await db.favoriteVoices.clear();
  }, []);

  // 删除指定收藏
  const deleteFavoriteById = useCallback(async (id: number) => {
    return await db.favoriteVoices.delete(id);
  }, []);

  // 搜索收藏的声音
  const searchFavorites = useCallback(async (searchTerm: string) => {
    if (!searchTerm.trim()) {
      const allFavorites = await db.favoriteVoices
        .orderBy("createdAt")
        .reverse()
        .toArray();
      return allFavorites;
    }

    return await db.favoriteVoices
      .filter((voice) =>
        voice.voiceName.toLowerCase().includes(searchTerm.toLowerCase())
      )
      .toArray();
  }, []);

  return {
    // 数据查询
    favoriteVoices,
    isFavorite,
    useFavoriteStatus,
    getFavoritesByGroup,
    searchFavorites,

    // CRUD操作
    addToFavorites,
    removeFromFavorites,
    toggleFavorite,
    deleteFavoriteById,
    clearAllFavorites,
  };
};
