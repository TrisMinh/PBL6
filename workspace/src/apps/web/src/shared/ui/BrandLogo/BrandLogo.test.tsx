import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import officialLogo from "@/assets/brand/blue-official-logo.png";
import { BrandLogo } from "@/shared/ui/BrandLogo/BrandLogo";

describe("BrandLogo", () => {
  it.each(["header", "footer", "auth"] as const)(
    "renders the local official image for the %s placement without a text-logo",
    (placement) => {
      const { container } = render(<BrandLogo placement={placement} />);
      const image = screen.getByRole("img", { name: "BLUE" });

      expect(image).toHaveAttribute("src", officialLogo);
      expect(image).toHaveAttribute("width", "1021");
      expect(image).toHaveAttribute("height", "406");
      expect(container).not.toHaveTextContent(/^BLUE$/);
      expect(container.firstElementChild).toHaveClass(
        "brand-logo",
        `brand-logo--${placement}`,
      );
    },
  );
});
