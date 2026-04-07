/**
 * StockFlow — Regional date/time utilities.
 * All date formatting, "today" calculation, and range helpers go here.
 * Uses the timezone stored in AppSettings (falls back to America/Mexico_City).
 */

/** Read the configured timezone from localStorage (set by useRegionalConfig). */
export function getAppTimezone() {
  return localStorage.getItem("sf_timezone") || "America/Mexico_City";
}

/** Read the configured locale from localStorage (set by useRegionalConfig). */
export function getAppLocale() {
  return localStorage.getItem("sf_locale") || "es-MX";
}

/**
 * Return a Date object representing the start of "today" in the app timezone,
 * expressed as a local midnight UTC-equivalent.
 * Useful for range filters: items where created_date >= todayStart().
 */
export function todayStart() {
  const tz = getAppTimezone();
  const now = new Date();
  // Format as YYYY-MM-DD in the target timezone
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(now);
  const y = parts.find(p => p.type === "year").value;
  const m = parts.find(p => p.type === "month").value;
  const d = parts.find(p => p.type === "day").value;
  return new Date(`${y}-${m}-${d}T00:00:00`);
}

/** Return YYYY-MM-DD string for today in the configured timezone. */
export function todayISO() {
  const tz = getAppTimezone();
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit",
  }).format(new Date());
}

/**
 * Format a date/ISO string for display using the configured locale + timezone.
 * @param {string|Date} value
 * @param {"date"|"datetime"|"time"} mode
 */
export function formatDate(value, mode = "date") {
  if (!value) return "—";
  const locale = getAppLocale();
  const tz = getAppTimezone();
  const date = value instanceof Date ? value : new Date(value);
  if (isNaN(date.getTime())) return String(value);

  const options = { timeZone: tz };
  if (mode === "date") {
    options.year = "numeric";
    options.month = "2-digit";
    options.day = "2-digit";
  } else if (mode === "datetime") {
    options.year = "numeric";
    options.month = "2-digit";
    options.day = "2-digit";
    options.hour = "2-digit";
    options.minute = "2-digit";
  } else if (mode === "time") {
    options.hour = "2-digit";
    options.minute = "2-digit";
  }
  return new Intl.DateTimeFormat(locale, options).format(date);
}

/**
 * Return { start, end } ISO strings for common named ranges,
 * calculated in the configured timezone.
 * @param {"today"|"week"|"month"|"last7"|"last30"} range
 */
export function getDateRange(range) {
  const tz = getAppTimezone();
  const now = new Date();

  // Helper: get YYYY-MM-DD string in timezone
  const toTZDateStr = (d) => new Intl.DateTimeFormat("en-CA", {
    timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit",
  }).format(d);

  // Helper: parse a date string to a Date at midnight in TZ
  const tzMidnight = (isoStr) => new Date(`${isoStr}T00:00:00`);

  const todayStr = toTZDateStr(now);

  if (range === "today") {
    return {
      start: `${todayStr}T00:00:00`,
      end: `${todayStr}T23:59:59`,
    };
  }

  if (range === "last7") {
    const past = new Date(now);
    past.setDate(past.getDate() - 6);
    return { start: `${toTZDateStr(past)}T00:00:00`, end: `${todayStr}T23:59:59` };
  }

  if (range === "last30") {
    const past = new Date(now);
    past.setDate(past.getDate() - 29);
    return { start: `${toTZDateStr(past)}T00:00:00`, end: `${todayStr}T23:59:59` };
  }

  if (range === "week") {
    // Monday-based week in the configured timezone
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: tz, weekday: "short",
    }).formatToParts(now);
    const dow = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].indexOf(
      parts.find(p => p.type === "weekday").value
    );
    const monday = new Date(now);
    monday.setDate(monday.getDate() - ((dow + 6) % 7));
    const sunday = new Date(monday);
    sunday.setDate(sunday.getDate() + 6);
    return {
      start: `${toTZDateStr(monday)}T00:00:00`,
      end: `${toTZDateStr(sunday)}T23:59:59`,
    };
  }

  if (range === "month") {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: tz, year: "numeric", month: "2-digit",
    }).formatToParts(now);
    const y = parts.find(p => p.type === "year").value;
    const m = parts.find(p => p.type === "month").value;
    const lastDay = new Date(+y, +m, 0).getDate();
    return {
      start: `${y}-${m}-01T00:00:00`,
      end: `${y}-${m}-${String(lastDay).padStart(2,"0")}T23:59:59`,
    };
  }

  return { start: null, end: null };
}