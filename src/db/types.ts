export type CreateData = {
  id: string;
  createdAt: number;
  platform: string;
  voice: string;
  text: string;
  avatarImage: string;
  backgroundImage: string;
  videoUrl: string;
  wavUrl: string;
  subtitleConfig?: {
    show: boolean;
    font_size: number;
    color: string;
    stroke_color: string;
    font_id: string;
    stroke_width: number;
  };
  mode: "text" | "audio";
  audioFile: string;
  googleModel?: "Gemini Flash" | "Gemini Pro"; // Google TTS模型选择
  azureLanguage?: string; // Azure语言选择
};

export interface HedraData {
  ai_model_id: string;
  audio_id: string;
  start_keyframe_id: string;
  image_url?: string;
  audio_url?: string;
  text_prompt: string;
}

export interface History extends CreateData {
  video_url: string;
  status: number;
  preview_url: string;
  audioId: string;
  avatarId: string;
  // hedra相关字段
  model: string; // 标识使用的模型类型 'hedra' | 'other'
  type?: string; // 视频类型标识
  streaming_url?: string; // 流媒体URL
  hedra_data?: HedraData; // hedra特有数据
  taskId: string;
  taskStatus: "pending" | "success" | "failed";
  name: string;
  // 创建配置参数 - 用于重新生成
  createType?:
    | "hedra"
    | "chanjing"
    | "Omnihuman"
    | "TopView"
    | "stable"
    | "latentsync";
  videoResolution?: "720p" | "540p"; // hedra的视频分辨率
  driveMode?: string; // chanjing的驱动模式
  backway: 1 | 2;
  originalVideoUrl?: string; // 原始数字人视频URL，用于重新生成
}

export interface Avatar {
  id: string;
  avatar_id: string;
  name: string;
  videoUrl: string[];
  platform: string;
  voice: string;
  pic_url: string[];
  googleModel?: string;
  createdAt?: number;
}

export interface Movement {
  id: string;
  url: string;
  status: string;
  prompt: string;
  model: string;
  selectedAvatar: any;
  thumbnailImage: string;
  createdAt: Date;
}

export interface GeneratedImage {
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

export interface backgrounds {
  id: string;
  url: string;
  name: string;
  desc: string;
  isCustom?: boolean;
  createdAt: Date;
}

export type CustomVoiceModel = {
  id?: number; // Auto-increment primary key (optional for new records)
  name: string;
  model_type: "custom" | "Fish Audio" | "cicada1.0" | "cicada3.0";
  text: string;
  createdAt: number;
  status: "pending" | "success" | "failed";
  loopId: string; // External task ID for polling
  audioId: string;
  audioUrl: string;
  avatarId?: string; // 关联的avatarId，可选字段
  cloneType?: "fish_audio" | "cicada"; // 克隆类型标识
};

export type FavoriteVoice = {
  id?: number; // Auto-increment primary key
  voiceKey: string; // 声音的唯一标识 (voiceItem.key)
  voiceValue: string; // 声音的值 (voiceItem.value)
  groupKey: string; // 声音所属的平台/分组
  voiceName: string; // 声音名称
  voiceGender?: string; // 声音性别
  createdAt: number; // 收藏时间
};

// 子任务信息
export type ChildTask = {
  taskId: string; // 子任务ID (对应History表中的任务)
  status: "pending" | "success" | "failed"; // 子任务状态
  videoUrl?: string; // 子任务的视频URL
};

// 批量任务合并历史记录
export type MergeHistory = {
  id: string; // 主键ID
  name: string; // 任务组名称
  createdAt: number; // 创建时间
  status: "pending" | "processing" | "completed" | "failed"; // 任务组状态
  mergeTaskId?: string; // 合并任务ID
  mergedVideoUrl?: string; // 合并后的视频URL
  childTaskIds: string[]; // 子任务ID列表 (对应History表中的任务) - 保留用于兼容性
  childTasks: ChildTask[]; // 子任务详细信息列表
  totalTasks: number; // 总任务数
  completedTasks: number; // 已完成任务数
  failedTasks: number; // 失败任务数
  mergeRetryCount?: number; // 合并重试计数
  maxMergeRetries?: number; // 最大合并重试次数，默认为3
};
