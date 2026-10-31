import { z } from "zod";

export const DRIVER_STATUSES = {
  available: "Sẵn sàng",
  running: "Đang chạy",
  paused: "Tạm nghỉ",
} as const;
export const LICENSE_CLASSES = ["B", "C", "D", "E"] as const;
export const driverStatusSchema = z.enum(["available", "running", "paused"]);
const date = z.iso.date({ error: "Ngày không hợp lệ. Dùng DD / MM / YYYY." });
export const driverInputSchema = z
  .object({
    name: z.string().trim().min(2, "Tên phải có ít nhất 2 ký tự").max(80),
    phone: z
      .string()
      .transform((v) => v.replace(/\s/g, ""))
      .pipe(
        z
          .string()
          .regex(/^0\d{9}$/, "Số điện thoại phải có 10 chữ số, bắt đầu bằng 0"),
      ),
    email: z.union([z.email("Email không hợp lệ").max(100), z.literal("")]),
    birthDate: z.union([date, z.literal("")]),
    address: z.string().trim().max(200),
    licenseNumber: z.string().regex(/^\d{12}$/, "Số GPLX phải có 12 chữ số"),
    licenseClass: z.enum(LICENSE_CLASSES, {
      error: "Vui lòng chọn hạng giấy phép.",
    }),
    issuedAt: date,
    expiresAt: date,
  })
  .refine((v) => v.issuedAt <= v.expiresAt, {
    message: "Ngày hết hạn phải sau ngày cấp",
    path: ["expiresAt"],
  })
  .refine((v) => !v.birthDate || v.birthDate < v.issuedAt, {
    message: "Ngày sinh phải trước ngày cấp",
    path: ["birthDate"],
  })
  .refine(
    (v) => !v.birthDate || v.birthDate < new Date().toISOString().slice(0, 10),
    {
      message: "Ngày sinh phải trong quá khứ",
      path: ["birthDate"],
    },
  );
export const driverAttachmentSchema = z.object({
  id: z.uuid(),
  name: z.string().min(1).max(255),
  type: z.enum(["image/jpeg", "image/png", "application/pdf"]),
  size: z
    .number()
    .int()
    .positive()
    .max(10 * 1024 * 1024),
});
const extras = {
  notes: z.string().max(1000).optional(),
  avatar: driverAttachmentSchema
    .refine(
      (f) => f.type !== "application/pdf" && f.size <= 5 * 1024 * 1024,
      "Ảnh đại diện phải là JPG/PNG, tối đa 5 MB",
    )
    .optional(),
  licenseFront: driverAttachmentSchema.optional(),
  licenseBack: driverAttachmentSchema.optional(),
};
export const createDriverSchema = driverInputSchema.safeExtend({
  ...extras,
  status: z.enum(["available", "paused"]).default("available"),
});
export const updateDriverSchema = driverInputSchema.safeExtend({
  notes: z.string().max(1000).optional(),
  status: driverStatusSchema.optional(),
  avatar: extras.avatar.nullable(),
  licenseFront: extras.licenseFront.nullable(),
  licenseBack: extras.licenseBack.nullable(),
});
export type UpdateDriverInput = z.infer<typeof updateDriverSchema>;
export type CreateDriverInput = z.infer<typeof createDriverSchema>;
export type DriverAttachment = z.infer<typeof driverAttachmentSchema>;
export const driverSchema = driverInputSchema.safeExtend({
  ...extras,
  id: z.string().regex(/^TX-\d{3,}$/),
  joinedAt: date,
  status: driverStatusSchema,
});
export const driversSchema = z.array(driverSchema).max(500);
export type DriverInput = z.infer<typeof driverInputSchema>;
export type OperatorDriver = z.infer<typeof driverSchema>;
export type DriverStatus = z.infer<typeof driverStatusSchema>;
