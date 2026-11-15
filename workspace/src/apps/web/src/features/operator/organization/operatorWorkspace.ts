import { z } from "zod";
import { operatorBookingFixtures } from "@/mocks/fixtures/operatorBookings";

export const memberRoles = {
  owner: "Quản trị nhà xe",
  dispatcher: "Điều phối",
  accountant: "Kế toán",
  support: "Chăm sóc khách hàng",
} as const;
export const memberStates = {
  active: "Đang hoạt động",
  invited: "Chờ chấp nhận",
  suspended: "Tạm ngưng",
} as const;
const role = z.enum(["owner", "dispatcher", "accountant", "support"]);
const status = z.enum(["active", "invited", "suspended"]);
export const memberInputSchema = z.object({
  name: z.string().trim().min(2, "Nhập họ tên ít nhất 2 ký tự").max(100),
  email: z.email("Email không hợp lệ").trim().toLowerCase(),
  phone: z
    .string()
    .regex(/^0\d{9}$/, "Số điện thoại gồm 10 chữ số, bắt đầu bằng 0"),
  role,
});
const memberSchema = memberInputSchema.extend({ id: z.string(), status });
export type WorkspaceMember = z.infer<typeof memberSchema>;
export type MemberInput = z.infer<typeof memberInputSchema>;
export const organizationSchema = z.object({
  name: z.string().trim().min(2).max(100),
  code: z.string(),
  email: z.email(),
  phone: z.string().regex(/^0\d{9}$/),
  address: z.string().trim().min(5).max(250),
  taxCode: z
    .string()
    .regex(/^\d{10}(?:\d{3})?$/, "Mã số thuế gồm 10 hoặc 13 chữ số"),
  allowPayLater: z.boolean(),
});
const settlementSchema = z.object({
  code: z.string(),
  bookingCode: z.string(),
  route: z.string(),
  date: z.iso.date(),
  gross: z.number().nonnegative(),
  refunds: z.number().nonnegative(),
  commission: z.number().nonnegative(),
  status: z.enum(["paid", "pending", "review"]),
  reference: z.string(),
});
export type Settlement = z.infer<typeof settlementSchema>;
const workspaceSchema = z.object({
  organization: organizationSchema,
  members: z.array(memberSchema),
  settlements: z.array(settlementSchema),
});
type Workspace = z.infer<typeof workspaceSchema>;
const KEY = "blue-operator-workspace-v1";
const seed = (): Workspace => ({
  organization: {
    name: "BlueLine Co.",
    code: "BLUE-LINE",
    email: "contact@blueline.example.invalid",
    phone: "0281234567",
    address: "292 Đinh Bộ Lĩnh, Bình Thạnh, TP. Hồ Chí Minh",
    taxCode: "0312345678",
    allowPayLater: true,
  },
  members: [
    {
      id: "member-1",
      name: "Nguyễn Hoàng Long",
      email: "long@blue.example.invalid",
      phone: "0901234567",
      role: "owner",
      status: "active",
    },
    {
      id: "member-2",
      name: "Trần Thu Hà",
      email: "ha@blue.example.invalid",
      phone: "0902345678",
      role: "dispatcher",
      status: "active",
    },
    {
      id: "member-3",
      name: "Phạm Ngọc Mai",
      email: "mai@blue.example.invalid",
      phone: "0903456789",
      role: "accountant",
      status: "active",
    },
    {
      id: "member-4",
      name: "Võ Thành Đạt",
      email: "dat@blue.example.invalid",
      phone: "0904567890",
      role: "support",
      status: "invited",
    },
    {
      id: "member-5",
      name: "Đỗ Minh Anh",
      email: "anh@blue.example.invalid",
      phone: "0905678901",
      role: "dispatcher",
      status: "suspended",
    },
    {
      id: "member-6",
      name: "Lê Minh Khang",
      email: "khang@blue.example.invalid",
      phone: "0906789012",
      role: "support",
      status: "active",
    },
  ],
  settlements: operatorBookingFixtures
    .filter((b) => b.payment !== "unpaid")
    .slice(0, 24)
    .map((booking, i) => {
      const refunds =
        booking.payment === "refunded"
          ? booking.amount
          : i % 5 === 0
            ? Math.round(booking.amount * 0.2)
            : 0;
      return {
        code: `DS-2609-${String(i + 1).padStart(3, "0")}`,
        bookingCode: booking.id,
        route: `${booking.origin} → ${booking.destination}`,
        date: booking.createdDate,
        gross: booking.amount,
        refunds,
        commission: Math.round((booking.amount - refunds) * 0.05),
        status: (["paid", "pending", "review"] as const)[i % 3],
        reference:
          i % 3 === 0 ? `BLUE-TRANSFER-${String(i + 1).padStart(5, "0")}` : "",
      };
    }),
});
export function readWorkspace(): Workspace {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (raw) return workspaceSchema.parse(JSON.parse(raw));
  } catch {
    /* A corrupt demo snapshot is replaced with deterministic seeds. */
  }
  return seed();
}
function persist(value: Workspace): void {
  sessionStorage.setItem(KEY, JSON.stringify(workspaceSchema.parse(value)));
}
export function saveOrganization(input: Workspace["organization"]): void {
  const current = readWorkspace();
  persist({ ...current, organization: organizationSchema.parse(input) });
}
export function saveMember(input: MemberInput, id?: string): WorkspaceMember {
  const parsed = memberInputSchema.parse(input),
    current = readWorkspace();
  if (
    current.members.some(
      (m) => m.id !== id && m.email.toLowerCase() === parsed.email,
    )
  )
    throw Error("Email này đã tồn tại trong tổ chức.");
  const existing = current.members.find((m) => m.id === id);
  if (id && !existing) throw Error("Không tìm thấy thành viên.");
  if (
    existing?.role === "owner" &&
    parsed.role !== "owner" &&
    existing.status === "active" &&
    current.members.filter((m) => m.role === "owner" && m.status === "active")
      .length === 1
  )
    throw Error("Cần giữ ít nhất một quản trị viên đang hoạt động.");
  const saved: WorkspaceMember = {
    ...parsed,
    id: existing?.id ?? crypto.randomUUID(),
    status: existing?.status ?? "invited",
  };
  persist({
    ...current,
    members: existing
      ? current.members.map((m) => (m.id === id ? saved : m))
      : [...current.members, saved],
  });
  return saved;
}
export function setMemberStatus(
  id: string,
  state: WorkspaceMember["status"],
): void {
  const current = readWorkspace(),
    member = current.members.find((m) => m.id === id);
  if (!member) throw Error("Không tìm thấy thành viên.");
  if (
    member.role === "owner" &&
    state !== "active" &&
    current.members.filter((m) => m.role === "owner" && m.status === "active")
      .length === 1
  )
    throw Error("Cần giữ ít nhất một quản trị viên đang hoạt động.");
  persist({
    ...current,
    members: current.members.map((m) =>
      m.id === id ? { ...m, status: state } : m,
    ),
  });
}
export function settlementTotals(items: Settlement[]): {
  gross: number;
  refunds: number;
  commission: number;
  net: number;
} {
  const total = items.reduce(
    (sum, row) => ({
      gross: sum.gross + row.gross,
      refunds: sum.refunds + row.refunds,
      commission: sum.commission + row.commission,
    }),
    { gross: 0, refunds: 0, commission: 0 },
  );
  return { ...total, net: total.gross - total.refunds - total.commission };
}
export function settlementCsv(items: Settlement[]): string {
  const cell = (value: string | number): string =>
    `"${String(value).replaceAll('"', '""')}"`;
  return (
    "\uFEFF" +
    [
      [
        "Mã đối soát",
        "Mã đặt vé",
        "Tuyến",
        "Ngày",
        "Doanh thu",
        "Hoàn tiền",
        "Hoa hồng",
        "Nhà xe nhận",
        "Trạng thái",
        "Tham chiếu",
      ],
      ...items.map((r) => [
        r.code,
        r.bookingCode,
        r.route,
        r.date,
        r.gross,
        r.refunds,
        r.commission,
        r.gross - r.refunds - r.commission,
        r.status,
        r.reference,
      ]),
    ]
      .map((row) => row.map(cell).join(","))
      .join("\r\n")
  );
}
