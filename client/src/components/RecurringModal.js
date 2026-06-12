"use client";
import { useState } from "react";
import { formatTime } from "@/lib/utils";
import { api } from "@/lib/api";

export default function RecurringModal({ room, date, selectedSlots, onClose, onSuccess }) {
  const [form, setForm] = useState({ name: "", email: "", title: "", weeks: 4 });
  const [step, setStep] = useState("form"); // "form" | "conflict" | "loading"
  const [conflictData, setConflictData] = useState(null);
  const [error, setError] = useState(null);

  const sortedSlots = [...selectedSlots].sort();
  const startTime = sortedSlots[0];
  const lastSlot = sortedSlots[sortedSlots.length - 1];
  const [lh, lm] = lastSlot.split(":").map(Number);
  const endMins = lh * 60 + lm + 30;
  const endTime = `${String(Math.floor(endMins / 60)).padStart(2, "0")}:${String(endMins % 60).padStart(2, "0")}`;

  const handleCheck = async (e) => {
    e.preventDefault();
    setError(null);
    setStep("loading");
    try {
      const data = await api.createRecurringBooking({
        roomId: room._id,
        startDate: date,
        startTime,
        endTime,
        bookedBy: { name: form.name, email: form.email },
        title: form.title,
        weeks: Number(form.weeks),
        onConflict: "report",
      });
      if (data.hasConflicts) {
        setConflictData(data);
        setStep("conflict");
      } else {
        // No conflicts — book all
        await bookWith("book_free");
      }
    } catch (err) {
      setError(err.message);
      setStep("form");
    }
  };

  const bookWith = async (onConflict) => {
    setStep("loading");
    try {
      const result = await api.createRecurringBooking({
        roomId: room._id,
        startDate: date,
        startTime,
        endTime,
        bookedBy: { name: form.name, email: form.email },
        title: form.title,
        weeks: Number(form.weeks),
        onConflict,
      });
      onSuccess(`✅ Recurring booking created for ${result.bookedDates.length} date(s).${result.skippedDates?.length ? ` Skipped ${result.skippedDates.length} conflicting date(s).` : ""}`);
    } catch (err) {
      setError(err.message);
      setStep("conflict");
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
        <div className="p-6 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-xl font-bold text-gray-900">Recurring Booking</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">&times;</button>
        </div>

        <div className="p-6">
          <div className="bg-brand-50 rounded-lg p-3 mb-4 text-sm space-y-1">
            <p className="font-medium text-brand-700">{room.name} · {formatTime(startTime)} – {formatTime(endTime)}</p>
            <p className="text-gray-500">Starting {date}, repeating weekly</p>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-3 mb-4 text-sm">⚠️ {error}</div>
          )}

          {step === "loading" && (
            <div className="text-center py-8">
              <div className="animate-spin h-8 w-8 border-4 border-brand-500 border-t-transparent rounded-full mx-auto mb-3" />
              <p className="text-gray-500 text-sm">Checking availability across all weeks…</p>
            </div>
          )}

          {step === "form" && (
            <form onSubmit={handleCheck} className="space-y-4">
              <div>
                <label className="label">Your Name</label>
                <input className="input" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Jane Doe" />
              </div>
              <div>
                <label className="label">Email</label>
                <input className="input" type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="jane@company.com" />
              </div>
              <div>
                <label className="label">Meeting Title</label>
                <input className="input" required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Weekly Sync" />
              </div>
              <div>
                <label className="label">Number of Weeks</label>
                <select className="input" value={form.weeks} onChange={(e) => setForm({ ...form, weeks: e.target.value })}>
                  {[2, 3, 4, 6, 8, 12].map((w) => <option key={w} value={w}>{w} weeks</option>)}
                </select>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={onClose} className="btn-secondary flex-1">Cancel</button>
                <button type="submit" className="btn-primary flex-1">Check Availability</button>
              </div>
            </form>
          )}

          {step === "conflict" && conflictData && (
            <div>
              <div className="mb-4">
                <p className="font-semibold text-gray-900 mb-2">Some dates have conflicts</p>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <p className="text-green-700 font-medium mb-1">✅ Free ({conflictData.freeDates.length})</p>
                    {conflictData.freeDates.map((d) => <p key={d} className="text-gray-600">{d}</p>)}
                  </div>
                  <div>
                    <p className="text-red-700 font-medium mb-1">❌ Conflicting ({conflictData.conflictingDates.length})</p>
                    {conflictData.conflictingDates.map((d) => <p key={d} className="text-gray-500 line-through">{d}</p>)}
                  </div>
                </div>
              </div>
              <div className="space-y-2">
                <button onClick={() => bookWith("book_free")} className="btn-primary w-full">
                  Book {conflictData.freeDates.length} free date(s) only
                </button>
                <button onClick={() => bookWith("cancel_all")} className="btn-secondary w-full text-red-600">
                  Cancel — don't book any
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
