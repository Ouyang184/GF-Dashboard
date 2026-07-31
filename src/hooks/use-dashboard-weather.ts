import { useQuery } from "@tanstack/react-query";

import { DashboardWeatherService } from "@/generated/services/DashboardWeatherService";

export type DashboardWeather = {
  tempF: number;
  code: number;
  label: string;
  city: string;
  updatedAt: string;
};

async function loadWeather(): Promise<DashboardWeather | null> {
  const result = await DashboardWeatherService.getAll({
    top: 100,
  });

  if (!result.success) {
    throw result.error ?? new Error("SharePoint returned an unsuccessful weather response");
  }

  const row = result.data
    ?.filter((item) => item.Temperature != null)
    .sort((a, b) => {
      const aTime = Date.parse(a.Modified || a.UpdatedAt || "") || Number(a.ID ?? 0);
      const bTime = Date.parse(b.Modified || b.UpdatedAt || "") || Number(b.ID ?? 0);
      return bTime - aTime;
    })[0];
  if (!row || row.Temperature == null) return null;

  return {
    tempF: Math.round(row.Temperature),
    code: row.WeatherCode ?? 0,
    label: row.Condition?.trim() || "Unknown",
    city: row.Title?.trim() || "Little Rock, AR",
    updatedAt: row.UpdatedAt || row.Modified || "",
  };
}

export function useDashboardWeather() {
  return useQuery({
    queryKey: ["dashboard-weather"],
    queryFn: loadWeather,
    refetchInterval: 60_000,
    refetchIntervalInBackground: false,
  });
}
