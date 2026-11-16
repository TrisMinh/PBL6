import { useId, type ReactElement } from "react";
import { Link } from "react-router";
import { ArrowLeft } from "@phosphor-icons/react/dist/csr/ArrowLeft";
import officialLogo from "@/assets/brand/blue-official-logo.png";
import "./BrandLoading.css";

interface BrandLoadingProps {
  title: string;
  description?: string;
  backHref?: string;
}

export function BrandLoading({
  title,
  description = "Vui lòng đợi trong giây lát.",
  backHref,
}: BrandLoadingProps): ReactElement {
  const titleId = useId();
  return (
    <section
      className="brand-loading"
      aria-labelledby={titleId}
      aria-busy="true"
    >
      <div className="brand-loading__visual" aria-hidden="true">
        <div className="brand-loading__halo" />
        <div className="brand-loading__logo">
          <img src={officialLogo} alt="" width={1021} height={406} />
        </div>
        <div className="brand-loading__road">
          <span className="brand-loading__lane" />
          <span className="brand-loading__light" />
        </div>
      </div>
      <div className="brand-loading__copy" role="status" aria-live="polite">
        <h1 id={titleId}>{title}</h1>
        <p>{description}</p>
      </div>
      {backHref && (
        <Link className="brand-loading__back" to={backHref}>
          <ArrowLeft size={16} aria-hidden="true" />
          Quay lại
        </Link>
      )}
    </section>
  );
}
