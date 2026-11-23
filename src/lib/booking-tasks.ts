import maintenanceTasksSeed from "../../seed/maintenance_tasks.json";
import { BOOKING_TRADES, type BookingTrade } from "@/lib/maintenance-tasks";

// Bookable tasks grouped by trade, for the admin's price list — read straight from the
// seed so a client component can import it without pulling the task helpers along.
export const BOOKING_TASKS_BY_TRADE: Record<BookingTrade, { id: string; title: string }[]> = Object.fromEntries(
  BOOKING_TRADES.map((trade) => [
    trade,
    maintenanceTasksSeed.filter((t) => t.booking_trade === trade).map((t) => ({ id: t.id, title: t.title })),
  ])
) as Record<BookingTrade, { id: string; title: string }[]>;
