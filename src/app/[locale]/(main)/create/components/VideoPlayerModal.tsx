import React, { useRef } from "react";
import { Dialog, DialogContent, DialogClose } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useTranslations } from "next-intl";

interface VideoPlayerModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  videoUrl: string | null;
}

export const VideoPlayerModal: React.FC<VideoPlayerModalProps> = ({
  open,
  onOpenChange,
  videoUrl,
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const t = useTranslations();
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[80vh] max-w-[80vw] border-0 bg-[#1c1c1c] p-6 sm:max-w-[700px] md:max-w-[800px] lg:max-w-[900px] xl:max-w-[1200px]">
        <div className="flex h-full flex-col items-center">
          <div className="aspect-video min-h-0 w-full flex-1 overflow-hidden rounded">
            {videoUrl && (
              <video
                ref={videoRef}
                src={videoUrl}
                className="h-full w-full object-contain"
                controls
                autoPlay
                playsInline
              />
            )}
          </div>
          <div className="mt-4 flex w-full flex-shrink-0 justify-end">
            <DialogClose asChild>
              <Button
                variant="outline"
                className="border-gray-600 bg-gray-800 text-white hover:bg-gray-700"
                onClick={() => {
                  if (videoRef.current) {
                    videoRef.current.pause();
                  }
                }}
              >
                {t("avatar.close")}
              </Button>
            </DialogClose>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default VideoPlayerModal;
