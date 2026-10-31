import { useCallback, useEffect, useMemo } from "react";
import { useSearchParams } from "react-router";

import {
  parseAdminListParams,
  type AdminListParams,
} from "@/features/admin/schemas/adminListParams.schema";

const LIST_PARAM_KEYS = [
  "query",
  "status",
  "organizationId",
  "page",
  "pageSize",
] as const;
const FILTER_PARAM_KEYS = ["query", "status", "organizationId"] as const;

export interface AdminListParamsPatch {
  query?: string | undefined;
  status?: AdminListParams["status"] | undefined;
  organizationId?: string | undefined;
  page?: number | undefined;
  pageSize?: number | undefined;
}

export interface UseAdminListParamsResult {
  params: AdminListParams;
  updateParams: (patch: AdminListParamsPatch) => void;
}

function writeOptional(
  target: URLSearchParams,
  key: string,
  value: string | undefined,
): void {
  if (value !== undefined) target.set(key, value);
}

function serializeListParams(
  source: URLSearchParams,
  params: AdminListParams,
): URLSearchParams {
  const next = new URLSearchParams(source);
  LIST_PARAM_KEYS.forEach((key) => next.delete(key));
  writeOptional(next, "query", params.query);
  writeOptional(next, "status", params.status);
  writeOptional(next, "organizationId", params.organizationId);
  if (params.page !== 1) next.set("page", String(params.page));
  if (params.pageSize !== 20) next.set("pageSize", String(params.pageSize));
  return next;
}

function isFilterPatch(patch: AdminListParamsPatch): boolean {
  return FILTER_PARAM_KEYS.some((key) =>
    Object.prototype.hasOwnProperty.call(patch, key),
  );
}

function mergeParams(
  params: AdminListParams,
  patch: AdminListParamsPatch,
): AdminListParams {
  const page = isFilterPatch(patch) ? 1 : (patch.page ?? params.page);
  return {
    ...params,
    ...patch,
    page,
    pageSize: patch.pageSize ?? params.pageSize,
  };
}

export function useAdminListParams(): UseAdminListParamsResult {
  const [searchParams, setSearchParams] = useSearchParams();
  const rawSearch = searchParams.toString();
  const params = useMemo(
    () => parseAdminListParams(new URLSearchParams(rawSearch)),
    [rawSearch],
  );
  const canonicalSearch = useMemo(
    () =>
      serializeListParams(new URLSearchParams(rawSearch), params).toString(),
    [params, rawSearch],
  );

  useEffect(() => {
    if (canonicalSearch !== rawSearch)
      setSearchParams(canonicalSearch, { replace: true });
  }, [canonicalSearch, rawSearch, setSearchParams]);

  const updateParams = useCallback(
    (patch: AdminListParamsPatch): void => {
      const next = serializeListParams(
        searchParams,
        mergeParams(params, patch),
      );
      if (next.toString() !== rawSearch) setSearchParams(next);
    },
    [params, rawSearch, searchParams, setSearchParams],
  );

  return { params, updateParams };
}
