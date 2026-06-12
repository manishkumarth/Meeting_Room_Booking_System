"use client";
import { useState } from "react";
import { formatTime, minutesBetween } from "@/lib/utils";
import { api } from "@/lib/api";

export default function BookingModal({ room, date, selectedSlots, onClose, onSuccess }) {
  const [form, setForm] = useState({ name: "", email: "", title: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  if (!selectedSlots || selectedSlots.length === 0) return null;

  const sortedSlots = [...selectedSlots].sort();
  const startTime = sortedSlots[0];
  const lastSlot = sortedSlots[sortedSlots.length - 1];
  // endTime = last slot start + 30 mins
  const [lh, lm] = lastSlot.split(":").map(Number);
  const endMins = lh * 60 + lm + 30;
  const endTime = `${String(Math.floor(endMins / 60)).padStart(2, "0")}:${String(endMins % 60).padStart(2, "0")}`;

  const totalMinutes = sortedSlots.length * 30;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const result = await api.createBooking({
        roomId: room._id,
        date,
        startTime,
        endTime,
        bookedBy: { name: form.name, email: form.email },
        title: form.title,
      });
      onSuccess(result);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="p-6 border-b border-gray-100">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-gray-900">Confirm Booking</h2>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">&times;</button>
          </div>
        </div>

        <div className="p-6">
          <div className="bg-brand-50 rounded-lg p-4 mb-5 space-y-1">
            <p className="font-semibold text-brand-700">{room.name}</p>
            <p className="text-sm text-gray-600">📅 {date}</p>
            <p className="text-sm text-gray-600">
              🕐 {formatTime(startTime)} – {formatTime(endTime)}
              <span className="ml-2 text-gray-400">({totalMinutes} min)</span>
            </p>
            <p className="text-sm text-gray-600">📍 {room.location}, {room.floor}</p>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-3 mb-4 text-sm">
              ⚠️ {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="label">Your Name</label>
              <input
                className="input"
                required
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Jane Doe"
              />
            </div>
            <div>
              <label className="label">Email</label>
              <input
                className="input"
                type="email"
                required
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="jane@company.com"
              />
            </div>
            <div>
              <label className="label">Meeting Title</label>
              <input
                className="input"
                required
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="Sprint Planning"
              />
            </div>

            <div className="flex gap-3 pt-2">
              <button type="button" onClick={onClose} className="btn-secondary flex-1">Cancel</button>
              <button type="submit" disabled={loading} className="btn-primary flex-1">
                {loading ? "Booking..." : "Confirm Booking"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
