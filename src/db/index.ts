import Dexie, { Table } from "dexie";

import {
  Avatar,
  History,
  Movement,
  GeneratedImage,
  backgrounds,
  CustomVoiceModel,
  FavoriteVoice,
  MergeHistory,
} from "./types";

class digitalHunmanDB extends Dexie {
  history!: Table<History>;
  avatar!: Table<Avatar>;
  movements!: Table<Movement>;
  generated_images!: Table<GeneratedImage>;
  backgrounds!: Table<backgrounds>;
  customVoices!: Table<CustomVoiceModel>;
  favoriteVoices!: Table<FavoriteVoice>;
  mergeHistory!: Table<MergeHistory>;

  constructor() {
    super("digitalHumanDB"); // Change database name to force fresh start

    // Start fresh with version 1 to avoid primary key conflicts
    this.version(1).stores({
      history: "id, createdAt",
      avatar: "id, createdAt",
      movements: "id, createdAt",
      generated_images: "id, createdAt",
      backgrounds: "id, createdAt",
      customVoices: "++id, createdAt, status, loopId", // All fields from the start
      favoriteVoices: "++id, voiceKey, voiceValue, groupKey, createdAt", // 收藏声音表
      mergeHistory: "id, createdAt, status", // 批量任务合并历史
    });
  }
}

export const db = new digitalHunmanDB();
