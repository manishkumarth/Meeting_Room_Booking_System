"use client";
import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { api } from "@/lib/api";
import { todayStr, formatDate, formatTime } from "@/lib/utils";
import SlotGrid from "@/components/SlotGrid";
import BookingModal from "@/components/BookingModal";
import RecurringModal from "@/components/RecurringModal";

export default function RoomPage() {
  const { id } = useParams();
  const [room, setRoom] = useState(null);
  const [date, setDate] = useState(todayStr());
  const [slots, setSlots] = useState([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [selectedSlots, setSelectedSlots] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [showRecurring, setShowRecurring] = useState(false);
  const [successMsg, setSuccessMsg] = useState(null);
  const [error, setError] = useState(null);

  const fetchAvailability = useCallback(async () => {
    if (!id || !date) return;
    setLoadingSlots(true);
    setError(null);
    setSelectedSlots([]);
    try {
      const data = await api.getAvailability(id, date);
      setRoom(data.room);
      setSlots(data.slots);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoadingSlots(false);
    }
  }, [id, date]);

  useEffect(() => {
    fetchAvailability();
  }, [fetchAvailability]);

  const handleSlotToggle = (time) => {
    setSelectedSlots((prev) => {
      if (prev.includes(time)) return prev.filter((t) => t !== time);
      // Enforce consecutive slots
      const newSelected = [...prev, time].sort();
      // Check consecutiveness (each slot 30 min apart)
      for (let i = 1; i < newSelected.length; i++) {
        const [ph, pm] = newSelected[i - 1].split(":").map(Number);
        const [ch, cm] = newSelected[i].split(":").map(Number);
        const diff = (ch * 60 + cm) - (ph * 60 + pm);
        if (diff !== 30) {
          // Non-consecutive: reset to just this slot
          return [time];
        }
      }
      return newSelected;
    });
  };

  const handleBookingSuccess = (result) => {
    setShowModal(false);
    setSelectedSlots([]);
    setSuccessMsg(`✅ Booked ${result.slotsBooked} slot(s) successfully!`);
    setTimeout(() => setSuccessMsg(null), 4000);
    fetchAvailability();
  };

  const selectedCount = selectedSlots.length;
  const totalMinutes = selectedCount * 30;

  return (
    <div>
      {/* Back link */}
      <Link href="/" className="text-sm text-gray-500 hover:text-brand-600 mb-4 inline-flex items-center gap-1">
        ← All Rooms
      </Link>

      {/* Room header */}
      {room && (
        <div className="card mb-6">
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{room.name}</h1>
              <p className="text-gray-500">{room.location} · {room.floor} · {room.capacity} people</p>
            </div>
            {room.bufferMinutes > 0 && (
              <span className="text-xs bg-amber-50 text-amber-700 border border-amber-200 px-2 py-1 rounded-full">
                {room.bufferMinutes}min buffer
              </span>
            )}
          </div>
        </div>
      )}

      {/* Date picker */}
      <div className="card mb-6">
        <div className="flex flex-wrap items-center gap-4">
          <div>
            <label className="label">Select Date</label>
            <input
              type="date"
              value={date}
              min={todayStr()}
              onChange={(e) => setDate(e.target.value)}
              className="input w-auto"
            />
          </div>
          <div className="pt-5 text-sm text-gray-500">
            {formatDate(date)}
          </div>
        </div>
      </div>

      {/* Alerts */}
      {successMsg && (
        <div className="bg-green-50 border border-green-200 text-green-700 rounded-lg p-3 mb-4 text-sm">
          {successMsg}
        </div>
      )}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-3 mb-4 text-sm">
          ⚠️ {error}
        </div>
      )}

      {/* Slot grid */}
      <div className="card mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">Availability</h2>
          <button onClick={fetchAvailability} className="text-sm text-brand-600 hover:underline">
            ↻ Refresh
          </button>
        </div>
        <SlotGrid
          slots={slots}
          selectedSlots={selectedSlots}
          onSlotToggle={handleSlotToggle}
          loading={loadingSlots}
        />
      </div>

      {/* Booking actions */}
      {selectedCount > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-white border border-gray-200 shadow-2xl rounded-2xl px-6 py-4 flex items-center gap-4 z-40">
          <div>
            <p className="font-semibold text-gray-900">{selectedCount} slot{selectedCount > 1 ? "s" : ""} selected</p>
            <p className="text-sm text-gray-500">{totalMinutes} min · {formatTime(selectedSlots[0])} – {(() => {
              const lastSlot = [...selectedSlots].sort().pop();
              const [h, m] = lastSlot.split(":").map(Number);
              const endMins = h * 60 + m + 30;
              return `${String(Math.floor(endMins / 60)).padStart(2, "0")}:${String(endMins % 60).padStart(2, "0")}`;
            })()}</p>
          </div>
          <button onClick={() => setShowModal(true)} className="btn-primary">
            Book Now
          </button>
          <button onClick={() => setShowRecurring(true)} className="btn-secondary text-sm">
            Recurring
          </button>
          <button onClick={() => setSelectedSlots([])} className="text-gray-400 hover:text-gray-600 text-xl leading-none">&times;</button>
        </div>
      )}

      {/* Modals */}
      {showModal && room && (
        <BookingModal
          room={room}
          date={date}
          selectedSlots={selectedSlots}
          onClose={() => setShowModal(false)}
          onSuccess={handleBookingSuccess}
        />
      )}

      {showRecurring && room && (
        <RecurringModal
          room={room}
          date={date}
          selectedSlots={selectedSlots}
          onClose={() => setShowRecurring(false)}
          onSuccess={(msg) => {
            setShowRecurring(false);
            setSelectedSlots([]);
            setSuccessMsg(msg);
            setTimeout(() => setSuccessMsg(null), 5000);
            fetchAvailability();
          }}
        />
      )}
    </div>
  );
}
