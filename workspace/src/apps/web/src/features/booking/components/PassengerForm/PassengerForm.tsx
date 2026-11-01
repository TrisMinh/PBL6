import { zodResolver } from "@hookform/resolvers/zod";
import { isMockApi } from "@/shared/api/config";
import { useId, useState, type ReactElement } from "react";
import { useForm, type UseFormReturn } from "react-hook-form";

import chevronIcon from "@/assets/booking/passenger-review/chevron.svg";
import mailIcon from "@/assets/booking/passenger-review/mail.svg";
import mobileIcon from "@/assets/booking/passenger-review/mobile.svg";
import noteIcon from "@/assets/booking/passenger-review/note.svg";
import pinIcon from "@/assets/booking/passenger-review/pin.svg";
import userIcon from "@/assets/booking/passenger-review/user.svg";
import {
  createPassengerSchema,
  type PassengerFormValues,
} from "@/features/booking/schemas/passenger.schema";
import { Button } from "@/shared/ui/Button/Button";
import { Input, type InputProps } from "@/shared/ui/Input/Input";

import "./PassengerForm.css";

export interface PassengerSeat {
  id: string;
  code: string;
}
export interface PassengerFormProps {
  seats: readonly PassengerSeat[];
  initialValues: PassengerFormValues;
  pickup: string;
  onSubmit: (values: PassengerFormValues) => void;
  isPending?: boolean;
  formId?: string;
}
type PassengerMethods = UseFormReturn<PassengerFormValues>;
const FIELD_ICONS = {
  name: userIcon,
  phone: mobileIcon,
  email: mailIcon,
  pickup: pinIcon,
  note: noteIcon,
};
function PassengerField({
  kind,
  ...props
}: InputProps & { kind: keyof typeof FIELD_ICONS }): ReactElement {
  return (
    <div className="passenger-form__input-wrap">
      <Input {...props} className="passenger-form__control" />
      <img
        alt=""
        aria-hidden="true"
        className="passenger-form__icon"
        src={FIELD_ICONS[kind]}
      />
    </div>
  );
}
interface PassengerRowProps {
  seat: PassengerSeat;
  index: number;
  form: PassengerMethods;
}
function PassengerRowFields({
  seat,
  index,
  form,
}: PassengerRowProps): ReactElement {
  const errors = form.formState.errors.passengers?.[index];
  return (
    <div className="passenger-form__fields">
      <PassengerField
        kind="name"
        label="Họ và tên"
        aria-label={`Họ và tên (ghế ${seat.code})`}
        autoComplete={`section-passenger-${seat.code} name`}
        required
        maxLength={100}
        {...form.register(`passengers.${index}.fullName`)}
        error={errors?.fullName?.message}
      />
      <PassengerField
        kind="phone"
        type="tel"
        label="Số điện thoại"
        aria-label={`Số điện thoại (ghế ${seat.code}, không bắt buộc)`}
        autoComplete={`section-passenger-${seat.code} tel`}
        maxLength={20}
        {...form.register(`passengers.${index}.phone`)}
        error={errors?.phone?.message}
      />
    </div>
  );
}
function PassengerRow({ seat, index, form }: PassengerRowProps): ReactElement {
  return (
    <fieldset className="passenger-form__card passenger-form__card--passenger">
      <legend className="passenger-form__visually-hidden">
        Ghế {seat.code} · Thông tin hành khách
      </legend>
      <div className="passenger-form__card-heading">
        <span className="passenger-form__badge">GHẾ {seat.code}</span>
        <div>
          <h2>Thông tin hành khách</h2>
          <p>Thông tin dùng để nhà xe liên hệ khi cần</p>
        </div>
      </div>
      <input
        type="hidden"
        {...form.register(`passengers.${index}.seatId`)}
        value={seat.id}
      />
      <PassengerRowFields seat={seat} index={index} form={form} />
    </fieldset>
  );
}
function DeliveryFields({ form }: { form: PassengerMethods }): ReactElement {
  const [note, setNote] = useState("Không có yêu cầu đặc biệt");
  return (
    <fieldset className="passenger-form__card passenger-form__card--delivery">
      <legend className="passenger-form__visually-hidden">
        Nhận vé và yêu cầu cho nhà xe
      </legend>
      <div className="passenger-form__card-heading passenger-form__card-heading--stacked">
        <h2>Nhận vé &amp; yêu cầu cho nhà xe</h2>
        <p>Vé điện tử và thay đổi lịch trình sẽ được gửi tới thông tin này.</p>
      </div>
      <div className="passenger-form__fields">
        <PassengerField
          kind="email"
          type="email"
          label="Email nhận vé"
          autoComplete="section-contact email"
          required
          maxLength={254}
          {...form.register("contact.email")}
          error={form.formState.errors.contact?.email?.message}
        />
        {isMockApi && (
          <PassengerField
            kind="note"
            label="Ghi chú cho nhà xe"
            maxLength={160}
            value={note}
            onChange={(event) => setNote(event.currentTarget.value)}
          />
        )}
      </div>
    </fieldset>
  );
}
function PickupField({ pickup }: { pickup: string }): ReactElement {
  return (
    <fieldset className="passenger-form__card passenger-form__card--pickup">
      <legend className="passenger-form__section-title">Điểm đón</legend>
      <PassengerField
        kind="pickup"
        label="Vị trí đón"
        readOnly
        value={pickup}
      />
      <img
        alt=""
        aria-hidden="true"
        className="passenger-form__chevron"
        src={chevronIcon}
      />
    </fieldset>
  );
}
function LegacyContactFields({
  form,
}: {
  form: PassengerMethods;
}): ReactElement {
  return (
    <div
      className={
        isMockApi
          ? "passenger-form__legacy-contact"
          : "passenger-form__card passenger-form__fields"
      }
    >
      <Input
        label="Họ và tên người liên hệ"
        autoComplete="section-contact name"
        maxLength={100}
        {...form.register("contact.fullName")}
        required
        error={form.formState.errors.contact?.fullName?.message}
      />
      <Input
        label="Số điện thoại người liên hệ"
        type="tel"
        autoComplete="section-contact tel"
        maxLength={20}
        {...form.register("contact.phone")}
        required
        error={form.formState.errors.contact?.phone?.message}
      />
    </div>
  );
}
function FormFeedback({
  form,
  id,
}: {
  form: PassengerMethods;
  id: string;
}): ReactElement | null {
  if (Object.keys(form.formState.errors).length === 0) return null;
  return (
    <p className="passenger-form__error-summary" role="alert" id={id}>
      Thông tin chưa hợp lệ. Vui lòng kiểm tra các trường bên dưới.{" "}
      {form.formState.errors.passengers?.root?.message ??
        form.formState.errors.passengers?.message}
    </p>
  );
}
function FormFields({
  props,
  form,
}: {
  props: PassengerFormProps;
  form: PassengerMethods;
}): ReactElement {
  return (
    <fieldset
      className="passenger-form__fieldset"
      disabled={props.isPending || form.formState.isSubmitting}
    >
      <legend className="passenger-form__visually-hidden">
        Thông tin người đi và liên hệ
      </legend>
      {props.seats.map((seat, index) => (
        <PassengerRow key={seat.id} seat={seat} index={index} form={form} />
      ))}
      <PickupField pickup={props.pickup} />
      <DeliveryFields form={form} />
      <LegacyContactFields form={form} />
      {!props.formId && (
        <Button
          type="submit"
          isLoading={props.isPending || form.formState.isSubmitting}
        >
          Xác nhận thông tin
        </Button>
      )}
    </fieldset>
  );
}
export function PassengerForm(props: PassengerFormProps): ReactElement {
  const id = useId();
  const form = useForm<PassengerFormValues>({
    resolver: zodResolver(
      createPassengerSchema(props.seats.map((seat) => seat.id)),
    ),
    defaultValues: props.initialValues,
  });
  const submit = (): void => {
    const values = form.getValues();
    const firstPassenger = values.passengers[0];
    form.setValue(
      "contact.fullName",
      values.contact.fullName || firstPassenger?.fullName || "",
    );
    form.setValue(
      "contact.phone",
      values.contact.phone || firstPassenger?.phone || "",
    );
    void form.handleSubmit((canonical) => props.onSubmit(canonical))();
  };
  return (
    <form
      id={props.formId ?? id}
      className="passenger-form"
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
      aria-describedby={
        Object.keys(form.formState.errors).length ? `${id}-errors` : undefined
      }
    >
      <FormFeedback form={form} id={`${id}-errors`} />
      <FormFields props={props} form={form} />
    </form>
  );
}
