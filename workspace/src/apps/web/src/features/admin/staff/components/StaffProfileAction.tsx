import { useState, type ReactElement } from "react";
import type { Organization, Staff } from "../../types/admin";
import { useSaveStaff } from "../hooks/useStaffData";
import { StaffDialog } from "./StaffDialog";
import { Button } from "@/shared/ui/Button/Button";

export function StaffProfileAction({
  staff,
  organizations,
}: {
  staff?: Staff;
  organizations: readonly Organization[];
}): ReactElement {
  const [open, setOpen] = useState(false);
  const save = useSaveStaff();
  return (
    <>
      <Button type="button" variant="secondary" onClick={() => setOpen(true)}>
        {staff ? "Sửa hồ sơ" : "Tạo hồ sơ nhân viên"}
      </Button>
      {open && (
        <StaffDialog
          mode={staff ? "edit" : "create"}
          staff={staff}
          organizations={organizations}
          isOrganizationLoading={false}
          isPending={save.isPending}
          errorMessage={
            save.isError
              ? "Không lưu được hồ sơ. Vui lòng kiểm tra email, số điện thoại và thử lại."
              : undefined
          }
          onClose={() => setOpen(false)}
          onSubmit={async (input) => {
            try {
              await save.mutateAsync({ id: staff?.id, input });
              setOpen(false);
            } catch {
              // Keep the form and its validation message available for retry.
            }
          }}
        />
      )}
    </>
  );
}
