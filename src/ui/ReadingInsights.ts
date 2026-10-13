import { App, Modal, setTooltip } from 'obsidian';
import { KindleReaderSettings } from '../settings';
import { readerTodayKey, fmtReadTime, shiftDayKey, readingStreak, readingStats } from '../main';
import { __ertr } from '../utils/i18n';

export function calculateLongestStreak(log: Record<string, number>): number {
  if (!log) return 0;
  const activeKeys = Object.keys(log).filter((k) => (log[k] || 0) > 0).sort();
  if (!activeKeys.length) return 0;

  let maxStreak = 0;
  let currentStreak = 0;
  let prevDate: string | null = null;

  for (const k of activeKeys) {
    if (prevDate && shiftDayKey(prevDate, 1) === k) {
      currentStreak++;
    } else {
      currentStreak = 1;
    }
    if (currentStreak > maxStreak) {
      maxStreak = currentStreak;
    }
    prevDate = k;
  }
  return maxStreak;
}

export function calculateWeekSeconds(log: Record<string, number>, todayKey: string): number {
  let sec = 0;
  for (let i = 0; i < 7; i++) {
    const k = shiftDayKey(todayKey, -i);
    sec += (log && log[k]) || 0;
  }
  return sec;
}

interface HeatmapDay {
  key: string;
  sec: number;
  level: number;
  dateStr: string;
  isFuture: boolean;
  isToday: boolean;
  dayOfWeek: number;
  monthName: string;
}

