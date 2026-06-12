const BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

async function apiFetch(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { "Content-Type": "application/json", ...options.headers },
    ...options,
  });

  let data;
  try {
    data = await res.json();
  } catch {
    data = { error: "Invalid response from server" };
  }

  if (!res.ok) {
    const err = new Error(data.error || `Request failed: ${res.status}`);
    err.status = res.status;
    err.data = data;
    throw err;
  }

  return data;
}

export const api = {
  getRooms: () => apiFetch("/api/rooms"),
  getRoom: (id) => apiFetch(`/api/rooms/${id}`),
  getAvailability: (id, date) => apiFetch(`/api/rooms/${id}/availability?date=${date}`),

  createBooking: (body) =>
    apiFetch("/api/bookings", { method: "POST", body: JSON.stringify(body) }),

  createRecurringBooking: (body) =>
    apiFetch("/api/bookings/recurring", { method: "POST", body: JSON.stringify(body) }),

  getUserBookings: (email) => apiFetch(`/api/bookings?email=${encodeURIComponent(email)}`),

  cancelBooking: (id, body = {}) =>
    apiFetch(`/api/bookings/${id}/cancel`, { method: "PATCH", body: JSON.stringify(body) }),

  rescheduleBooking: (id, body) =>
    apiFetch(`/api/bookings/${id}/reschedule`, { method: "PATCH", body: JSON.stringify(body) }),

  joinWaitlist: (body) =>
    apiFetch("/api/bookings/waitlist", { method: "POST", body: JSON.stringify(body) }),
};
