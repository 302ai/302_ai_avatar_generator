import { env } from "@/env";
import { atom } from "jotai";

export interface GeneratedImageData {
  id: string;
  image_url: string;
  prompt: string;
  age: string;
  gender: string;
  region: string;
  referenceType: string;
  referenceContent: string;
  referenceImageUrl?: string;
  model: string;
  aspectRatio: string;
  quantity: number;
  createdAt: Date;
}

export const genImageAtom = atom<GeneratedImageData[]>([]);
