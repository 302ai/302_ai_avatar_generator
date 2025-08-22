import { db } from "@/db";
import { History, MergeHistory, ChildTask } from "@/db/types";
import { useCallback } from "react";
import { useLiveQuery } from "dexie-react-hooks";

export const useHistoryDb = () => {
  const historyData = useLiveQuery(async () => {
    const genHistory = await db.history
      .orderBy("createdAt")
      .reverse()
      .toArray();
    return genHistory;
  }, []);

  const addHistoryData = useCallback(async (historyData: History) => {
    await db.history.add(historyData);
  }, []);

  const updateHistoryData = useCallback(async (historyData: History) => {
    await db.history.put(historyData);
  }, []);

  // Generic method to update specific properties of a History item
  const updateHistoryDataItem = useCallback(
    async (id: string, updates: Partial<Omit<History, "id" | "createdAt">>) => {
      await db.history.update(id, updates);
    },
    []
  );

  // Keep legacy methods for backward compatibility (can be removed later)
  const updateHistoryDataItemAvatar = useCallback(
    async (id: string, avatarImage: string) => {
      await db.history.update(id, { avatarImage });
    },
    []
  );

  const updateHistoryDataItemPlatform = useCallback(
    async (id: string, platform: string) => {
      await db.history.update(id, { platform });
    },
    []
  );

  const updateHistoryDataItemVoice = useCallback(
    async (id: string, voice: string) => {
      await db.history.update(id, { voice });
    },
    []
  );

  const updateHistoryDataItemText = useCallback(
    async (id: string, text: string) => {
      await db.history.update(id, { text });
    },
    []
  );

  const deleteHistoryDataItem = useCallback(async (id: string) => {
    await db.history.delete(id);
  }, []);

  // MergeHistory相关方法
  const mergeHistoryData = useLiveQuery(async () => {
    const mergeHistory = await db.mergeHistory
      .orderBy("createdAt")
      .reverse()
      .toArray();
    return mergeHistory;
  }, []);

  const addMergeHistoryData = useCallback(
    async (mergeHistoryData: MergeHistory) => {
      await db.mergeHistory.add(mergeHistoryData);
    },
    []
  );

  const updateMergeHistoryData = useCallback(
    async (mergeHistoryData: MergeHistory) => {
      await db.mergeHistory.put(mergeHistoryData);
    },
    []
  );

  const updateMergeHistoryItem = useCallback(
    async (
      id: string,
      updates: Partial<Omit<MergeHistory, "id" | "createdAt">>
    ) => {
      await db.mergeHistory.update(id, updates);
    },
    []
  );

  const deleteMergeHistoryItem = useCallback(async (id: string) => {
    // 先获取合并任务信息，找到所有子任务ID
    const mergeTask = await db.mergeHistory.get(id);

    if (mergeTask && mergeTask.childTaskIds) {
      // 删除所有子任务
      await Promise.all(
        mergeTask.childTaskIds.map((childTaskId) =>
          db.history.delete(childTaskId)
        )
      );
    }

    // 删除合并任务本身
    await db.mergeHistory.delete(id);
  }, []);

  // 根据子任务ID查找对应的合并任务
  const findMergeHistoryByChildTask = useCallback(
    async (childTaskId: string) => {
      const mergeHistories = await db.mergeHistory.toArray();
      return mergeHistories.find(
        (mh) =>
          mh.childTaskIds.includes(childTaskId) ||
          mh.childTasks?.some((child) => child.taskId === childTaskId)
      );
    },
    []
  );

  return {
    historyData,
    addHistoryData,
    updateHistoryData,
    updateHistoryDataItem,
    updateHistoryDataItemAvatar,
    updateHistoryDataItemPlatform,
    updateHistoryDataItemVoice,
    updateHistoryDataItemText,
    deleteHistoryDataItem,
    mergeHistoryData,
    addMergeHistoryData,
    updateMergeHistoryData,
    updateMergeHistoryItem,
    deleteMergeHistoryItem,
    findMergeHistoryByChildTask,
  };
};
