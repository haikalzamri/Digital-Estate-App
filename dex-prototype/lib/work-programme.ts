import source from "@/data/scenarios/work-programmes.json";

export type ProgrammeStatus = "Overdue" | "Due this month" | "On time" | "Upcoming" | "Completed";
export type ProgrammeRound = { number: number; dueDate: string; targetHa: number; actuals: { date: string; hectares: number; validated?: boolean }[] };
export type ProgrammeField = { fieldNo: string; category: string; hectares: number; rounds: ProgrammeRound[] };
export type Programme = { id: string; title: string; activityCode: string; mapRule: { greenBelow: number; yellowTo: number; source: string }; fields: ProgrammeField[] };
export const AS_OF_DATE = source.asOfDate;
export const WORKSHOP_YEAR = source.year;
export const programmes: Programme[] = source.records;
export const MONTH_LABELS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
export const statusTone = (status: ProgrammeStatus) => status === "Overdue" ? "red" : status === "Due this month" ? "amber" : status === "On time" || status === "Completed" ? "green" : "neutral";
const round2 = (n: number) => Math.round(n * 100) / 100;
export const roundActual = (r: ProgrammeRound) => round2(r.actuals.filter((a) => (a.date <= AS_OF_DATE || a.validated === true)).reduce((n, a) => n + a.hectares, 0));
export const roundComplete = (r: ProgrammeRound) => roundActual(r) >= r.targetHa - 0.005;
export const nextRound = (f: ProgrammeField) => f.rounds.find((r) => !roundComplete(r));
export const roundRemaining = (r: ProgrammeRound) => round2(Math.max(0, r.targetHa - roundActual(r)));
export const annualPlanned = (f: ProgrammeField) => round2(f.rounds.reduce((n, r) => n + r.targetHa, 0));
export const annualActual = (f: ProgrammeField) => round2(f.rounds.reduce((n, r) => n + roundActual(r), 0));
export const completedRounds = (f: ProgrammeField) => f.rounds.filter(roundComplete).length;
export const monthName = (date: string) => date ? MONTH_LABELS[Number(date.slice(5, 7)) - 1] + " " + date.slice(0, 4) : "Complete";
export function fieldStatus(f: ProgrammeField): ProgrammeStatus {
  const r = nextRound(f);
  if (!r) return "Completed";
  if (r.dueDate < AS_OF_DATE) return "Overdue";
  if (r.dueDate.slice(0, 7) === AS_OF_DATE.slice(0, 7)) return "Due this month";
  return r.dueDate.slice(5, 7) === "11" ? "On time" : "Upcoming";
}
export function delayMonths(f: ProgrammeField) {
  const r = nextRound(f);
  if (!r || r.dueDate >= AS_OF_DATE) return 0;
  return Math.max(0, (Number(AS_OF_DATE.slice(0, 4)) - Number(r.dueDate.slice(0, 4))) * 12 + Number(AS_OF_DATE.slice(5, 7)) - Number(r.dueDate.slice(5, 7)));
}
export function programmeSummary(p: Programme) {
  const statuses = p.fields.map(fieldStatus);
  const status: ProgrammeStatus = statuses.includes("Overdue") ? "Overdue" : statuses.includes("Due this month") ? "Due this month" : statuses.includes("On time") ? "On time" : statuses.includes("Upcoming") ? "Upcoming" : "Completed";
  const planned = round2(p.fields.reduce((n, f) => n + annualPlanned(f), 0));
  const actual = round2(p.fields.reduce((n, f) => n + annualActual(f), 0));
  const outstanding = p.fields.flatMap((f) => f.rounds.filter((r) => !roundComplete(r)).map((r) => ({ field: f, round: r })));
  const due = outstanding.filter(({ round }) => round.dueDate.slice(0, 7) <= AS_OF_DATE.slice(0, 7));
  return { status, planned, actual, remaining: round2(planned - actual), progress: planned ? actual / planned * 100 : 0,
    overdueFields: statuses.filter((s) => s === "Overdue").length,
    dueFields: statuses.filter((s) => s === "Due this month").length,
    priorityFields: new Set(due.map(({ field }) => field.fieldNo)).size,
    priorityHa: round2(due.reduce((n, { round }) => n + roundRemaining(round), 0)),
    nextDue: outstanding.map(({ round }) => round.dueDate).sort()[0] || "",
    roundCount: p.fields[0]?.rounds.length || 0,
  };
}
export function recommendedProgrammes(records = programmes) {
  return records.filter((p) => programmeSummary(p).priorityFields > 0).sort((a, b) => {
    const sa = programmeSummary(a), sb = programmeSummary(b);
    return Number(sb.status === "Overdue") - Number(sa.status === "Overdue") || sa.nextDue.localeCompare(sb.nextDue) || a.id.localeCompare(b.id);
  }).slice(0, 4);
}
export function monthlyValues(f: ProgrammeField, year: number, actual: boolean) {
  return MONTH_LABELS.map((_, month) => {
    const prefix = year + "-" + String(month + 1).padStart(2, "0");
    return round2(f.rounds.reduce((sum, r) => sum + (actual
      ? r.actuals.filter((a) => (a.date <= AS_OF_DATE || a.validated === true) && a.date.startsWith(prefix)).reduce((n, a) => n + a.hectares, 0)
      : r.dueDate.startsWith(prefix) ? r.targetHa : 0), 0));
  });
}
export function mapRating(p: Programme, f: ProgrammeField) {
  const last = f.rounds.filter(roundComplete).flatMap((r) => r.actuals.filter((a) => (a.date <= AS_OF_DATE || a.validated === true)).map((a) => a.date)).sort().at(-1);
  if (!last) return { tone: "grey", label: "No completed round", interval: null };
  const interval = (Number(AS_OF_DATE.slice(0, 4)) - Number(last.slice(0, 4))) * 12 + Number(AS_OF_DATE.slice(5, 7)) - Number(last.slice(5, 7));
  const tone = interval < p.mapRule.greenBelow ? "green" : interval <= p.mapRule.yellowTo ? "yellow" : "red";
  return { tone, label: tone[0].toUpperCase() + tone.slice(1), interval };
}

export type ProgrammeCredit = { id: string; programmeId: string; fieldNo: string; round: number; year: number; date: string; ha: number };
export function withProgrammeCredits(credits: ProgrammeCredit[]): Programme[] {
  return programmes.map((p) => ({ ...p, fields: p.fields.map((f) => ({ ...f, rounds: f.rounds.map((r) => ({
    ...r, actuals: [...r.actuals, ...credits.filter((c) => c.programmeId === p.id && c.fieldNo === f.fieldNo && c.round === r.number && c.year === Number(r.dueDate.slice(0, 4))).map((c) => ({ date: c.date, hectares: c.ha, validated: true }))]
  })) })) }));
}
