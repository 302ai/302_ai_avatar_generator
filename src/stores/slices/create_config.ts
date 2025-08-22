import { atomWithStorage, createJSONStorage } from "jotai/utils";

type CreateConfigType = {
  createType:
    | "hedra"
    | "chanjing"
    | "Omnihuman"
    | "TopView"
    | "stable"
    | "latentsync"
    | null;
  resolution: "16:9" | "9:16";
  // hedra高级设置
  hedraSettings?: {
    videoResolution: "720p" | "540p";
  };
  // chanjing高级设置
  chanjingSettings?: {
    driveMode: "" | "random";
    backway: 1 | 2;
  };
};

export const createConfigAtom = atomWithStorage<CreateConfigType>(
  "createConfig",
  {
    createType: null,
    resolution: "16:9",
    hedraSettings: {
      videoResolution: "720p",
    },
    chanjingSettings: {
      driveMode: "",
      backway: 2,
    },
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
