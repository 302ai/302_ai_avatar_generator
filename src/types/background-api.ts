// 背景更换API相关类型定义

export interface BackgroundChangeRequest {
  /** 原始图片URL */
  imageUrl: string;
  /** 背景描述（文字类型时使用） */
  backgroundDescription?: string;
  /** 背景图片URL（图片类型时使用） */
  backgroundImageUrl?: string;
  /** 背景更换类型 */
  type: "text" | "image";
  /** API密钥 */
  apiKey: string;
  aspect_ratio: "16:9" | "9:16";
}

export interface BackgroundChangeResponse {
  /** 操作是否成功 */
  success: boolean;
  /** 新的图片URL */
  newImageUrl?: string;
  /** 错误信息 */
  error?: string;
}

export interface BackgroundApiError {
  errCode: number;
  message: string;
  messageCn: string;
  messageEn: string;
  messageJa: string;
  type: string;
}

export interface BackgroundApiErrorResponse {
  error: BackgroundApiError;
}

// 302.ai API响应格式
export interface BackgroundApiResponse {
  success?: boolean;
  data?: {
    image_url: string;
    [key: string]: any;
  };
  image_url?: string; // 兼容格式
  images?: Array<{
    url: string;
    content_type?: string;
    file_size?: number;
    width?: number;
    height?: number;
  }>; // 实际的响应格式
  seed?: number;
  has_nsfw_concepts?: boolean[];
  error?: string;
  [key: string]: any;
}
