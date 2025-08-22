export type SEOData = {
  supportLanguages: string[];
  fallbackLanguage: string;
  languages: Record<
    string,
    { title: string; description: string; image: string }
  >;
};

export const SEO_DATA: SEOData = {
  // TODO: Change to your own support languages
  supportLanguages: ["zh", "en", "ja"],
  fallbackLanguage: "en",
  // TODO: Change to your own SEO data
  languages: {
    zh: {
      title: "数字人生成",
      description: "使用AI生成数字人分身",
      image: "/images/global/desc_zh.png",
    },
    en: {
      title: "AI Avatar Generator",
      description: "Using AI to generate digital avatars",
      image: "/images/global/desc_en.png",
    },
    ja: {
      title: "デジタルヒューマン生成",
      description: "AIを用いたデジタル人分身の生成",
      image: "/images/global/desc_ja.png",
    },
  },
};
