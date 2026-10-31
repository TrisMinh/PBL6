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
  Controller,
  useWatch,
  useForm,
  type UseFormReturn,
} from "react-hook-form";
import { LocationCombobox } from "./LocationCombobox";
import type { z } from "zod";

import { tripSearchSchema } from "@/features/trips/schemas/search.schema";
import type { Location, TripSearch } from "@/features/trips/types/trip";
import { getVietnamTodayDate } from "@/shared/lib/getVietnamTodayDate";
import { Button } from "@/shared/ui/Button/Button";
import { Input } from "@/shared/ui/Input/Input";

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

function LiveRouteFields({
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
  const origins = locations.filter(
    (location) => location.destinationIds?.length,
  );
  const allowed = locations.find(
    (location) => location.id === originId,
  )?.destinationIds;
  const destinationIds = new Set(
    originId
      ? (allowed ?? [])
      : locations.flatMap((location) => location.destinationIds ?? []),
  );
  const destinations = locations.filter(
    (location) => location.id !== originId && destinationIds.has(location.id),
  );
  const canSwap = Boolean(
    originId &&
    destinationId &&
    locations
      .find((location) => location.id === destinationId)
      ?.destinationIds?.includes(originId),
  );
  return (
    <>
      <div className="search-form__origin">
        <Controller
          name="originId"
          control={form.control}
          render={({ field, fieldState }) => (
            <LocationCombobox
              label="Điểm đi"
              placeholder="Chọn hoặc tìm điểm đi"
              options={origins}
              value={field.value}
              onBlur={field.onBlur}
              error={fieldState.error?.message}
              onChange={(value) => {
                field.onChange(value);
                if (
                  destinationId &&
                  !locations
                    .find((location) => location.id === value)
                    ?.destinationIds?.includes(destinationId)
                )
                  form.setValue("destinationId", "", {
                    shouldDirty: true,
                    shouldValidate: true,
                  });
              }}
            />
          )}
        />
        <button
          className="search-form__swap"
          type="button"
          aria-label="Đổi chiều hành trình"
          disabled={!canSwap}
          title={
            canSwap
              ? "Đổi điểm đi và điểm đến"
              : "Chưa có tuyến chiều ngược lại"
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
      </div>
      <Controller
        name="destinationId"
        control={form.control}
        render={({ field, fieldState }) => (
          <LocationCombobox
            label="Điểm đến"
            placeholder="Chọn hoặc tìm điểm đến"
            options={destinations}
            value={field.value}
            onChange={field.onChange}
            onBlur={field.onBlur}
            error={fieldState.error?.message}
          />
        )}
      />
    </>
  );
}

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
        <p className="search-form__error" id={errorId} role="alert">
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
  const fields = [
    { name: "originId", label: "Điểm đi", placeholder: "Chọn điểm đi" },
    { name: "destinationId", label: "Điểm đến", placeholder: "Chọn điểm đến" },
  ] as const;
  if (!isMockApi) return <LiveRouteFields locations={locations} form={form} />;
  return (
    <>
      {fields.map(({ name, label, placeholder }) => (
        <SearchSelect
          key={name}
          label={label}
          required
          error={form.formState.errors[name]?.message}
          {...form.register(name)}
        >
          <option value="">{placeholder}</option>
          {locations.map((location) => (
            <option key={location.id} value={location.id}>
              {location.name} · {location.province}
            </option>
          ))}
        </SearchSelect>
      ))}
    </>
  );
}

function DateField({ form }: { form: SearchMethods }): ReactElement {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const field = form.register("departureDate");
  useEffect(() => {
    if (inputRef.current) inputRef.current.min = getVietnamTodayDate();
  }, []);
  return (
    <Input
      label="Ngày đi"
      type="date"
      className="search-form__control"
      required
      error={form.formState.errors.departureDate?.message}
      {...field}
      ref={(input) => {
        inputRef.current = input;
        void field.ref(input);
      }}
      onFocus={(event) => {
        event.currentTarget.min = getVietnamTodayDate();
      }}
    />
  );
}

function PassengerField({ form }: { form: SearchMethods }): ReactElement {
  return (
    <SearchSelect
      label="Hành khách"
      required
      error={form.formState.errors.passengerCount?.message}
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
