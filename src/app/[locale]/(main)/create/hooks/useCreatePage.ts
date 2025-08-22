// import { useEffect, useState } from "react";
// import { CreatePageState } from "../types";
// import { useDb } from "@/hooks/db/use-db";
// import { randomUUID } from "crypto";

// export const useCreatePage = () => {
//   const { getCreateData, addCreateData, create } = useDb();

//   const initState = async () => {
//     const createData = await getCreateData();
//     if (!createData) {
//       addCreateData({
//         id: randomUUID(),
//         createdAt: Date.now(),
//         platform: "Doubao",
//         voice: "zh_male_beijingxiaoye_emo_v2_mars_bigtts",
//         text: "",
//         backgroundImage: "",
//         avatarImage: "",
//       });
//     }
//   };

//   useEffect(() => {
//     initState();
//   }, []);

//   const updateSmallSelect = (value: string) => {
//     setState((prev) => ({ ...prev, smallSelectValue: value }));
//   };

//   const updateLargeSelect = (value: string) => {
//     setState((prev) => ({ ...prev, largeSelectValue: value }));
//   };

//   const updateTextContent = (value: string) => {
//     setState((prev) => ({ ...prev, textContent: value }));
//   };

//   const updateCoverImage = (url?: string) => {
//     setState((prev) => ({ ...prev, coverImageUrl: url }));
//   };

//   const updateBackground = (url?: string) => {
//     console.log("Updating background to:", url);
//     setState((prev) => ({ ...prev, background: url }));
//   };

//   return {
//     state,
//     updateSmallSelect,
//     updateLargeSelect,
//     updateTextContent,
//     updateCoverImage,
//     updateBackground,
//   };
// };
