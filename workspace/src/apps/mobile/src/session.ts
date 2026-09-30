import { createClient, type Session, type SessionStore, type Ticket } from "@busticket/api-client";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

const SESSION_KEY = "busticket.session.mobile";
const TICKET_KEY = "busticket.tickets.mobile";

let cached: Session | null = null;

async function readJson<T>(key: string): Promise<T | null> {
  const raw = await SecureStore.getItemAsync(key);
  return raw ? (JSON.parse(raw) as T) : null;
}

export async function hydrateSession(): Promise<Session | null> {
  cached = await readJson<Session>(SESSION_KEY);
  return cached;
}

export const secureSession: SessionStore = {
  read: () => cached,
  write: (session) => {
    cached = session;
    if (session) {
      void SecureStore.setItemAsync(SESSION_KEY, JSON.stringify(session));
    } else {
      void SecureStore.deleteItemAsync(SESSION_KEY);
    }
  },
};

export type TicketCache = { tickets: Ticket[]; lastSyncedAt: string };

export async function loadTicketCache(): Promise<TicketCache | null> {
  return readJson<TicketCache>(TICKET_KEY);
}

export async function saveTicketCache(tickets: Ticket[]): Promise<TicketCache> {
  const cache: TicketCache = { tickets, lastSyncedAt: new Date().toISOString() };
  await SecureStore.setItemAsync(TICKET_KEY, JSON.stringify(cache));
  return cache;
}

export function gatewayUrl() {
  if (process.env.EXPO_PUBLIC_GATEWAY_URL) return process.env.EXPO_PUBLIC_GATEWAY_URL;
  if (Platform.OS === "android") return "http://10.0.2.2:5080";
  return "http://127.0.0.1:5080";
}

export const api = createClient({ baseUrl: gatewayUrl(), session: secureSession });
