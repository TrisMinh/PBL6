import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { exploreRepository } from "@/features/explore/exploreRepository";
import type {
  ProvinceDetail,
  ProvinceSummary,
} from "@/features/explore/explore.schema";

export function useExploreProvinces(): UseQueryResult<
  ProvinceSummary[],
  Error
> {
  return useQuery({
    queryKey: ["explore", "provinces"],
    queryFn: ({ signal }) => exploreRepository.list(signal),
  });
}
export function useExploreProvince(
  slug: string,
): UseQueryResult<ProvinceDetail, Error> {
  return useQuery({
    queryKey: ["explore", "province", slug],
    queryFn: ({ signal }) => exploreRepository.detail(slug, signal),
  });
}
