import * as Dialog from "@radix-ui/react-dialog";
import { useState } from "react";
import { motion } from "framer-motion";
import * as playlistApi from "@/services/playlistApi";
import { captureError } from "@/services/telemetry";
import { analytics, EVENTS } from "@/services/analyticsService";
import { useLyrixStore } from "@/store";

export interface CreatePlaylistModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: (playlist: { id: string; name: string }) => void;
}

export function CreatePlaylistModal({
  open,
  onOpenChange,
  onCreated,
}: CreatePlaylistModalProps) {
  const addPlaylist = useLyrixStore((s) => s.addPlaylist);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function reset() {
    setName("");
    setDescription("");
    setError(null);
    setSubmitting(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (trimmed.length < 1 || trimmed.length > 100) {
      setError("Name must be 1–100 characters.");
      return;
    }
    if (description.length > 500) {
      setError("Description must be at most 500 characters.");
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const created = await playlistApi.createPlaylist({
        name: trimmed,
        description: description.trim() || undefined,
      });
      addPlaylist(created);
      onCreated?.({ id: created.id, name: created.name });
      analytics.track(EVENTS.PLAYLIST_CREATED, { playlist_id: created.id });
      reset();
      onOpenChange(false);
    } catch (err) {
      captureError(err instanceof Error ? err : new Error(String(err)));
      setError(err instanceof Error ? err.message : "Could not create playlist");
      setSubmitting(false);
    }
  }

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(next) => {
        if (!next) reset();
        onOpenChange(next);
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="data-[state=open]:animate-in fade-in fixed inset-0 z-[100] bg-black/50 backdrop-blur-sm" />
        <Dialog.Content className="fixed top-1/2 left-1/2 z-[100] w-[min(calc(100vw-2rem),440px)] max-h-[min(90vh,560px)] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-lg border border-zinc-200 bg-white p-5 shadow-lg outline-none focus-visible:ring-2 focus-visible:ring-purple-500 dark:border-zinc-800 dark:bg-zinc-900">
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
          >
            <Dialog.Title className="text-lg font-semibold text-zinc-900 dark:text-white">
              New playlist
            </Dialog.Title>
            <Dialog.Description className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
              Give your playlist a name. Description is optional.
            </Dialog.Description>

            <form onSubmit={handleSubmit} className="mt-4 flex flex-col gap-4">
              <div>
                <label
                  htmlFor="playlist-name"
                  className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400"
                >
                  Name <span className="text-red-500">*</span>
                </label>
                <input
                  id="playlist-name"
                  type="text"
                  required
                  minLength={1}
                  maxLength={100}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
                  autoComplete="off"
                />
              </div>
              <div>
                <label
                  htmlFor="playlist-desc"
                  className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400"
                >
                  Description
                </label>
                <textarea
                  id="playlist-desc"
                  rows={3}
                  maxLength={500}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="mt-1 w-full resize-y rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
                />
                <p className="mt-1 text-right text-xs text-zinc-400">
                  {description.length}/500
                </p>
              </div>

              {error && (
                <p className="text-sm text-red-600 dark:text-red-400" role="alert">
                  {error}
                </p>
              )}

              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <Dialog.Close asChild>
                  <button
                    type="button"
                    className="rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-2 text-sm font-medium text-zinc-800 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                  >
                    Cancel
                  </button>
                </Dialog.Close>
                <button
                  type="submit"
                  disabled={submitting}
                  className="rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium text-white hover:bg-purple-700 disabled:opacity-60"
                >
                  {submitting ? "Creating…" : "Create"}
                </button>
              </div>
            </form>
          </motion.div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
