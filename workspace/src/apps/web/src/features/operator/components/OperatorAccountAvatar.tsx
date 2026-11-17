import { useQuery } from "@tanstack/react-query";
import type { ReactElement } from "react";
import { Link } from "react-router";
import { Bus } from "@phosphor-icons/react/dist/csr/Bus";
import { metadata, request } from "../liveOriginalApi";
import { liveQueryKey } from "@/shared/api/liveRequest";

export function OperatorAccountAvatar(): ReactElement {
  const { data } = useQuery({
    queryKey: liveQueryKey("operator", "organization-brand"),
    queryFn: async () => {
      const [organization, logos] = await Promise.all([
        request("/api/v1/operator/organization"),
        metadata("organization"),
      ]);
      return {
        name: organization.name as string,
        logo: (logos[organization.id]?.logoUrl ?? "") as string,
      };
    },
    staleTime: 60_000,
  });
  return (
    <Link
      to="/operator/organization"
      className="operator-workspace__header-avatar"
      aria-label="Nhà xe của tôi"
      title={data?.name ?? "Nhà xe của tôi"}
    >
      <span>
        {data?.logo ? (
          <img
            src={data.logo}
            alt=""
            onError={(event) => {
              event.currentTarget.style.display = "none";
            }}
          />
        ) : (
          <Bus size={25} weight="duotone" />
        )}
      </span>
    </Link>
  );
}