export function buildHeatmapWeeks(log: Record<string, number>, todayKey: string, numWeeks = 16): HeatmapDay[][] {
  const today = new Date(todayKey + "T12:00:00Z");
  const todayDay = today.getUTCDay(); // 0 is Sunday, 6 is Saturday

  // End of current week is Saturday
  const endOfWeek = new Date(today);
  endOfWeek.setUTCDate(today.getUTCDate() + (6 - todayDay));

  const totalDays = numWeeks * 7;
  const startDay = new Date(endOfWeek);
  startDay.setUTCDate(endOfWeek.getUTCDate() - totalDays + 1);

  const weeks: HeatmapDay[][] = [];
  let currentWeek: HeatmapDay[] = [];
  const cur = new Date(startDay);

  for (let i = 0; i < totalDays; i++) {
    const key = cur.toISOString().slice(0, 10);
    const sec = (log && log[key]) || 0;

    let level = 0;
    if (sec > 0) {
      if (sec < 15 * 60) level = 1;
      else if (sec < 30 * 60) level = 2;
      else if (sec < 60 * 60) level = 3;
      else level = 4;
    }

    const isFuture = key > todayKey;
    const isToday = key === todayKey;

    const monthName = cur.toLocaleDateString(undefined, { month: "short", timeZone: "UTC" });

    currentWeek.push({
      key,
      sec,
      level: isFuture ? 0 : level,
      dateStr: key,
      isFuture,
      isToday,
      dayOfWeek: cur.getUTCDay(),
      monthName
    });

    if (currentWeek.length === 7) {
      weeks.push(currentWeek);
      currentWeek = [];
    }

    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  return weeks;
}

export function renderReadingInsights(container: HTMLElement, settings: KindleReaderSettings): void {
  const todayKey = readerTodayKey();
  const log = settings.readingLog || {};
  const stats = readingStats(log, settings.lifetimeSeconds, todayKey);
  const streak = readingStreak(log, todayKey);
  const longest = Math.max(streak, calculateLongestStreak(log));
  const weekSec = calculateWeekSeconds(log, todayKey);
  const weeks = buildHeatmapWeeks(log, todayKey, 16);

  const card = container.createDiv({ cls: "er-insights-card" });

  // 1. Header with Streak
  const head = card.createDiv({ cls: "er-insights-head" });
  const streakWrap = head.createDiv({ cls: "er-insights-streak-wrap" });
  streakWrap.createDiv({ cls: "er-insights-flame", text: "🔥" });

  const streakInfo = streakWrap.createDiv({ cls: "er-insights-streak-info" });
  if (streak > 0) {
    streakInfo.createDiv({ cls: "er-insights-streak-val", text: __ertr("{0} days in a row", streak) });
    streakInfo.createDiv({ cls: "er-insights-streak-sub", text: __ertr("Longest streak: {0} days", longest) });
  } else {
    streakInfo.createDiv({ cls: "er-insights-streak-val", text: __ertr("No active streak") });
    streakInfo.createDiv({ cls: "er-insights-streak-sub", text: __ertr("Read today to build your streak!") });
  }

  // 2. KPI metrics
  const kpis = card.createDiv({ cls: "er-insights-kpis" });
  const addKpi = (label: string, value: string) => {
    const kpi = kpis.createDiv({ cls: "er-insights-kpi" });
    kpi.createDiv({ cls: "er-insights-kpi-val", text: value });
    kpi.createDiv({ cls: "er-insights-kpi-lab", text: label });
  };

  addKpi(__ertr("This week"), fmtReadTime(weekSec));
  addKpi(__ertr("today"), fmtReadTime(stats.today));
  addKpi(__ertr("daily average"), fmtReadTime(stats.avgPerDay));
  addKpi(__ertr("all-time with books"), fmtReadTime(stats.total));

  // 3. Heatmap calendar
  const heatmapContainer = card.createDiv({ cls: "er-heatmap-container" });
  const gridWrap = heatmapContainer.createDiv({ cls: "er-heatmap-grid-wrap" });

  // Weekday labels (Mon, Wed, Fri)
  const weekdaysEl = gridWrap.createDiv({ cls: "er-heatmap-weekdays" });
  weekdaysEl.createSpan({ text: "" }); // Sun placeholder
  weekdaysEl.createSpan({ text: __ertr("Mon") });
  weekdaysEl.createSpan({ text: "" }); // Tue placeholder
  weekdaysEl.createSpan({ text: __ertr("Wed") });
  weekdaysEl.createSpan({ text: "" }); // Thu placeholder
  weekdaysEl.createSpan({ text: __ertr("Fri") });
  weekdaysEl.createSpan({ text: "" }); // Sat placeholder

  // Month labels across top
  const calendarArea = gridWrap.createDiv({ cls: "er-heatmap-cal-area" });
  const monthsRow = calendarArea.createDiv({ cls: "er-heatmap-months-row" });

  let lastMonth = "";
  for (let w = 0; w < weeks.length; w++) {
    const firstDay = weeks[w][0];
    const m = firstDay.monthName;
    const monthSpan = monthsRow.createDiv({ cls: "er-heatmap-month-label" });
    if (m !== lastMonth) {
      monthSpan.setText(m);
      lastMonth = m;
    } else {
      monthSpan.setText("");
    }
  }

  // Cells grid
  const grid = calendarArea.createDiv({ cls: "er-heatmap-grid" });

  for (const week of weeks) {
    for (const day of week) {
      const cell = grid.createDiv({
        cls: `er-heatmap-cell lvl-${day.level}${day.isToday ? " is-today" : ""}${day.isFuture ? " is-future" : ""}`
      });

      if (!day.isFuture) {
        const mins = Math.round(day.sec / 60);
        const dateFormatted = new Date(day.key + "T12:00:00Z").toLocaleDateString(undefined, {
          weekday: "short",
          month: "short",
          day: "numeric",
          timeZone: "UTC"
        });

        const tooltipText = mins > 0
          ? `${dateFormatted}: ${fmtReadTime(day.sec)}`
          : `${dateFormatted}: ${__ertr("No reading")}`;

        setTooltip(cell, tooltipText);
      }
    }
  }

  // Legend
  const footer = card.createDiv({ cls: "er-heatmap-footer" });
  footer.createSpan({ text: __ertr("Less") });
  const legend = footer.createDiv({ cls: "er-heatmap-legend" });
  for (let lvl = 0; lvl <= 4; lvl++) {
    legend.createDiv({ cls: `er-heatmap-cell lvl-${lvl}` });
  }
  footer.createSpan({ text: __ertr("More") });
}

export class ReadingInsightsModal extends Modal {
  plugin: unknown;

  constructor(app: App, plugin: unknown) {
    super(app);
    this.plugin = plugin;
  }

  onOpen(): void {
    const { contentEl, modalEl } = this;
    modalEl.addClass("er-insights-modal");
    contentEl.empty();

    const titleRow = contentEl.createDiv("er-modal-header-row");
    const title = titleRow.createDiv("er-confirm-title");
    title.setText(__ertr("Reading insights & heatmap"));

    renderReadingInsights(contentEl, this.plugin.settings);

    const btns = contentEl.createDiv("er-confirm-btns");
    const closeBtn = btns.createEl("button", {
      cls: "er-confirm-yes",
      text: __ertr("Close")
    });
    closeBtn.addEventListener("click", () => this.close());
  }

  onClose(): void {
    this.contentEl.empty();
  }
}
