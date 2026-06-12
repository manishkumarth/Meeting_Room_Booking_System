import Link from "next/link";
import "./globals.css";

export const metadata = {
  title: "RoomIt — Meeting Room Booking",
  description: "Book meeting rooms at your office",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
          <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
            <Link href="/" className="flex items-center gap-2 font-bold text-xl text-brand-600">
              <span className="text-2xl">🏢</span> RoomIt
            </Link>
            <nav className="flex items-center gap-6 text-sm font-medium text-gray-600">
              <Link href="/" className="hover:text-brand-600 transition-colors">Rooms</Link>
              <Link href="/bookings" className="hover:text-brand-600 transition-colors">My Bookings</Link>
            </nav>
          </div>
        </header>
        <main className="max-w-6xl mx-auto px-4 py-8">
          {children}
        </main>
      </body>
    </html>
  );
}
