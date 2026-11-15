import { z } from "zod";

export const customerProfileSchema = z.object({
  fullName: z.string().trim().min(2, "Nhập họ tên từ 2 ký tự.").max(100),
  phone: z
    .string()
    .trim()
    .refine(
      (value) =>
        !value || /^(?:0|\+84)[35789]\d{8}$/.test(value.replace(/[\s.-]/g, "")),
      "Nhập số điện thoại Việt Nam hợp lệ.",
    ),
  province: z.string().trim().max(100),
  avatar: z
    .string()
    .max(200_000)
    .refine(
      (value) =>
        !value || /^data:image\/webp;base64,[A-Za-z0-9+/=]+$/.test(value),
    )
    .default(""),
});

export const preferencesSchema = z.object({
  journey: z.boolean(),
  reminder: z.boolean(),
  offers: z.boolean(),
});

export type CustomerProfile = z.infer<typeof customerProfileSchema>;
export type CustomerPreferences = z.infer<typeof preferencesSchema>;

export const ticketViewSchema = z.object({
  layout: z.enum(["grid", "list"]),
  size: z.enum(["small", "medium", "large"]),
});
export type TicketView = z.infer<typeof ticketViewSchema>;
export const defaultTicketView: TicketView = { layout: "grid", size: "large" };

export const defaultPreferences: CustomerPreferences = {
  journey: true,
  reminder: true,
  offers: false,
};

function key(
  userId: string,
  section: "profile" | "settings" | "ticket-view",
): string {
  return `blue-account:${encodeURIComponent(userId)}:${section}`;
}

export function readCustomerData<T>(
  userId: string,
  section: "profile" | "settings" | "ticket-view",
  schema: z.ZodType<T>,
  fallback: T,
): T {
  try {
    const parsed = schema.safeParse(
      JSON.parse(sessionStorage.getItem(key(userId, section)) ?? "null"),
    );
    if (parsed.success) return parsed.data;
  } catch {
    // A missing, unreadable or corrupt record can be restored from defaults.
  }
  return fallback;
}

export function saveCustomerData(
  userId: string,
  section: "profile" | "settings" | "ticket-view",
  data: CustomerProfile | CustomerPreferences | TicketView,
): boolean {
  try {
    sessionStorage.setItem(key(userId, section), JSON.stringify(data));
    window.dispatchEvent(new Event("blue-account-updated"));
    return true;
  } catch {
    return false;
  }
}
