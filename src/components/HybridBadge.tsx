import type { InferenceSource } from "../types";

export default function HybridBadge({ source }: { source: InferenceSource }) {
  const onDevice = source === "ON_DEVICE";
  return (
    <div className={onDevice ? "badge badge-device" : "badge badge-cloud"}>
      <span className="badge-dot" aria-hidden="true" />
      <div className="badge-text">
        <span className="badge-title">
          {onDevice ? "ON-DEVICE · Gemini Nano" : "CLOUD · Gemini"}
        </span>
        <span className="badge-sub">
          {onDevice
            ? "Answered privately on this device. No data left the browser and it cost nothing."
            : "Cloud fallback. This device has no on-device model, so Gemini in the cloud answered."}
        </span>
      </div>
      <span className="badge-source">inferenceSource: {source}</span>
    </div>
  );
}
