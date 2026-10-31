import { operatorRefundHandlers } from "@/mocks/handlers/operatorRefundHandlers";
import { operatorDriverHandlers } from "@/mocks/handlers/operatorDriverHandlers";
import { operatorReportHandlers } from "@/mocks/handlers/operatorReportHandlers";
import { operatorVehicleHandlers } from "@/mocks/handlers/operatorVehicleHandlers";
import { operatorStopCatalogueHandlers } from "@/mocks/handlers/operatorStopCatalogueHandlers";
import { operatorRouteHandlers } from "@/mocks/handlers/operatorRouteHandlers";
import { operatorTripListHandlers } from "@/mocks/handlers/operatorTripListHandlers";
import { operatorBookingHandlers } from "@/mocks/handlers/operatorBookingHandlers";
import { operatorScheduleHandlers } from "@/mocks/handlers/operatorScheduleHandlers";
import { http, HttpResponse } from "msw";

import { authHandlers } from "@/mocks/handlers/authHandlers";
import { paymentHandlers } from "@/mocks/handlers/paymentHandlers";
import { ticketHandlers } from "@/mocks/handlers/ticketHandlers";
import { locationHandlers } from "@/mocks/handlers/locationHandlers";
import { tripHandlers } from "@/mocks/handlers/tripHandlers";
import { bookingHandlers } from "@/mocks/handlers/bookingHandlers";
import { orderHandlers } from "@/mocks/handlers/createBookingHandlers";
import { cancellationHandlers } from "@/mocks/handlers/cancellationHandlers";
import { adminHandlers } from "@/mocks/handlers/admin/createCrudHandlers";
import { exploreHandlers } from "@/mocks/handlers/exploreHandlers";

export const handlers = [
  ...operatorRefundHandlers,
  ...operatorDriverHandlers,
  ...operatorReportHandlers,
  ...operatorVehicleHandlers,
  ...operatorStopCatalogueHandlers,
  ...operatorRouteHandlers,
  ...operatorTripListHandlers,
  ...operatorBookingHandlers,
  ...operatorScheduleHandlers,
  ...exploreHandlers,
  ...authHandlers,
  ...ticketHandlers,
  ...paymentHandlers,
  ...locationHandlers,
  ...tripHandlers,
  ...bookingHandlers,
  ...orderHandlers,
  ...cancellationHandlers,
  ...adminHandlers,
  http.get("/api/v1/health", () => HttpResponse.json({ status: "ok" })),
];
