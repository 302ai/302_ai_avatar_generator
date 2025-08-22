import mitt from "mitt";
import { GeneratedImageData } from "@/stores/slices/gen_image_store";

type Events = {
  editImage: GeneratedImageData;
  createActionWithImage: GeneratedImageData;
  navigateToAppearanceTab: void;
};

export const eventBus = mitt<Events>();
