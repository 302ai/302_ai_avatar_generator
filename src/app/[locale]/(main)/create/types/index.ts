import { CreateData } from "@/db/types";

// 页面状态接口
export interface CreatePageState {
  // 小下拉框选择的值（如：语言选择）
  smallSelectValue: string;

  // 大下拉框选择的值（如：声音模型选择）
  largeSelectValue: string;

  // 文本输入内容
  textContent: string;

  // 视频封面图URL
  coverImageUrl?: string;

  background?: string;
}

// 下拉框选项接口
export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface SelectConfig {
  placeholder: string;
  options: SelectOption[];
}

// VideoPreviewFrame 组件属性
// export interface VideoPreviewFrameProps
//   extends Omit<CreateData, "id" | "createdAt"> {
//   onBackgroundChange?: (newImageUrl: string) => void;
// }

// ConfigurationPanel 组件属性
// export interface ConfigurationPanelProps extends Omit<CreateData, "id" | "createdAt"> {
//   onPlatformChange: (value: string) => void;
//   onVoiceChange: (value: string) => void;

// }
