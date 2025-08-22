"use client";

import React, { useEffect, useState } from "react";
import { useAtom } from "jotai";
import { welcomeModalStoreAtom } from "@/stores/slices/welcome_modal";
import { HistoryListView } from "./components/HistoryListView";
import { CreateView } from "./components/CreateView";

const CreatePage = () => {
  // View state management
  const [currentView, setCurrentView] = useState<"list" | "create">("list");
  const [welcomeModalWasOpen, setWelcomeModalWasOpen] = useState(false);

  // Welcome modal state
  const [welcomeModalStore] = useAtom(welcomeModalStoreAtom);

  // Monitor welcome modal state changes
  useEffect(() => {
    console.log("🔍 Welcome modal effect:", {
      isOpen: welcomeModalStore.isOpen,
      wasOpen: welcomeModalWasOpen,
      currentView,
    });

    if (welcomeModalStore.isOpen) {
      console.log("📋 Setting welcomeModalWasOpen to true");
      setWelcomeModalWasOpen(true);
    } else if (welcomeModalWasOpen && !welcomeModalStore.isOpen) {
      console.log("✅ Modal closed, switching to create view");
      console.log("🎬 Switching to create view");
      setCurrentView("create");
      setWelcomeModalWasOpen(false);
    }
  }, [welcomeModalStore.isOpen, welcomeModalWasOpen, currentView]);

  const handleSwitchToCreate = () => {
    setCurrentView("create");
  };

  const handleBackToList = () => {
    setCurrentView("list");
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-background">
      {currentView === "list" ? (
        <HistoryListView onSwitchToCreate={handleSwitchToCreate} />
      ) : (
        <CreateView onBackToList={handleBackToList} />
      )}
    </div>
  );
};

export default CreatePage;
