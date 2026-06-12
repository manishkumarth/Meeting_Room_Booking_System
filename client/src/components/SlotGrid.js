"use client";
import { formatTime } from "@/lib/utils";

const STATUS_STYLES = {
  available: "bg-green-50 border-green-200 text-green-700 hover:bg-green-100 cursor-pointer",
  selected: "bg-brand-500 border-brand-600 text-white cursor-pointer",
  booked: "bg-red-50 border-red-200 text-red-400 cursor-not-allowed",
  buffer: "bg-amber-50 border-amber-200 text-amber-500 cursor-not-allowed",
  past: "bg-gray-50 border-gray-200 text-gray-300 cursor-not-allowed",
};

const STATUS_LABELS = {
  available: "Available",
  selected: "Selected",
  booked: "Booked",
  buffer: "Buffer",
  past: "Past",
};

export default function SlotGrid({ slots, selectedSlots, onSlotToggle, loading }) {
  if (loading) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
        {Array.from({ length: 24 }).map((_, i) => (
          <div key={i} className="h-14 rounded-lg bg-gray-100 animate-pulse" />
        ))}
      </div>
    );
  }

  const now = new Date();

  return (
    <div>
      {/* Legend */}
      <div className="flex flex-wrap gap-3 mb-4 text-xs">
        {Object.entries(STATUS_LABELS).map(([status, label]) => (
          <div key={status} className="flex items-center gap-1.5">
            <div className={`w-3 h-3 rounded border ${STATUS_STYLES[status].split(" ").filter(c => c.startsWith("bg-") || c.startsWith("border-")).join(" ")}`} />
            <span className="text-gray-600">{label}</span>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
        {slots.map((slot) => {
          const isSelected = selectedSlots.includes(slot.time);
          const isPast = slot.status === "available" && (() => {
            // rough check: if today, compare time
            return false; // handled server-side via date filtering
          })();

          let effectiveStatus = slot.status;
          if (isSelected) effectiveStatus = "selected";

          const isClickable = slot.status === "available" || isSelected;

          return (
            <button
              key={slot.time}
              disabled={!isClickable}
              onClick={() => isClickable && onSlotToggle(slot.time)}
              className={`border rounded-lg px-3 py-2.5 text-sm font-medium transition-all ${STATUS_STYLES[effectiveStatus]}`}
              title={slot.bookedBy ? `Booked by ${slot.bookedBy}` : undefined}
            >
              <div className="font-semibold">{formatTime(slot.time)}</div>
              {slot.bookedBy && (
                <div className="text-xs opacity-75 truncate">{slot.bookedBy}</div>
              )}
              {effectiveStatus === "buffer" && (
                <div className="text-xs opacity-75">Cleanup</div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
