export const APP_TIME_ZONE = "America/Sao_Paulo";

const dateFormatter = new Intl.DateTimeFormat("pt-BR", {
  timeZone: APP_TIME_ZONE,
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

const timeFormatter = new Intl.DateTimeFormat("pt-BR", {
  timeZone: APP_TIME_ZONE,
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

const dateTimePartsFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: APP_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});

type DateParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
};

function getParts(date: Date): DateParts {
  const parts = Object.fromEntries(
    dateTimePartsFormatter
      .formatToParts(date)
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, Number(part.value)])
  );

  return {
    year: parts.year,
    month: parts.month,
    day: parts.day,
    hour: parts.hour,
    minute: parts.minute,
    second: parts.second,
  };
}

function getTimeZoneOffsetMs(date: Date): number {
  const parts = getParts(date);
  const localAsUtc = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second
  );

  return localAsUtc - (date.getTime() - date.getUTCMilliseconds());
}

export function saoPauloDateTimeToUtc(
  year: number,
  month: number,
  day: number,
  hour = 0,
  minute = 0,
  second = 0,
  millisecond = 0
): Date {
  const localAsUtc = Date.UTC(
    year,
    month - 1,
    day,
    hour,
    minute,
    second,
    millisecond
  );
  let utc = localAsUtc - getTimeZoneOffsetMs(new Date(localAsUtc));
  utc = localAsUtc - getTimeZoneOffsetMs(new Date(utc));

  return new Date(utc);
}

export function formatSaoPauloDateTime(value: string | Date): string {
  const date = new Date(value);

  return `${dateFormatter.format(date)} ${timeFormatter.format(date)}`;
}

export function formatSaoPauloDate(value: string | Date): string {
  return dateFormatter.format(new Date(value));
}

export function formatSaoPauloDateKey(value: string | Date): string {
  const parts = getParts(new Date(value));

  return `${String(parts.year).padStart(4, "0")}-${String(parts.month).padStart(
    2,
    "0"
  )}-${String(parts.day).padStart(2, "0")}`;
}

export function formatSaoPauloDateTimeLocalInput(
  value: string | Date
): string {
  const parts = getParts(new Date(value));

  return `${String(parts.year).padStart(4, "0")}-${String(parts.month).padStart(
    2,
    "0"
  )}-${String(parts.day).padStart(2, "0")}T${String(parts.hour).padStart(
    2,
    "0"
  )}:${String(parts.minute).padStart(2, "0")}`;
}

export function getSaoPauloTodayRange(now = new Date()): {
  from: string;
  to: string;
} {
  const parts = getParts(now);
  const from = saoPauloDateTimeToUtc(parts.year, parts.month, parts.day);

  return { from: from.toISOString(), to: now.toISOString() };
}

export function dateInputToSaoPauloStartIso(value: string): string | undefined {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return undefined;

  return saoPauloDateTimeToUtc(
    Number(match[1]),
    Number(match[2]),
    Number(match[3])
  ).toISOString();
}

export function dateInputToSaoPauloEndIso(value: string): string | undefined {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return undefined;

  return saoPauloDateTimeToUtc(
    Number(match[1]),
    Number(match[2]),
    Number(match[3]) + 1
  ).toISOString();
}
