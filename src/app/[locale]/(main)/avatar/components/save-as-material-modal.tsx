import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useAvatarDb } from "@/hooks/db/use-avatar-db";
import { toast } from "sonner";
import { useTranslations } from "next-intl";

interface SaveAsMaterialModalProps {
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
  selectedAvatarId: string | null;
  setSelectedAvatarId: (avatarId: string | null) => void;
  title: string;
  onSave: (avatarId: string) => Promise<void>;
}

export const SaveAsMaterialModal = ({
  isOpen,
  setIsOpen,
  selectedAvatarId,
  setSelectedAvatarId,
  title,
  onSave,
}: SaveAsMaterialModalProps) => {
  const { avatarData } = useAvatarDb();
  const t = useTranslations();
  const handleSave = async () => {
    if (!selectedAvatarId) {
      toast.error("请选择一个数字人");
      return;
    }

    try {
      await onSave(selectedAvatarId);
      toast(t("avatar.saveSuccess"));

      setIsOpen(false);
      setSelectedAvatarId(null);
    } catch (error) {
      console.error("保存失败:", error);
      toast.error(t("avatar.saveFail"));
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="flex max-h-[80vh] max-w-md flex-col">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>

        <div className="max-h-[500px] min-h-[300px] flex-1 overflow-y-auto">
          {avatarData && avatarData.length > 0 ? (
            <div className="grid grid-cols-2 gap-4 py-4">
              {avatarData.map((avatar) => (
                <div key={avatar.id} className="space-y-2">
                  <div
                    className={`relative flex h-32 w-full cursor-pointer items-center justify-center overflow-hidden rounded-lg border-2 transition-colors ${
                      selectedAvatarId === avatar.id
                        ? "border-primary bg-primary/10"
                        : "border-border hover:border-primary/50"
                    }`}
                    onClick={() =>
                      setSelectedAvatarId(
                        selectedAvatarId === avatar.id ? null : avatar.id
                      )
                    }
                  >
                    {avatar.pic_url ? (
                      <img
                        src={
                          Array.isArray(avatar.pic_url)
                            ? avatar.pic_url[0]
                            : avatar.pic_url
                        }
                        alt={avatar.name}
                        className="max-h-full max-w-full object-contain"
                      />
                    ) : (
                      <span className="text-sm text-muted-foreground">
                        数字人
                      </span>
                    )}
                    {selectedAvatarId === avatar.id && (
                      <div className="absolute -top-2 left-1/2 -translate-x-1/2 transform">
                        <div className="h-0 w-0 border-b-4 border-l-4 border-r-4 border-solid border-b-primary border-l-transparent border-r-transparent"></div>
                      </div>
                    )}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {avatar.name}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex h-full min-h-[300px] items-center justify-center">
              <span className="text-muted-foreground">
                {t("avatar.noAvatar")}
              </span>
            </div>
          )}
        </div>

        <div className="flex flex-shrink-0 justify-end gap-3 border-t bg-background pt-4">
          <Button variant="outline" onClick={() => setIsOpen(false)}>
            {t("avatar.cancel")}
          </Button>
          <Button disabled={selectedAvatarId === null} onClick={handleSave}>
            {t("avatar.save")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
