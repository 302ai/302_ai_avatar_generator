import { VideoGroup } from "@/constants/voices";
import { atomWithStorage, createJSONStorage } from "jotai/utils";

type VideoStore = {
  videoList: VideoGroup[];
};

export const videoStoreAtom = atomWithStorage<VideoStore>(
  "videoStore",
  {
    videoList: [],
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
