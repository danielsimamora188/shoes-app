export const STATUS_COLORS: Record<string, string> = {
  Pending: "bg-amber-100 text-amber-800 border border-amber-200",
  Paid: "bg-emerald-100 text-emerald-800 border border-emerald-200",
  Working: "bg-indigo-100 text-indigo-800 border border-indigo-200",
  Done: "bg-emerald-100 text-emerald-800 border border-emerald-200",
  Cancelled: "bg-rose-100 text-rose-800 border border-rose-200"
};

export const STATUS_LABELS: Record<string, string> = {
  Pending: "Menunggu",
  Paid: "Lunas",
  Working: "Dikerjakan",
  Done: "Selesai",
  Cancelled: "Dibatalkan"
};

export const VALID_STATUS_TRANSITIONS: Record<string, string[]> = {
  Pending: ["Paid", "Cancelled"],
  Paid: ["Working"],
  Working: ["Done"],
  Done: [],
  Cancelled: []
};
