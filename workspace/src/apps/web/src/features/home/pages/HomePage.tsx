import type { ReactElement } from "react";

import { HomeFooter } from "@/features/home/components/HomeFooter/HomeFooter";
import { PopularRoutes } from "@/features/home/components/PopularRoutes/PopularRoutes";
import { ProductTruths } from "@/features/home/components/ProductTruths/ProductTruths";
import { SupportBanner } from "@/features/home/components/SupportBanner/SupportBanner";
import { TrustJourney } from "@/features/home/components/TrustJourney/TrustJourney";
import { HomeHero } from "@/features/trips/components/HomeHero/HomeHero";

import "./HomePage.css";

export function HomePage(): ReactElement {
  return (
    <div className="home-page">
      <HomeHero />
      <ProductTruths />
      <PopularRoutes />
      <TrustJourney />
      <SupportBanner />
      <HomeFooter />
    </div>
  );
}
