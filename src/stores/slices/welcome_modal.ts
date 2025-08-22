import { atom } from "jotai";

type WelcomeModalStore = {
  isOpen: boolean;
  // 传递给弹框的参数，比如从voice页面预设的平台和音色
  presetData?: {
    platform?: string;
    voice?: string;
    avatarImage?: string;
    videoUrl?: string;
    googleModel?: string;
    source?: "voice" | "avatar"; // 标识来源
    hasImageMaterials?: boolean; // 是否有图片素材
    hasVideoMaterials?: boolean; // 是否有视频素材
  };
};

export const welcomeModalStoreAtom = atom<WelcomeModalStore>({
  isOpen: false,
  presetData: undefined,
});

// 打开弹框的action
export const openWelcomeModalAtom = atom(
  null,
  (
    get,
    set,
    presetData?: {
      platform?: string;
      voice?: string;
      avatarImage?: string;
      videoUrl?: string;
      googleModel?: string;
      source?: "voice" | "avatar";
      hasImageMaterials?: boolean;
      hasVideoMaterials?: boolean;
      azureLanguage?: string;
    }
  ) => {
    set(welcomeModalStoreAtom, {
      isOpen: true,
      presetData,
    });
  }
);

// 关闭弹框的action
export const closeWelcomeModalAtom = atom(null, (get, set) => {
  const currentStore = get(welcomeModalStoreAtom);
  set(welcomeModalStoreAtom, {
    isOpen: false,
    presetData: currentStore.presetData, // 保留预设数据，用于页面导航后的判断
  });
});

// 清除预设数据的action（用于手动清理）
export const clearPresetDataAtom = atom(null, (get, set) => {
  const currentStore = get(welcomeModalStoreAtom);
  set(welcomeModalStoreAtom, {
    ...currentStore,
    presetData: undefined,
  });
});
