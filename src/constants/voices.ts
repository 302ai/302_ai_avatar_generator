export interface AzureTTSSpeaker {
  Name: string;
  DisplayName: string;
  LocalName: string;
  ShortName: string;
  Gender: string;
  Locale: string;
  LocaleName: string;
  SampleRateHertz: string;
  VoiceType: string;
  Status: string;
  WordsPerMinute: string;
}

export interface OpenAiVoice {
  voice: string;
  name: string;
  sample: Record<string, string>;
  gender: string;
  emotion: string[];
}

export interface DoubaoVoice {
  emotion: string[];
  gender: string;
  name: string;
  sample: Record<string, string>;
  voice: string;
}

export interface FishVoice {
  name: string;
  voice: string;
  sample: Record<string, string>;
  emotion: string[];
  gender: string;
}

export interface MinimaxVoice {
  voice: string;
  name: string;
  sample: Record<string, string>;
  gender: string;
  emotion: string[];
}

export interface DubbingxiVoice {
  voice: string;
  name: string;
  sample: Record<string, string>;
  gender: string;
  emotion: string[];
}

export interface ElevenlabsVoice {
  voice: string;
  name: string;
  sample: Record<string, string>;
  gender: string;
  emotion: string[];
}

export interface GoogleVoice {
  voice: string;
  name: string;
  sample?: Record<string, string>;
  gender?: string;
  emotion?: string[];
}

export interface VoiceOption {
  key: string;
  label: string;
  value: string;
  originData?:
    | AzureTTSSpeaker
    | DoubaoVoice
    | FishVoice
    | MinimaxVoice
    | DubbingxiVoice
    | ElevenlabsVoice
    | GoogleVoice
    | OpenAiVoice;
}

export interface VideoGroup {
  key: string;
  name: string;
  videos: {
    cover: string;
    name: string;
    voice: string;
    script: string;
    avatar: string;
  }[];
}

export interface VoiceGroup {
  key: string;
  label: string;
  value: string;
  children: (VoiceOption | VoiceGroup)[];
}

export const voices: any = [
  {
    key: "OpenAI",
    label: "OpenAI",
    value: "OpenAI",
    children: [
      { key: "fable", label: "fable", value: "fable", gender: "male" },
      { key: "alloy", label: "alloy", value: "alloy", gender: "female" },
      { key: "echo", label: "echo", value: "echo", gender: "male" },
      { key: "nova", label: "nova", value: "nova", gender: "female" },
      { key: "shimmer", label: "shimmer", value: "shimmer", gender: "female" },
    ],
  },
  {
    key: "Azure",
    label: "Azure",
    value: "Azure",
    children: [],
  },
  { key: "Doubao", label: "Doubao", value: "Doubao", children: [] },
  { key: "fish", label: "FishAudio", value: "fish", children: [] },
  {
    key: "Minimaxi",
    label: "Minimax",
    value: "Minimaxi",
    children: [],
  },
  // {
  //   key: "dubbingx",
  //   label: "Dubbingx",
  //   value: "dubbingx",
  //   children: [],
  // },
  {
    key: "elevenlabs",
    label: "ElevenLabs",
    value: "elevenlabs",
    children: [],
  },
  {
    key: "google",
    label: "Google",
    value: "google",
    children: [
      {
        key: "Zephyr",
        label: "Zephyr",
        value: "Zephyr",
        originData: { voice: "Zephyr", name: "Zephyr" },
      },
      {
        key: "Puck",
        label: "Puck",
        value: "Puck",
        originData: { voice: "Puck", name: "Puck" },
      },
      {
        key: "Charon",
        label: "Charon",
        value: "Charon",
        originData: { voice: "Charon", name: "Charon" },
      },
      {
        key: "Kore",
        label: "Kore",
        value: "Kore",
        originData: { voice: "Kore", name: "Kore" },
      },
      {
        key: "Fenrir",
        label: "Fenrir",
        value: "Fenrir",
        originData: { voice: "Fenrir", name: "Fenrir" },
      },
      {
        key: "Leda",
        label: "Leda",
        value: "Leda",
        originData: { voice: "Leda", name: "Leda" },
      },
      {
        key: "Orus",
        label: "Orus",
        value: "Orus",
        originData: { voice: "Orus", name: "Orus" },
      },
      {
        key: "Aoede",
        label: "Aoede",
        value: "Aoede",
        originData: { voice: "Aoede", name: "Aoede" },
      },
      {
        key: "Callirrhoe",
        label: "Callirrhoe",
        value: "Callirrhoe",
        originData: { voice: "Callirrhoe", name: "Callirrhoe" },
      },
      {
        key: "Autonoe",
        label: "Autonoe",
        value: "Autonoe",
        originData: { voice: "Autonoe", name: "Autonoe" },
      },
      {
        key: "Enceladus",
        label: "Enceladus",
        value: "Enceladus",
        originData: { voice: "Enceladus", name: "Enceladus" },
      },
      {
        key: "Iapetus",
        label: "Iapetus",
        value: "Iapetus",
        originData: { voice: "Iapetus", name: "Iapetus" },
      },
      {
        key: "Umbriel",
        label: "Umbriel",
        value: "Umbriel",
        originData: { voice: "Umbriel", name: "Umbriel" },
      },
      {
        key: "Algieba",
        label: "Algieba",
        value: "Algieba",
        originData: { voice: "Algieba", name: "Algieba" },
      },
      {
        key: "Despina",
        label: "Despina",
        value: "Despina",
        originData: { voice: "Despina", name: "Despina" },
      },
      {
        key: "Erinome",
        label: "Erinome",
        value: "Erinome",
        originData: { voice: "Erinome", name: "Erinome" },
      },
      {
        key: "Algenib",
        label: "Algenib",
        value: "Algenib",
        originData: { voice: "Algenib", name: "Algenib" },
      },
      {
        key: "Rasalgethi",
        label: "Rasalgethi",
        value: "Rasalgethi",
        originData: { voice: "Rasalgethi", name: "Rasalgethi" },
      },
      {
        key: "Laomedeia",
        label: "Laomedeia",
        value: "Laomedeia",
        originData: { voice: "Laomedeia", name: "Laomedeia" },
      },
      {
        key: "Achernar",
        label: "Achernar",
        value: "Achernar",
        originData: { voice: "Achernar", name: "Achernar" },
      },
      {
        key: "Alnilam",
        label: "Alnilam",
        value: "Alnilam",
        originData: { voice: "Alnilam", name: "Alnilam" },
      },
      {
        key: "Schedar",
        label: "Schedar",
        value: "Schedar",
        originData: { voice: "Schedar", name: "Schedar" },
      },
      {
        key: "Gacrux",
        label: "Gacrux",
        value: "Gacrux",
        originData: { voice: "Gacrux", name: "Gacrux" },
      },
      {
        key: "Pulcherrima",
        label: "Pulcherrima",
        value: "Pulcherrima",
        originData: { voice: "Pulcherrima", name: "Pulcherrima" },
      },
      {
        key: "Achird",
        label: "Achird",
        value: "Achird",
        originData: { voice: "Achird", name: "Achird" },
      },
      {
        key: "Zubenelgenubi",
        label: "Zubenelgenubi",
        value: "Zubenelgenubi",
        originData: { voice: "Zubenelgenubi", name: "Zubenelgenubi" },
      },
    ],
  },
  {
    key: "custom",
    label: "Custom",
    value: "custom",
    children: [],
  },
];
