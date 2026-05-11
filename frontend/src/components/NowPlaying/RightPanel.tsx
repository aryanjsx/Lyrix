import { useState } from "react";
import { motion } from "framer-motion";
import { SyncedLyrics } from "@/components/player/SyncedLyrics";
import { NowPlayingQueue } from "@/components/player/NowPlayingQueue";
import { SimilarList } from "./SimilarTrackRow";

type Tab = "lyrics" | "queue" | "similar";

const TABS: { id: Tab; label: string }[] = [
  { id: "lyrics", label: "LYRICS" },
  { id: "queue", label: "QUEUE" },
  { id: "similar", label: "SIMILAR" },
];

export function RightPanel() {
  const [activeTab, setActiveTab] = useState<Tab>("similar");

  return (
    <div
      className="flex h-full flex-col"
      style={{
        borderLeft: "1px solid var(--np-border)",
        padding: "32px 0 0",
      }}
    >
      {/* Tab Bar */}
      <div
        className="relative flex flex-shrink-0"
        style={{ borderBottom: "1px solid var(--np-border)", margin: "0 28px" }}
      >
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className="relative flex-1 pb-3 text-center text-[12px] font-semibold tracking-[0.1em] transition-colors duration-150"
            style={{
              fontFamily: "var(--font-dm-sans, 'DM Sans'), sans-serif",
              color: activeTab === tab.id ? "var(--np-text-primary)" : "var(--np-text-muted)",
              background: "none",
              border: "none",
              cursor: "pointer",
            }}
          >
            {tab.label}
            {activeTab === tab.id && (
              <motion.span
                layoutId="npActiveTab"
                className="absolute bottom-0 left-0 right-0 h-[2px] rounded-full"
                style={{ background: "var(--np-accent)" }}
                transition={{ type: "spring", stiffness: 400, damping: 30 }}
              />
            )}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="np-right-scroll flex-1 overflow-y-auto px-4 pt-4" style={{ minHeight: 0 }}>
        {activeTab === "lyrics" && <SyncedLyrics />}
        {activeTab === "queue" && <NowPlayingQueue />}
        {activeTab === "similar" && <SimilarList />}
      </div>
    </div>
  );
}

interface MobileBottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
}

export function MobileRightPanel({ isOpen, onClose }: MobileBottomSheetProps) {
  const [activeTab, setActiveTab] = useState<Tab>("similar");

  return (
    <>
      {/* Backdrop */}
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 z-[60]"
          style={{ background: "rgba(0,0,0,0.5)" }}
        />
      )}

      {/* Sheet */}
      <motion.div
        initial={{ y: "100%" }}
        animate={{ y: isOpen ? "0%" : "100%" }}
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
        className="fixed bottom-0 left-0 right-0 z-[61] flex flex-col rounded-t-2xl"
        style={{
          height: "70vh",
          background: "var(--np-bg-surface)",
          border: "1px solid var(--np-border)",
          borderBottom: "none",
        }}
      >
        {/* Drag handle */}
        <div className="flex justify-center py-3">
          <div className="h-1 w-10 rounded-full" style={{ background: "var(--np-border-hover)" }} />
        </div>

        {/* Tab Bar */}
        <div
          className="relative flex flex-shrink-0"
          style={{ borderBottom: "1px solid var(--np-border)", margin: "0 20px" }}
        >
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className="relative flex-1 pb-3 text-center text-[12px] font-semibold tracking-[0.1em] transition-colors duration-150"
              style={{
                fontFamily: "var(--font-dm-sans, 'DM Sans'), sans-serif",
                color: activeTab === tab.id ? "var(--np-text-primary)" : "var(--np-text-muted)",
                background: "none",
                border: "none",
                cursor: "pointer",
              }}
            >
              {tab.label}
              {activeTab === tab.id && (
                <motion.span
                  layoutId="npMobileActiveTab"
                  className="absolute bottom-0 left-0 right-0 h-[2px] rounded-full"
                  style={{ background: "var(--np-accent)" }}
                  transition={{ type: "spring", stiffness: 400, damping: 30 }}
                />
              )}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="np-right-scroll flex-1 overflow-y-auto px-4 pt-3" style={{ minHeight: 0 }}>
          {activeTab === "lyrics" && <SyncedLyrics />}
          {activeTab === "queue" && <NowPlayingQueue />}
          {activeTab === "similar" && <SimilarList />}
        </div>
      </motion.div>
    </>
  );
}
