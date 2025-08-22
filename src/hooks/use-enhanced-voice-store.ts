import { useAtom } from "jotai";
import { useMemo } from "react";
import { voiceStoreAtom } from "@/stores/slices/voice_store";
import { useCustomVoiceDb } from "@/hooks/db/use-custom-voice";
import { VoiceGroup } from "@/constants/voices";

export interface CustomVoiceOption {
  key: string;
  label: string;
  value: string;
  isCustom: true;
  audioUrl: string;
  avatarId?: string;
  isAssociated?: boolean;
}

/**
 * 扩展的声音存储Hook，将自定义声音整合到现有的voiceStore中
 */
export const useEnhancedVoiceStore = (avatarId?: string) => {
  const [voiceStore] = useAtom(voiceStoreAtom);
  const { successVoices } = useCustomVoiceDb();

  // 将自定义声音转换为VoiceOption格式
  const customVoiceOptions = useMemo(() => {
    if (!successVoices) return [];

    // 如果提供了avatarId，优先显示关联的自定义声音，然后显示其他可用的自定义声音
    let filteredVoices;
    if (avatarId) {
      const associatedVoices = successVoices.filter(
        (voice) => voice.avatarId === avatarId
      );
      const otherVoices = successVoices.filter(
        (voice) => !voice.avatarId || voice.avatarId !== avatarId
      );
      filteredVoices = [...associatedVoices, ...otherVoices];
    } else {
      filteredVoices = successVoices;
    }
    console.log("filteredVoices123123123", filteredVoices);
    return filteredVoices.map((voice) => ({
      key: `custom_${voice.id}`,
      label: voice.avatarId === avatarId ? `${voice.name}` : voice.name,
      value: `custom_${voice.id}`,
      isCustom: true as const,
      audioUrl: voice.audioUrl,
      avatarId: voice.avatarId,
      isAssociated: voice.avatarId === avatarId,
      cloneType: voice.cloneType,
    }));
  }, [successVoices, avatarId]);

  // 创建自定义声音分组
  const customVoiceGroup: VoiceGroup | null = useMemo(() => {
    if (customVoiceOptions.length === 0) return null;

    return {
      key: "custom",
      label: "Custom",
      value: "custom",
      children: customVoiceOptions,
    };
  }, [customVoiceOptions]);

  // 合并原有声音列表和自定义声音
  const enhancedVoiceList = useMemo(() => {
    let baseList = [...voiceStore.voiceList];

    // 查找是否已存在custom分组
    const existingCustomIndex = baseList.findIndex(
      (group) => group.value === "custom" || group.key === "custom"
    );

    if (existingCustomIndex !== -1) {
      // 获取原有的custom分组内容
      const existingCustomGroup = baseList[existingCustomIndex];
      const originalCustomChildren = existingCustomGroup.children || [];

      // 合并原有的custom声音和新的自定义声音
      const mergedChildren = [...originalCustomChildren];

      if (customVoiceOptions.length > 0) {
        mergedChildren.push(...customVoiceOptions);
      }

      // 创建合并后的custom分组
      const mergedCustomGroup = {
        key: "custom",
        label: "Custom",
        value: "custom",
        children: mergedChildren,
      };

      // 替换现有的custom分组 - 创建新的数组引用以确保React检测到变化
      baseList = [
        ...baseList.slice(0, existingCustomIndex),
        mergedCustomGroup,
        ...baseList.slice(existingCustomIndex + 1),
      ];
    } else if (customVoiceGroup) {
      // 如果没有原有的custom分组，直接添加我们的自定义声音分组
      baseList.unshift(customVoiceGroup);
    }

    return baseList;
  }, [voiceStore.voiceList, customVoiceOptions, successVoices]);

  // 查找声音的辅助函数
  const findVoiceById = (voiceId: string) => {
    // 检查是否是自定义声音
    if (voiceId.startsWith("custom_")) {
      return customVoiceOptions.find((voice) => voice.value === voiceId);
    }

    // 在增强后的声音列表中查找（包括原有的custom分组内容）
    for (const group of enhancedVoiceList) {
      for (const voice of group.children) {
        if (voice.value === voiceId) {
          return voice;
        }
      }
    }

    return null;
  };

  // 检查声音是否为自定义声音
  const isCustomVoice = (voiceId: string) => {
    return voiceId.startsWith("custom_");
  };

  // 获取自定义声音的详细信息
  const getCustomVoiceDetails = (voiceId: string) => {
    if (!isCustomVoice(voiceId)) return null;

    const voiceIdNumber = parseInt(voiceId.replace("custom_", ""));
    return successVoices?.find((voice) => voice.id === voiceIdNumber) || null;
  };

  return {
    // 扩展的声音列表
    enhancedVoiceList,

    // 原有的声音存储
    originalVoiceStore: voiceStore,

    // 自定义声音相关
    customVoiceOptions,
    customVoiceGroup,

    // 辅助函数
    findVoiceById,
    isCustomVoice,
    getCustomVoiceDetails,
  };
};
