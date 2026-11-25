import type { Query } from "@tanstack/react-query";
import { z } from "zod";
import { apiJson } from "@/shared/api/client";

const embedSessionSchema = z.object({
  reportId: z.guid(),
  embedUrl: z.url().refine((value) => {
    const url = new URL(value);
    return (
      url.origin === "https://app.powerbi.com" &&
      url.pathname === "/reportEmbed"
    );
  }),
  token: z.string().min(1),
  expiration: z.iso.datetime({ offset: true }),
});

export type EmbedSession = z.infer<typeof embedSessionSchema>;

export function fetchPowerBIEmbed(signal: AbortSignal): Promise<EmbedSession> {
  return apiJson("/api/v1/reports/power-bi/embed", embedSessionSchema, {
    method: "POST",
    signal,
    cache: "no-store",
  });
}

export function powerBIEmbedRefetchInterval(
  query: Query<EmbedSession>,
): number | false {
  const { data, error } = query.state;
  return data && !error
    ? Math.max(5_000, Date.parse(data.expiration) - Date.now() - 60_000)
    : false;
}
