import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import React from "react";
import VoiceClone from "./voice-clone";
import FavoriteVoices from "./favorite-voices";
import { useTranslations } from "next-intl";

const VoicePage = () => {
  const t = useTranslations();
  return (
    <>
      <div className="container p-6 pb-0">
        <h1 className="mb-6 text-2xl font-bold sm:text-xl">
          {t("voice.title")}
        </h1>
      </div>
      <div className="container mx-auto p-4 sm:p-6">
        <Tabs defaultValue="my-voices" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="my-voices">
              {t("voice.voiceClone.myVoices")}
            </TabsTrigger>
            <TabsTrigger value="favorites">
              {t("voice.voiceClone.favorites")}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="my-voices" className="mt-6">
            <VoiceClone />
          </TabsContent>

          <TabsContent value="favorites" className="mt-6">
            <FavoriteVoices />
          </TabsContent>
        </Tabs>
      </div>
    </>
  );
};

export default VoicePage;
