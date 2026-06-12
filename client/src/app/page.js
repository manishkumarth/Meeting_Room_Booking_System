"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import Link from "next/link";

const AMENITY_ICONS = {
  "Projector": "📽️",
  "Whiteboard": "📋",
  "Video Conferencing": "📹",
  "TV Screen": "📺",
  "Stage": "🎤",
  "PA System": "🔊",
};

export default function HomePage() {
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    api.getRooms()
      .then(setRooms)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <div className="flex items-center justify-center min-h-64">
      <div className="animate-spin h-8 w-8 border-4 border-brand-500 border-t-transparent rounded-full" />
    </div>
  );

  if (error) return (
    <div className="card text-center text-red-600">
      <p>⚠️ {error}</p>
      <p className="text-sm text-gray-500 mt-1">Make sure the backend is running on port 5000</p>
    </div>
  );

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Meeting Rooms</h1>
        <p className="text-gray-500 mt-1">Select a room to view availability and book a slot</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-6">
        {rooms.map((room) => (
          <Link key={room._id} href={`/rooms/${room._id}`}>
            <div className="card hover:shadow-md hover:border-brand-300 transition-all cursor-pointer group">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h2 className="text-xl font-bold text-gray-900 group-hover:text-brand-600 transition-colors">
                    {room.name}
                  </h2>
                  <p className="text-sm text-gray-500">{room.location} · {room.floor}</p>
                </div>
                <div className="bg-brand-50 text-brand-600 font-bold text-lg px-3 py-1 rounded-lg">
                  {room.capacity}
                  <span className="text-xs font-normal ml-1">pax</span>
                </div>
              </div>

              {room.amenities?.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-3">
                  {room.amenities.map((a) => (
                    <span key={a} className="bg-gray-100 text-gray-600 text-xs px-2 py-1 rounded-full">
                      {AMENITY_ICONS[a] || "✓"} {a}
                    </span>
                  ))}
                </div>
              )}

              {room.bufferMinutes > 0 && (
                <p className="text-xs text-amber-600 bg-amber-50 px-2 py-1 rounded">
                  ⏱ {room.bufferMinutes}-min cleanup buffer between bookings
                </p>
              )}

              <div className="mt-4 pt-4 border-t border-gray-100">
                <span className="text-brand-600 text-sm font-medium group-hover:underline">
                  View availability →
                </span>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
