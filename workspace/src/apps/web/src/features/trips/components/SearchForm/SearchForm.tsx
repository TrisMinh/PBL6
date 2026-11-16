import { isMockApi } from "@/shared/api/config";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  useEffect,
  useId,
  useRef,
  type ComponentProps,
  type ReactElement,
} from "react";
import {
  useWatch,
  useForm,
  type UseFormReturn,
} from "react-hook-form";
import type { z } from "zod";

import { tripSearchSchema } from "@/features/trips/schemas/search.schema";
import type { Location, TripSearch } from "@/features/trips/types/trip";
import { getVietnamTodayDate } from "@/shared/lib/getVietnamTodayDate";
import { Button } from "@/shared/ui/Button/Button";
import { DatePicker } from "@/shared/ui/DatePicker/DatePicker";

import "./SearchForm.css";

export interface SearchFormProps {
  locations: readonly Location[];
  onSubmit: (search: TripSearch) => void;
  withLeadingIcon?: boolean;
}

type SearchValues = z.input<typeof tripSearchSchema>;
type SearchMethods = UseFormReturn<SearchValues, unknown, TripSearch>;
type SearchSelectProps = ComponentProps<"select"> & {
  label: string;
  error?: string;
};

function SearchSelect({
  label,
  error,
  children,
  ...props
}: SearchSelectProps): ReactElement {
  const id = useId();
  const errorId = `${id}-error`;
  return (
    <div className="search-form__field">
      <label className="search-form__label" htmlFor={id}>
        {label}
      </label>
      <select
        {...props}
        id={id}
        className="search-form__control"
        aria-invalid={Boolean(error)}
        aria-describedby={error ? errorId : undefined}
      >
        {children}
      </select>
      {error ? (
        <p className="search-form__error" id={errorId}>
          {error}
        </p>
      ) : null}
    </div>
  );
}

function RouteFields({
  locations,
  form,
}: {
  locations: readonly Location[];
  form: SearchMethods;
}): ReactElement {
  const originId = useWatch({ control: form.control, name: "originId" });
  const destinationId = useWatch({
    control: form.control,
    name: "destinationId",
  });
  const fields = [
    { name: "originId", label: "Điểm đi", placeholder: "Chọn điểm đi" },
    { name: "destinationId", label: "Điểm đến", placeholder: "Chọn điểm đến" },
  ] as const;
  const provinces = new Map<string, Location>();
  for (const location of locations) {
    if (!provinces.has(location.province))
      provinces.set(location.province, location);
  }
  return (
    <>
      {fields.map(({ name, label, placeholder }) => (
        <div
          key={name}
          className={name === "originId" ? "search-form__origin" : undefined}
        >
          <SearchSelect
            label={label}
            error={
              form.formState.isSubmitted
                ? form.formState.errors[name]?.message
                : undefined
            }
            required

            {...form.register(name)}
          >
            <option value="">{placeholder}</option>
            {[...provinces.values()].map((location) => (
              <option key={location.id} value={location.id}>
                {location.province}
              </option>
            ))}
          </SearchSelect>
          {name === "originId" && (
            <button
              className="search-form__swap"
              type="button"
              aria-label="Đổi chiều hành trình"
              title="Đổi điểm đi và điểm đến"
              disabled={
                !originId || !destinationId || originId === destinationId
              }
              onClick={() => {
                form.setValue("originId", destinationId, {
                  shouldDirty: true,
                  shouldValidate: true,
                });
                form.setValue("destinationId", originId, {
                  shouldDirty: true,
                  shouldValidate: true,
                });
              }}
            >
              ⇄
            </button>
          )}
        </div>
      ))}
    </>
  );
}

function DateField({ form }: { form: SearchMethods }): ReactElement {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const field = form.register("departureDate");
  const error = form.formState.errors.departureDate?.message;
  useEffect(() => {
    if (inputRef.current) inputRef.current.min = getVietnamTodayDate();
  }, []);
  return (
    <div className="search-form__field">
      <label className="search-form__label" htmlFor="home-departure-date">
        Ngày đi
      </label>
      <DatePicker
        disablePast
        id="home-departure-date"
        className="search-form__control"
        required
        aria-invalid={Boolean(error)}
        aria-describedby={error ? "home-date-error" : undefined}
        {...field}
        ref={(input) => {
          inputRef.current = input;
          void field.ref(input);
        }}
        onFocus={(event) => {
          event.currentTarget.min = getVietnamTodayDate();
        }}
      />
      {error && (
        <p className="search-form__error" id="home-date-error">
          {error}
        </p>
      )}
    </div>
  );
}

function PassengerField({ form }: { form: SearchMethods }): ReactElement {
  return (
    <SearchSelect
      label="Hành khách"
      required

      {...form.register("passengerCount")}
    >
      {[1, 2, 3, 4, 5, 6].map((count) => (
        <option key={count} value={count}>
          {count} người
        </option>
      ))}
    </SearchSelect>
  );
}

function useSearchFields(): SearchMethods {
  return useForm<SearchValues, unknown, TripSearch>({
    resolver: zodResolver(tripSearchSchema),
    mode: "onBlur",
    reValidateMode: "onChange",
    defaultValues: {
      originId: "",
      destinationId: "",
      departureDate: "",
      passengerCount: "1",
      sort: "relevance",
    },
  });
}

export function SearchForm({
  locations,
  onSubmit,
  withLeadingIcon = false,
}: SearchFormProps): ReactElement {
  const form = useSearchFields();
  const submit = form.handleSubmit((search) => {
    if (!isMockApi) {
      const origin = locations.find(
        (location) => location.id === search.originId,
      );
      if (!origin?.destinationIds?.length) {
        form.setError("originId", {
          message: "Vui lòng chọn điểm đi trong danh sách.",
        });
        return;
      }
      if (!origin.destinationIds.includes(search.destinationId)) {
        form.setError("destinationId", {
          message: "Vui lòng chọn điểm đến có tuyến từ điểm đi này.",
        });
        return;
      }
    }
    onSubmit(search);
  });
  return (
    <form
      className={
        withLeadingIcon
          ? "search-form search-form--with-leading-icon"
          : "search-form"
      }
      aria-label="Tìm chuyến"
      noValidate
      onSubmit={(event) => {
        const date = event.currentTarget.elements.namedItem("departureDate");
        if (date instanceof HTMLInputElement) date.min = getVietnamTodayDate();
        void submit(event);
      }}
    >
      <RouteFields locations={locations} form={form} />
      <DateField form={form} />
      <PassengerField form={form} />
      <div className="search-form__action">
        <Button type="submit" isLoading={form.formState.isSubmitting}>
          Tìm chuyến
        </Button>
      </div>
    </form>
  );
}
