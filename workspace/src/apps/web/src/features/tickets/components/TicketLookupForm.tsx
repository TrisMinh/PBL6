import { zodResolver } from "@hookform/resolvers/zod";
import type { ReactElement } from "react";
import {
  useForm,
  type FieldErrors,
  type UseFormRegister,
} from "react-hook-form";

import { lookupFormSchema } from "@/features/tickets/schemas/ticket.schema";
import type { LookupInput } from "@/features/tickets/types/ticketAccess";
import { TICKET_CODE_MAX_LENGTH } from "@/features/tickets/config/access";
import { Button } from "@/shared/ui/Button/Button";
import { Input } from "@/shared/ui/Input/Input";

interface Props {
  isPending: boolean;
  onSubmit: (values: LookupInput) => void;
}
export function TicketLookupForm({ isPending, onSubmit }: Props): ReactElement {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LookupInput>({
    resolver: zodResolver(lookupFormSchema),
    defaultValues: { bookingCode: "", verificationValue: "" },
  });
  return (
    <form
      className="ticket-lookup__form"
      noValidate
      onSubmit={handleSubmit(onSubmit)}
    >
      <fieldset className="ticket-lookup__fields" disabled={isPending}>
        <legend className="ticket-lookup__legend">
          Thông tin xác thực đặt vé
        </legend>
        <LookupFields register={register} errors={errors} />
        <Button type="submit" isLoading={isPending}>
          Tra cứu vé
        </Button>
      </fieldset>
    </form>
  );
}
function LookupFields({
  register,
  errors,
}: {
  register: UseFormRegister<LookupInput>;
  errors: FieldErrors<LookupInput>;
}): ReactElement {
  return (
    <>
      <Input
        label="Mã đặt vé"
        autoComplete="off"
        maxLength={TICKET_CODE_MAX_LENGTH}
        error={errors.bookingCode ? "Nhập mã đặt vé BLUE hợp lệ." : undefined}
        {...register("bookingCode")}
      />
      <Input
        label="Email hoặc số điện thoại đã đặt vé"
        autoComplete="off"
        maxLength={254}
        error={errors.verificationValue?.message}
        {...register("verificationValue")}
      />
      <p className="ticket-lookup__hint">
        Dùng email hoặc số di động của người liên hệ khi đặt vé.
      </p>
    </>
  );
}
