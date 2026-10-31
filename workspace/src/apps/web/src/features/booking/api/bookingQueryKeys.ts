export const bookingKeys = {
  seats: (tripId: string): readonly ["booking", "seats", string] => {
    const key: readonly ["booking", "seats", string] = [
      "booking",
      "seats",
      tripId,
    ];
    return Object.freeze(key);
  },
};
