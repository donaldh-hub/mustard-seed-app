import type { QueryClient } from "@tanstack/react-query";

let syncInProgress = false;
let pendingSync = false;

async function runSyncCycle(qc: QueryClient, userId: string): Promise<void> {
  console.log("[SYNC] invalidating progress queries");

  qc.invalidateQueries({ queryKey: ["user", userId] });
  qc.invalidateQueries({ queryKey: ["garden", userId] });
  qc.invalidateQueries({ queryKey: ["consistency", userId] });
  qc.invalidateQueries({ queryKey: ["entries", userId] });
  qc.invalidateQueries({ queryKey: ["weekly-review-status", userId] });
  qc.invalidateQueries({ queryKey: ["messages", userId] });

  console.log("[SYNC] refetch started");

  await Promise.all([
    qc.refetchQueries({ queryKey: ["user", userId] }),
    qc.refetchQueries({ queryKey: ["garden", userId] }),
    qc.refetchQueries({ queryKey: ["consistency", userId] }),
    qc.refetchQueries({ queryKey: ["entries", userId] }),
  ]);

  console.log("[SYNC] refetch resolved");
  console.log("[SYNC] progress state synchronized");
}

export async function syncUserProgressState(
  qc: QueryClient,
  userId: string,
  onComplete: () => void
): Promise<void> {
  if (syncInProgress) {
    pendingSync = true;
    return;
  }

  syncInProgress = true;

  try {
    await runSyncCycle(qc, userId);
  } finally {
    syncInProgress = false;
    onComplete();
    if (pendingSync) {
      pendingSync = false;
      await syncUserProgressState(qc, userId, onComplete);
    }
  }
}
