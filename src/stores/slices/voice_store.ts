import { voices, VoiceGroup } from "@/constants/voices";
import { atomWithStorage, createJSONStorage } from "jotai/utils";

type VoiceStore = {
  voiceList: VoiceGroup[];
};

export const voiceStoreAtom = atomWithStorage<VoiceStore>(
  "voiceStore",
  {
    voiceList: voices,
  },
  createJSONStorage(() =>
    typeof window !== "undefined"
      ? sessionStorage
      : {
          getItem: () => null,
          setItem: () => null,
          removeItem: () => null,
        }
  ),
  {
    getOnInit: true,
  }
);
