import { db } from "@/db";
import { CustomVoiceModel } from "@/db/types";
import { useCallback } from "react";
import { useLiveQuery } from "dexie-react-hooks";

export const useCustomVoiceDb = () => {
  // 获取所有自定义声音数据，按创建时间倒序排列
  const customVoiceData = useLiveQuery(async () => {
    const customVoices = await db.customVoices
      .orderBy("createdAt")
      .reverse()
      .toArray();
    return customVoices;
  }, []);

  // 根据状态获取声音
  const getVoicesByStatus = useCallback(
    async (status: CustomVoiceModel["status"]) => {
      const voices = await db.customVoices
        .where("status")
        .equals(status)
        .toArray();
      return voices.sort((a, b) => b.createdAt - a.createdAt);
    },
    []
  );

  // 获取成功的声音
  const successVoices = useLiveQuery(async () => {
    const voices = await db.customVoices
      .where("status")
      .equals("success")
      .toArray();
    return voices.sort((a, b) => b.createdAt - a.createdAt);
  }, []);

  // 添加自定义声音（自动添加创建时间）
  const addCustomVoiceData = useCallback(
    async (voiceData: Omit<CustomVoiceModel, "createdAt">) => {
      const newVoice: CustomVoiceModel = {
        ...voiceData,
        createdAt: Date.now(),
      };
      const id = await db.customVoices.add(newVoice);
      return id;
    },
    []
  );

  const updateCustomVoiceData = useCallback(
    async (customVoiceData: CustomVoiceModel) => {
      await db.customVoices.put(customVoiceData);
    },
    []
  );

  // 使用id字段更新
  const updateCustomVoiceDataItem = useCallback(
    async (
      id: number,
      updates: Partial<Omit<CustomVoiceModel, "id" | "createdAt">>
    ) => {
      return await db.customVoices.where("id").equals(id).modify(updates);
    },
    []
  );

  // 具体字段更新方法
  const updateCustomVoiceDataItemName = useCallback(
    async (id: number, name: string) => {
      return await updateCustomVoiceDataItem(id, { name });
    },
    [updateCustomVoiceDataItem]
  );

  const updateCustomVoiceDataItemAudioUrl = useCallback(
    async (id: number, audioUrl: string) => {
      console.log("updateCustomVoiceDataItemAudioUrl called with:", {
        id,
        audioUrl,
      });
      return await updateCustomVoiceDataItem(id, { audioUrl });
    },
    [updateCustomVoiceDataItem]
  );

  const updateCustomVoiceDataItemAudioId = useCallback(
    async (id: number, audioId: string) => {
      return await updateCustomVoiceDataItem(id, { audioId });
    },
    [updateCustomVoiceDataItem]
  );

  const updateCustomVoiceDataItemStatus = useCallback(
    async (id: number, status: CustomVoiceModel["status"]) => {
      return await updateCustomVoiceDataItem(id, { status });
    },
    [updateCustomVoiceDataItem]
  );

  const updateCustomVoiceDataItemLoopId = useCallback(
    async (id: number, loopId: string) => {
      return await updateCustomVoiceDataItem(id, { loopId });
    },
    [updateCustomVoiceDataItem]
  );

  // 删除自定义声音
  const deleteCustomVoiceData = useCallback(async (id: number) => {
    return await db.customVoices.where("id").equals(id).delete();
  }, []);

  // 根据id获取自定义声音
  const getCustomVoiceById = useCallback(async (id: number) => {
    return await db.customVoices.where("id").equals(id).first();
  }, []);

  // 批量删除
  const deleteMultipleVoices = useCallback(async (ids: number[]) => {
    return await db.customVoices.where("id").anyOf(ids).delete();
  }, []);

  // 标记声音为成功状态并设置音频URL
  const markVoiceAsSuccess = useCallback(
    async (id: number, audioUrl: string) => {
      return await updateCustomVoiceDataItem(id, {
        status: "success",
        audioUrl,
      });
    },
    [updateCustomVoiceDataItem]
  );

  // 标记声音为失败状态
  const markVoiceAsFailed = useCallback(
    async (id: number) => {
      return await updateCustomVoiceDataItem(id, {
        status: "failed",
      });
    },
    [updateCustomVoiceDataItem]
  );

  // 通过loopId查找并更新自定义声音记录
  const updateVoiceByLoopId = useCallback(
    async (
      loopId: string,
      updates: Partial<Omit<CustomVoiceModel, "id" | "createdAt">>
    ) => {
      const voices = await db.customVoices
        .where("loopId")
        .equals(loopId)
        .toArray();
      if (voices.length > 0) {
        const voice = voices[0]; // 取第一个匹配的记录
        await updateCustomVoiceDataItem(voice.id!, updates);
        return voice.id!;
      }
      return null;
    },
    [updateCustomVoiceDataItem]
  );

  // 通过loopId查找自定义声音记录
  const findVoiceByLoopId = useCallback(async (loopId: string) => {
    const voices = await db.customVoices
      .where("loopId")
      .equals(loopId)
      .toArray();
    return voices.length > 0 ? voices[0] : null;
  }, []);

  // 搜索声音
  const searchVoicesByName = useCallback(async (searchTerm: string) => {
    if (!searchTerm.trim()) {
      // 直接从数据库获取而不是依赖customVoiceData状态
      const allVoices = await db.customVoices
        .orderBy("createdAt")
        .reverse()
        .toArray();
      return allVoices;
    }

    return await db.customVoices
      .filter((voice) =>
        voice.name.toLowerCase().includes(searchTerm.toLowerCase())
      )
      .toArray();
  }, []);

  return {
    // 数据查询
    customVoiceData,
    successVoices,
    getVoicesByStatus,
    getCustomVoiceById,
    searchVoicesByName,

    // CRUD操作
    addCustomVoiceData,
    updateCustomVoiceData,
    updateCustomVoiceDataItem,
    deleteCustomVoiceData,
    deleteMultipleVoices,

    // 具体字段更新
    updateCustomVoiceDataItemName,
    updateCustomVoiceDataItemAudioUrl,
    updateCustomVoiceDataItemAudioId,
    updateCustomVoiceDataItemStatus,
    updateCustomVoiceDataItemLoopId,

    // 状态管理
    markVoiceAsSuccess,
    markVoiceAsFailed,

    // 通过loopId管理
    updateVoiceByLoopId,
    findVoiceByLoopId,
  };
};
