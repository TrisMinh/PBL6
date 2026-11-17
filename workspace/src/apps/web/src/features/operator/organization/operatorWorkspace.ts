import { z } from "zod";
import {
  rows,
  request,
  metadata,
  saveMetadata,
  localDateTime,
} from "../liveOriginalApi";

export const memberRoles = {
  owner: "Quản trị nhà xe",
  dispatcher: "Điều phối",
  accountant: "Kế toán",
  support: "Chăm sóc khách hàng",
  driver: "Tài xế",
} as const;
export const memberStates = {
  active: "Đang hoạt động",
  invited: "Chờ chấp nhận",
  suspended: "Tạm ngưng",
} as const;
const role = z.enum(["owner", "dispatcher", "accountant", "support", "driver"]);
export const memberInputSchema = z.object({
  name: z.string().trim().min(2, "Nhập họ tên ít nhất 2 ký tự").max(100),
  email: z.email("Email không hợp lệ").trim().toLowerCase(),
  phone: z
    .string()
    .regex(/^0\d{9}$/, "Số điện thoại gồm 10 chữ số, bắt đầu bằng 0"),
  role,
});
export type MemberInput = z.infer<typeof memberInputSchema>;
export type WorkspaceMember = MemberInput & {
  id: string;
  status: keyof typeof memberStates;
};
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
  logoUrl: z.string().optional(),
});
export type Settlement = {
  code: string;
  bookingCode: string;
  route: string;
  date: string;
  gross: number;
  refunds: number;
  commission: number;
  status: "paid" | "pending" | "review";
  reference: string;
  net?: number;
};
type Workspace = {
  organization: z.infer<typeof organizationSchema>;
  members: WorkspaceMember[];
  settlements: Settlement[];
};
export const emptyWorkspace: Workspace = {
  organization: {
    name: "",
    code: "",
    email: "",
    phone: "",
    address: "",
    taxCode: "",
    allowPayLater: false,
  },
  members: [],
  settlements: [],
};
const roles: Record<string, string> = {
  owner: "OPERATOR_ADMIN",
  dispatcher: "OPERATOR_SCHEDULER",
  accountant: "OPERATOR_FINANCE",
  support: "OPERATOR_OPERATIONS",
  driver: "DRIVER",
};
export async function readWorkspace(): Promise<Workspace> {
  const [org, staff, extra] = await Promise.all([
    request("/api/v1/operator/organization"),
    rows("/api/v1/operator/staff"),
    metadata("organization"),
  ]);
  const m = extra[org.id] ?? {};
  return {
    organization: {
      name: org.name,
      code: org.code,
      email: org.contactEmail ?? "",
      phone: org.contactPhone ?? "",
      address: m.address ?? "",
      taxCode: m.taxCode ?? m.taxId ?? "",
      allowPayLater: org.allowPayLater,
      logoUrl: m.logoUrl ?? "",
    },
    members: staff
      .filter((v) =>
        Object.values(roles).some((role) => v.roleCodes.includes(role)),
      )
      .map((v) => ({
        id: v.id,
        name: m.members?.[v.id]?.name ?? v.fullName,
        email: m.members?.[v.id]?.email ?? v.email,
        phone: m.members?.[v.id]?.phone ?? v.phone,
        role: (Object.keys(roles).find((r) => v.roleCodes.includes(roles[r])) ??
          "support") as WorkspaceMember["role"],
        status: v.status === "ACTIVE" ? "active" : "suspended",
      })),
    settlements: [],
  };
}
export async function getSettlements(): Promise<Settlement[]> {
  const [values, bookings, refunds] = await Promise.all([
    rows("/api/v1/operator/settlements"),
    rows("/api/v1/operator/bookings"),
    rows("/api/v1/operator/refunds"),
  ]);
  return values.map((v) => {
    const b = bookings.find((b) => b.id === v.bookingId);
    return {
      code: v.id,
      bookingCode: b?.code ?? v.bookingId,
      route: "—",
      date: b?.createdAt ? localDateTime(b.createdAt).slice(0, 10) : "",
      gross: v.grossAmount,
      refunds: refunds
        .filter((r) => r.bookingId === v.bookingId && r.status === "SUCCEEDED")
        .reduce((sum, r) => sum + Number(r.amount), 0),
      commission: v.commissionAmount,
      net: v.operatorNet,
      status:
        v.collectionStatus === "PAID"
          ? "paid"
          : v.collectionStatus === "COLLECTED"
            ? "pending"
            : "review",
      reference: v.paymentId ?? "",
    };
  });
}
export async function saveOrganization(
  input: Workspace["organization"],
): Promise<void> {
  const value = organizationSchema.parse(input);
  const org = await request("/api/v1/operator/organization");
  await request("/api/v1/operator/organization", "PATCH", {
    code: value.code,
    name: value.name,
    contactEmail: value.email,
    contactPhone: value.phone,
    allowPayLater: value.allowPayLater,
    expectedVersion: org.rowVersion,
  });
  await saveMetadata("organization", org.id, {
    ...(await metadata("organization"))[org.id],
    address: value.address,
    taxCode: value.taxCode,
    logoUrl: value.logoUrl ?? "",
  });
}
export async function saveMember(
  input: MemberInput,
  id?: string,
): Promise<WorkspaceMember> {
  const value = memberInputSchema.parse(input);
  const members = await rows("/api/v1/operator/staff");
  const member = id
    ? members.find((v) => v.id === id)
    : await request("/api/v1/operator/staff", "POST", {
        fullName: value.name,
        email: value.email,
        phone: value.phone,
        role: roles[value.role],
      });
  if (!member) throw Error("Không tìm thấy thành viên.");
  if (id)
    await request(`/api/v1/operator/staff/${id}`, "PATCH", {
      role: roles[value.role],
      status: member.status,
      expectedVersion: member.rowVersion,
    });
  const org = await request("/api/v1/operator/organization"),
    m = (await metadata("organization"))[org.id] ?? {};
  await saveMetadata("organization", org.id, {
    ...m,
    members: { ...m.members, [member.id]: value },
  });
  return {
    ...value,
    id: member.id,
    status: member.status === "ACTIVE" ? "active" : "suspended",
  };
}
export async function setMemberStatus(
  id: string,
  state: WorkspaceMember["status"],
): Promise<void> {
  const members = await rows("/api/v1/operator/staff");
  const member = members.find((v) => v.id === id);
  if (!member) throw Error("Không tìm thấy thành viên.");
  const operatorRole = Object.values(roles).find((role) =>
    member.roleCodes.includes(role),
  );
  if (!operatorRole)
    throw Error("Tài khoản này chưa được phân vai trò nhân sự nhà xe.");
  if (
    state !== "active" &&
    member.roleCodes.includes("OPERATOR_ADMIN") &&
    members.filter(
      (v) => v.status === "ACTIVE" && v.roleCodes.includes("OPERATOR_ADMIN"),
    ).length <= 1
  ) {
    throw Error(
      "Không thể tạm ngưng quản trị viên cuối cùng. Cần giữ ít nhất một quản trị viên đang hoạt động.",
    );
  }
  await request(`/api/v1/operator/staff/${id}`, "PATCH", {
    role: operatorRole,
    status: state === "active" ? "ACTIVE" : "SUSPENDED",
    expectedVersion: member.rowVersion,
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
      net: sum.net + (row.net ?? row.gross - row.refunds - row.commission),
    }),
    { gross: 0, refunds: 0, commission: 0, net: 0 },
  );
  return total;
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
        r.net ?? r.gross - r.refunds - r.commission,
        r.status,
        r.reference,
      ]),
    ]
      .map((row) => row.map(cell).join(","))
      .join("\r\n")
  );
}
