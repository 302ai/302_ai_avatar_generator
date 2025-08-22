import { db } from "@/db";
import { GeneratedImage } from "@/db/types";
import { useCallback } from "react";
import { useLiveQuery } from "dexie-react-hooks";

export const useGenImageDb = () => {
  const generatedImages = useLiveQuery(async () => {
    const images = await db.generated_images
      .orderBy("createdAt")
      .reverse()
      .toArray();
    return images;
  }, []);

  const addGeneratedImage = useCallback(async (imageData: GeneratedImage) => {
    await db.generated_images.add(imageData);
  }, []);

  const addGeneratedImages = useCallback(async (images: GeneratedImage[]) => {
    await db.generated_images.bulkAdd(images);
  }, []);

  const updateGeneratedImage = useCallback(
    async (imageData: GeneratedImage) => {
      await db.generated_images.put(imageData);
    },
    []
  );

  const updateGeneratedImageItem = useCallback(
    async (id: string, updates: Partial<Omit<GeneratedImage, "id">>) => {
      await db.generated_images.update(id, updates);
    },
    []
  );

  const deleteGeneratedImage = useCallback(async (id: string) => {
    await db.generated_images.delete(id);
  }, []);

  const getGeneratedImageById = useCallback(async (id: string) => {
    return await db.generated_images.get(id);
  }, []);

  const clearAllGeneratedImages = useCallback(async () => {
    await db.generated_images.clear();
  }, []);

  return {
    generatedImages,
    addGeneratedImage,
    addGeneratedImages,
    updateGeneratedImage,
    updateGeneratedImageItem,
    deleteGeneratedImage,
    getGeneratedImageById,
    clearAllGeneratedImages,
  };
};
