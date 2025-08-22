import { db } from "@/db";
import { Movement } from "@/db/types";
import { useCallback } from "react";
import { useLiveQuery } from "dexie-react-hooks";

export const useMovementsDb = () => {
  const movementsData = useLiveQuery(async () => {
    const movements = await db.movements
      .orderBy("createdAt")
      .reverse()
      .toArray();
    return movements;
  }, []);

  const addMovementData = useCallback(async (movementData: Movement) => {
    await db.movements.add(movementData);
  }, []);

  const updateMovementData = useCallback(async (movementData: Movement) => {
    await db.movements.put(movementData);
  }, []);

  // Generic method to update specific properties of a Movement item
  const updateMovementDataItem = useCallback(
    async (id: string, updates: Partial<Omit<Movement, "id">>) => {
      await db.movements.update(id, updates);
    },
    []
  );

  // Specific update methods for individual fields
  const updateMovementDataItemUrl = useCallback(
    async (id: string, url: string) => {
      await db.movements.update(id, { url });
    },
    []
  );

  const updateMovementDataItemStatus = useCallback(
    async (id: string, status: string) => {
      await db.movements.update(id, { status });
    },
    []
  );

  const updateMovementDataItemPrompt = useCallback(
    async (id: string, prompt: string) => {
      await db.movements.update(id, { prompt });
    },
    []
  );

  const updateMovementDataItemModel = useCallback(
    async (id: string, model: string) => {
      await db.movements.update(id, { model });
    },
    []
  );

  const deleteMovementData = useCallback(async (id: string) => {
    await db.movements.delete(id);
  }, []);

  const getMovementById = useCallback(async (id: string) => {
    return await db.movements.get(id);
  }, []);

  return {
    movementsData,
    addMovementData,
    updateMovementData,
    updateMovementDataItem,
    updateMovementDataItemUrl,
    updateMovementDataItemStatus,
    updateMovementDataItemPrompt,
    updateMovementDataItemModel,
    deleteMovementData,
    getMovementById,
  };
};
