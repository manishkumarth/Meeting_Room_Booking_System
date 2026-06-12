"use client";
import { useState } from "react";
import { api } from "@/lib/api";
import { formatDate, formatTime, isPast } from "@/lib/utils";

const STATUS_STYLES = {
  confirmed: "bg-green-100 text-green-700 border-green-200",
  "cancelled-refundable": "bg-blue-100 text-blue-700 border-blue-200",
  "cancelled-non-refundable": "bg-gray-100 text-gray-600 border-gray-200",
};

const STATUS_LABELS = {
  confirmed: "✅ Confirmed",
  "cancelled-refundable": "💰 Cancelled (Refundable)",
  "cancelled-non-refundable": "❌ Cancelled (Non-refundable)",
};

export default function BookingsPage() {
  const [email, setEmail] = useState("");
  const [bookings, setBookings] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [cancellingId, setCancellingId] = useState(null);
  const [cancelMsg, setCancelMsg] = useState(null);
  const [showCancelConfirm, setShowCancelConfirm] = useState(null); // bookingId

  const fetchBookings = async (e) => {
    e?.preventDefault();
    if (!email.trim()) return;
    setLoading(true);
    setError(null);
    setCancelMsg(null);
    try {
      const data = await api.getUserBookings(email.trim());
      setBookings(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = async (booking, cancelType = "single") => {
    setCancellingId(booking._id);
    setShowCancelConfirm(null);
    try {
      const result = await api.cancelBooking(booking._id, { cancelType });
      const refundStr = result.refundable ? "Refund will be processed." : "Non-refundable (within 2-hour window).";
      setCancelMsg(`Booking cancelled. ${refundStr}`);
      // Refresh list
      await fetchBookings();
    } catch (err) {
      setError(err.message);
    } finally {
      setCancellingId(null);
    }
  };

  const grouped = bookings
    ? {
        upcoming: bookings.filter((b) => b.status === "confirmed" && !isPast(b.date, b.startTime)),
        past: bookings.filter((b) => b.status === "confirmed" && isPast(b.date, b.startTime)),
        cancelled: bookings.filter((b) => b.status !== "confirmed"),
      }
    : null;

  return (
    <div className="max-w-3xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">My Bookings</h1>
        <p className="text-gray-500 mt-1">Look up your bookings by email address</p>
      </div>

      {/* Email lookup */}
      <div className="card mb-6">
        <form onSubmit={fetchBookings} className="flex gap-3">
          <input
            className="input flex-1"
            type="email"
            placeholder="your@email.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <button type="submit" disabled={loading} className="btn-primary whitespace-nowrap">
            {loading ? "Loading…" : "Find Bookings"}
          </button>
        </form>
      </div>

      {/* Messages */}
      {cancelMsg && (
        <div className="bg-blue-50 border border-blue-200 text-blue-700 rounded-lg p-3 mb-4 text-sm">
          ℹ️ {cancelMsg}
        </div>
      )}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-3 mb-4 text-sm">
          ⚠️ {error}
        </div>
      )}

      {/* Results */}
      {grouped && (
        <div className="space-y-8">
          {/* Upcoming */}
          <Section title="Upcoming" count={grouped.upcoming.length}>
            {grouped.upcoming.length === 0 ? (
              <p className="text-gray-400 text-sm">No upcoming bookings</p>
            ) : (
              grouped.upcoming.map((b) => (
                <BookingCard
                  key={b._id}
                  booking={b}
                  onCancelClick={() => setShowCancelConfirm(b._id)}
                  cancelling={cancellingId === b._id}
                  confirmOpen={showCancelConfirm === b._id}
                  onConfirmCancel={(type) => handleCancel(b, type)}
                  onDismissConfirm={() => setShowCancelConfirm(null)}
                />
              ))
            )}
          </Section>

          {/* Past */}
          {grouped.past.length > 0 && (
            <Section title="Past (Completed)" count={grouped.past.length}>
              {grouped.past.map((b) => (
                <BookingCard key={b._id} booking={b} readonly />
              ))}
            </Section>
          )}

          {/* Cancelled */}
          {grouped.cancelled.length > 0 && (
            <Section title="Cancelled" count={grouped.cancelled.length}>
              {grouped.cancelled.map((b) => (
                <BookingCard key={b._id} booking={b} readonly />
              ))}
            </Section>
          )}
        </div>
      )}
    </div>
  );
}

function Section({ title, count, children }) {
  return (
    <div>
      <h2 className="text-lg font-semibold text-gray-700 mb-3">
        {title} <span className="text-sm font-normal text-gray-400">({count})</span>
      </h2>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

function BookingCard({ booking, onCancelClick, cancelling, confirmOpen, onConfirmCancel, onDismissConfirm, readonly }) {
  const pastBooking = isPast(booking.date, booking.startTime);
  const canCancel = !readonly && booking.status === "confirmed" && !pastBooking;

  return (
    <div className="card">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className={`text-xs font-medium border px-2 py-0.5 rounded-full ${STATUS_STYLES[booking.status]}`}>
              {STATUS_LABELS[booking.status]}
            </span>
            {booking.recurringGroupId && (
              <span className="text-xs bg-purple-50 text-purple-600 border border-purple-200 px-2 py-0.5 rounded-full">
                🔁 Recurring
              </span>
            )}
          </div>
          <h3 className="font-semibold text-gray-900">{booking.title}</h3>
          <p className="text-sm text-gray-600">
            {booking.room?.name} · {booking.room?.location}
          </p>
          <p className="text-sm text-gray-500">
            📅 {formatDate(booking.date)} · 🕐 {formatTime(booking.startTime)} – {formatTime(booking.endTime)}
          </p>
        </div>

        {canCancel && (
          <button
            onClick={onCancelClick}
            disabled={cancelling}
            className="btn-danger text-sm shrink-0"
          >
            {cancelling ? "Cancelling…" : "Cancel"}
          </button>
        )}
      </div>

      {/* Cancel confirmation dialog */}
      {confirmOpen && (
        <div className="mt-4 pt-4 border-t border-gray-100 bg-red-50 -mx-6 -mb-6 px-6 pb-6 rounded-b-xl">
          <p className="text-sm font-medium text-gray-800 mb-3">Are you sure you want to cancel this booking?</p>
          <div className="flex flex-wrap gap-2">
            {booking.recurringGroupId ? (
              <>
                <button onClick={() => onConfirmCancel("single")} className="btn-danger text-sm">
                  Cancel this occurrence only
                </button>
                <button onClick={() => onConfirmCancel("this_and_future")} className="bg-red-700 hover:bg-red-800 text-white text-sm px-4 py-2 rounded-lg">
                  Cancel this & future
                </button>
              </>
            ) : (
              <button onClick={() => onConfirmCancel("single")} className="btn-danger text-sm">
                Yes, cancel booking
              </button>
            )}
            <button onClick={onDismissConfirm} className="btn-secondary text-sm">
              Keep booking
            </button>
          </div>
          <p className="text-xs text-gray-500 mt-2">
            ℹ️ Refund eligibility is determined by the server at cancellation time (≥2 hours before start).
          </p>
        </div>
      )}
    </div>
  );
}
