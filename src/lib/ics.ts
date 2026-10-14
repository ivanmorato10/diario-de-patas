/** Eventos de calendário (.ics) para o celular: dia inteiro, repetição opcional e alarme às 9h do dia. */
export interface IcsEvent { uid: string; title: string; date: string; time?: string; description?: string; location?: string; rrule?: string }

const esc = (s: string) => s.replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/([,;])/g, "\\$1");
const day = (d: string) => d.replace(/-/g, "");
const nextDay = (d: string) => new Date(Date.parse(`${d}T00:00:00Z`) + 86_400_000).toISOString().slice(0, 10);

export const RRULE: Record<string, string> = { daily: "FREQ=DAILY", weekly: "FREQ=WEEKLY", monthly: "FREQ=MONTHLY", quarterly: "FREQ=MONTHLY;INTERVAL=3", yearly: "FREQ=YEARLY" };

export function buildIcs(ev: IcsEvent, until?: string | null): string {
  const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d+Z$/, "Z");
  const rule = ev.rrule ? `${ev.rrule}${until ? `;UNTIL=${day(until)}` : ""}` : null;
  return [
    "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Diario de Patas//PT-BR", "CALSCALE:GREGORIAN", "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${ev.uid}@diariodepatas`, `DTSTAMP:${stamp}`,
    ...(ev.time
      ? [`DTSTART;TZID=America/Sao_Paulo:${day(ev.date)}T${ev.time.replace(":", "")}00`, `DURATION:PT1H`]
      : [`DTSTART;VALUE=DATE:${day(ev.date)}`, `DTEND;VALUE=DATE:${day(nextDay(ev.date))}`]),
    ...(rule ? [`RRULE:${rule}`] : []),
    `SUMMARY:${esc(ev.title)}`,
    ...(ev.description ? [`DESCRIPTION:${esc(ev.description)}`] : []),
    ...(ev.location ? [`LOCATION:${esc(ev.location)}`] : []),
    "BEGIN:VALARM", "ACTION:DISPLAY", `DESCRIPTION:${esc(ev.title)}`, ev.time ? "TRIGGER:-PT1H" : "TRIGGER:PT9H", "END:VALARM",
    "END:VEVENT", "END:VCALENDAR", "",
  ].join("\r\n");
}
