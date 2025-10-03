let StreamingAvatar, StreamingEvents, TaskType, AvatarQuality;

async function loadSDK() {
  if (StreamingAvatar) return;

  // Primary: esm.sh (solid ESM for browsers)
  try {
    const m = await import("https://esm.sh/@heygen/streaming-avatar@2.1.0?bundle");
    StreamingAvatar = m.StreamingAvatar;
    StreamingEvents  = m.StreamingEvents;
    TaskType         = m.TaskType;
    AvatarQuality    = m.AvatarQuality;
  } catch (e) {
    console.warn("[sdk] esm.sh failed, trying jsDelivr ESM fallback…", e);
    // Fallback: jsDelivr’s native ESM file
    const m = await import("https://cdn.jsdelivr.net/npm/@heygen/streaming-avatar@2.1.0/lib/index.esm.js");
    StreamingAvatar = m.StreamingAvatar || m.default?.StreamingAvatar || m.default;
    StreamingEvents  = m.StreamingEvents  || m.default?.StreamingEvents;
    TaskType         = m.TaskType         || m.default?.TaskType;
    AvatarQuality    = m.AvatarQuality    || m.default?.AvatarQuality;
  }

  if (typeof StreamingAvatar !== "function") {
    console.error({ StreamingAvatar, StreamingEvents, TaskType, AvatarQuality });
    throw new Error("SDK loaded but StreamingAvatar is not a constructor");
  }
}
