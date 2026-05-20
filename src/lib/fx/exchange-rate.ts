import "server-only";

const AWESOME_API_USD_BRL_URL =
  "https://economia.awesomeapi.com.br/json/last/USD-BRL";
const WEEKDAY_TTL_MS = 15 * 60 * 1000;
const WEEKEND_TTL_MS = 4 * 60 * 60 * 1000;

let cache: { value: number; at: number } | null = null;
let inFlightRequest: Promise<number> | null = null;

function getCacheTtlMs(): number {
  const day = new Date().getDay();
  return day === 0 || day === 6 ? WEEKEND_TTL_MS : WEEKDAY_TTL_MS;
}

function parseRate(value: unknown): number | null {
  if (typeof value !== "string" && typeof value !== "number") return null;

  const rate = Number(value);
  return Number.isFinite(rate) && rate > 0 ? rate : null;
}

function readFallbackRate(): number | null {
  const fallback = process.env.USD_BRL_FALLBACK_RATE;
  if (!fallback) return null;

  return parseRate(fallback);
}

async function fetchUsdBrlRate(): Promise<number> {
  const response = await fetch(AWESOME_API_USD_BRL_URL, { cache: "no-store" });

  if (!response.ok) {
    throw new Error(`AwesomeAPI responded with ${response.status}`);
  }

  const data = (await response.json()) as {
    USDBRL?: { bid?: string | number };
  };
  const rate = parseRate(data.USDBRL?.bid);

  if (!rate) {
    throw new Error("AwesomeAPI returned an invalid USD/BRL rate.");
  }

  return rate;
}

export async function getUsdBrlRate(): Promise<number> {
  const now = Date.now();

  if (cache && now - cache.at < getCacheTtlMs()) {
    return cache.value;
  }

  if (inFlightRequest) return inFlightRequest;

  inFlightRequest = fetchUsdBrlRate()
    .then((rate) => {
      cache = { value: rate, at: Date.now() };
      return rate;
    })
    .catch(() => {
      const fallbackRate = readFallbackRate();

      if (fallbackRate) {
        cache = { value: fallbackRate, at: Date.now() };
        return fallbackRate;
      }

      throw new Error(
        "Não foi possível obter a cotação do dólar. Tente novamente em alguns instantes."
      );
    })
    .finally(() => {
      inFlightRequest = null;
    });

  return inFlightRequest;
}
