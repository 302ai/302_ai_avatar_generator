import { env } from "@/env";
import { atom } from "jotai";

export interface GeneratedMovementsData {
  id: string;
  url: string;
  status: string;
  prompt?: string;
  model?: string;
  selectedAvatar?: any;
  createdAt?: Date;
}

export const genMovementsAtom = atom<GeneratedMovementsData[]>([]);
