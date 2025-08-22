import { VideoGroup } from "@/constants/voices";
import { CreateData } from "@/db/types";
import { atom } from "jotai";
import { atomWithStorage, createJSONStorage } from "jotai/utils";

type VideoStore = {
  videoList: CreateData[];
};

export const createVideoStoreAtom = atom<VideoStore>({
  videoList: [],
});
//   createJSONStorage(() =>
//     typeof window !== "undefined"
//       ? sessionStorage
//       : {
//           getItem: () => null,
//           setItem: () => null,
//           removeItem: () => null,
//         }
//   ),
//   {
//     getOnInit: true,
//   }
// );
