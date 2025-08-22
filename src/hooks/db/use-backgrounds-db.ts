import { db } from "@/db";
import { backgrounds } from "@/db/types";
import { useCallback } from "react";
import { useLiveQuery } from "dexie-react-hooks";

export const useBackgroundsDb = () => {
  const backgroundsData = useLiveQuery(async () => {
    const backgrounds = await db.backgrounds
      .orderBy("createdAt")
      .reverse()
      .toArray();
    return backgrounds;
  }, []);

  const addBackground = useCallback(async (backgroundData: backgrounds) => {
    await db.backgrounds.add(backgroundData);
  }, []);

  const addBackgrounds = useCallback(async (backgrounds: backgrounds[]) => {
    await db.backgrounds.bulkAdd(backgrounds);
  }, []);

  const updateBackground = useCallback(async (backgroundData: backgrounds) => {
    await db.backgrounds.put(backgroundData);
  }, []);

  const updateBackgroundItem = useCallback(
    async (id: string, updates: Partial<Omit<backgrounds, "id">>) => {
      await db.backgrounds.update(id, updates);
    },
    []
  );

  const deleteBackground = useCallback(async (id: string) => {
    await db.backgrounds.delete(id);
  }, []);

  const getBackgroundById = useCallback(async (id: string) => {
    return await db.backgrounds.get(id);
  }, []);

  const clearAllBackgrounds = useCallback(async () => {
    await db.backgrounds.clear();
  }, []);

  return {
    backgroundsData,
    addBackground,
    addBackgrounds,
    updateBackground,
    updateBackgroundItem,
    deleteBackground,
    getBackgroundById,
    clearAllBackgrounds,
  };
};
