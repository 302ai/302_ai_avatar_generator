import { db } from "@/db";
import { Avatar } from "@/db/types";
import { useCallback, useEffect } from "react";
import { useLiveQuery } from "dexie-react-hooks";

export const useAvatarDb = () => {
  // 一次性迁移旧数据
  useEffect(() => {
    const migrateOldData = async () => {
      const avatars = await db.avatar.toArray();
      const now = Date.now();

      for (const [index, avatar] of avatars.entries()) {
        if (!avatar.createdAt) {
          // 为旧数据添加createdAt字段，使用递减时间戳保持顺序
          const createdAt = now - (avatars.length - index) * 1000;
          await db.avatar.update(avatar.id, { createdAt });
        }
      }
    };

    migrateOldData().catch(console.error);
  }, []);

  const avatarData = useLiveQuery(async () => {
    const avatars = await db.avatar.toArray();

    // 按createdAt降序排序，对于没有createdAt的记录使用0作为默认值
    return avatars.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  }, []);

  const addAvatarData = useCallback(async (avatarData: Avatar) => {
    await db.avatar.add(avatarData);
  }, []);

  const updateAvatarData = useCallback(async (avatarData: Avatar) => {
    await db.avatar.put(avatarData);
  }, []);

  // Generic method to update specific properties of an Avatar item
  const updateAvatarDataItem = useCallback(
    async (id: string, updates: Partial<Omit<Avatar, "id">>) => {
      await db.avatar.update(id, updates);
    },
    []
  );

  // Specific update methods for individual fields
  const updateAvatarDataItemName = useCallback(
    async (id: string, name: string) => {
      await db.avatar.update(id, { name });
    },
    []
  );

  const updateAvatarDataItemVideoUrl = useCallback(
    async (id: string, videoUrl: string) => {
      console.log("updateAvatarDataItemVideoUrl called with:", {
        id,
        videoUrl,
      });

      const avatar = await db.avatar.get(id);
      console.log("Current avatar:", avatar);

      const updatedVideoUrl = avatar?.videoUrl
        ? [...avatar.videoUrl, videoUrl]
        : [videoUrl];

      console.log("Updated videoUrl array:", updatedVideoUrl);

      const result = await db.avatar.update(id, { videoUrl: updatedVideoUrl });
      console.log("Update result:", result);

      // 验证更新是否成功
      const updatedAvatar = await db.avatar.get(id);
      console.log("Avatar after update:", updatedAvatar);
    },
    []
  );

  const updateAvatarDataItemPicUrl = useCallback(
    async (id: string, pic_url: string) => {
      const avatar = await db.avatar.get(id);
      const updatedPicUrl = avatar?.pic_url
        ? [...avatar.pic_url, pic_url]
        : [pic_url];
      await db.avatar.update(id, { pic_url: updatedPicUrl });
    },
    []
  );

  const updateAvatarDataItemPlatform = useCallback(
    async (id: string, platform: string) => {
      await db.avatar.update(id, { platform });
    },
    []
  );

  const updateAvatarDataItemVoice = useCallback(
    async (id: string, voice: string) => {
      await db.avatar.update(id, { voice });
    },
    []
  );

  const deleteAvatarData = useCallback(async (id: string) => {
    await db.avatar.delete(id);
  }, []);

  const getAvatarById = useCallback(async (id: string) => {
    return await db.avatar.get(id);
  }, []);

  return {
    avatarData,
    addAvatarData,
    updateAvatarData,
    updateAvatarDataItem,
    updateAvatarDataItemName,
    updateAvatarDataItemVideoUrl,
    updateAvatarDataItemPicUrl,
    updateAvatarDataItemPlatform,
    updateAvatarDataItemVoice,
    deleteAvatarData,
    getAvatarById,
  };
};
