export type AuthStackParamList = {
  Login: undefined;
  Register: undefined;
  VerifyEmail: { challengeId: string };
  ForgotPassword: undefined;
  ResetPassword: { challengeId: string };
};

export type SearchStackParamList = {
  Search: undefined;
  Results: { origin: string; destination: string; departureDate: string; passengerCount: string };
  Trip: { tripId: string };
  Passengers: { holdToken: string };
  Payment: { bookingId: string };
  PaymentStatus: { paymentId: string };
};

export type TripsStackParamList = {
  Bookings: undefined;
  BookingDetail: { bookingId: string };
  Ticket: { ticketId: string };
};

export type MainTabParamList = {
  SearchTab: undefined;
  TripsTab: undefined;
  NotificationsTab: undefined;
  ProfileTab: undefined;
};

export type RootParamList = {
  Auth: undefined;
  Main: undefined;
};
