import type { Booking, Payment, Seat, Ticket, Trip } from "@busticket/api-client";
import type { BottomTabScreenProps } from "@react-navigation/bottom-tabs";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useEffect, useState } from "react";
import { Alert, Linking, ScrollView, StyleSheet, Text, View } from "react-native";
import { api, loadTicketCache, saveTicketCache, secureSession } from "../session";
import type { MainTabParamList, RootParamList, SearchStackParamList, TripsStackParamList } from "../types";
import { Button, Card, ErrorText, Field, Muted, Screen, Title } from "../ui";

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Không thực hiện được. Kiểm tra kết nối rồi thử lại.";
}

export function SearchScreen({ navigation }: NativeStackScreenProps<SearchStackParamList, "Search">) {
  const [origin, setOrigin] = useState("Seed Origin Station");
  const [destination, setDestination] = useState("Seed Destination Station");
  const [departureDate, setDepartureDate] = useState("2026-12-01");
  return (
    <Screen>
      <Muted>CHUYẾN ĐI TIẾP THEO</Muted>
      <Title>Tìm ghế, giữ chỗ, lên xe.</Title>
      <Card>
        <Field label="Điểm đi" value={origin} onChangeText={setOrigin} />
        <Field label="Điểm đến" value={destination} onChangeText={setDestination} />
        <Field label="Ngày khởi hành (YYYY-MM-DD)" value={departureDate} onChangeText={setDepartureDate} />
        <Button
          title="Tìm chuyến"
          onPress={() => navigation.navigate("Results", { origin, destination, departureDate, passengerCount: "1" })}
        />
      </Card>
      <Muted>Giá và số ghế được đọc trực tiếp từ hệ thống tại thời điểm tìm kiếm.</Muted>
    </Screen>
  );
}

export function ResultsScreen({ route, navigation }: NativeStackScreenProps<SearchStackParamList, "Results">) {
  const [items, setItems] = useState<Trip[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    const query = new URLSearchParams({ ...route.params, page: "0", size: "20" });
    api.searchTrips(query).then((page) => setItems(page.items)).catch((reason) => setError(errorMessage(reason))).finally(() => setLoading(false));
  }, [route.params]);
  return (
    <ScrollView contentContainerStyle={styles.scroll}>
      <Title>Chuyến phù hợp</Title>
      {loading ? <Muted>Đang kiểm tra ghế trống…</Muted> : null}
      <ErrorText>{error}</ErrorText>
      {items.map((trip) => (
        <Card key={trip.id} onPress={() => navigation.navigate("Trip", { tripId: trip.id })}>
          <Text style={styles.route}>{trip.origin} → {trip.destination}</Text>
          <Text>{new Date(trip.departureAt).toLocaleString("vi-VN")}</Text>
          <Muted>{trip.operatorName} · còn {trip.availableSeatCount ?? "—"} ghế</Muted>
          <Text style={styles.price}>{trip.fare.amount.toLocaleString("vi-VN")} {trip.fare.currency}</Text>
        </Card>
      ))}
      {!loading && items.length === 0 ? <Muted>Không có chuyến bán được trong ngày này. Đổi ngày hoặc điểm đón.</Muted> : null}
    </ScrollView>
  );
}

export function TripScreen({ route, navigation }: NativeStackScreenProps<SearchStackParamList, "Trip">) {
  const [trip, setTrip] = useState<Trip | null>(null);
  const [seats, setSeats] = useState<Seat[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    Promise.all([api.getTrip(route.params.tripId), api.getSeats(route.params.tripId)])
      .then(([nextTrip, inventory]) => { setTrip(nextTrip); setSeats(inventory.seats); })
      .catch((reason) => setError(errorMessage(reason)));
  }, [route.params.tripId]);
  const available = seats.filter((seat) => seat.status === "AVAILABLE");
  return (
    <ScrollView contentContainerStyle={styles.scroll}>
      <Title>{trip ? `${trip.origin} → ${trip.destination}` : "Chọn ghế"}</Title>
      <ErrorText>{error}</ErrorText>
      <View style={styles.seatGrid}>
        {seats.map((seat) => (
          <View key={seat.id} style={styles.seatCell}>
            <Button title={`${seat.code}${selected === seat.id ? " ✓" : ""}`} disabled={seat.status !== "AVAILABLE"} onPress={() => setSelected(seat.id)} />
          </View>
        ))}
      </View>
      {available.length === 0 ? <Muted>Chuyến này đã hết ghế.</Muted> : null}
      <Button
        title="Giữ ghế 10 phút"
        disabled={!selected || !trip}
        onPress={async () => {
          if (!selected || !trip) return;
          const pickup = trip.stops.find((stop) => stop.pickupAllowed) ?? trip.stops[0];
          const dropoff = [...trip.stops].reverse().find((stop) => stop.dropoffAllowed) ?? trip.stops.at(-1);
          if (!pickup || !dropoff) { setError("Chuyến chưa có điểm đón/trả hợp lệ."); return; }
          try {
            const hold = await api.createHold(trip.id, { seatIds: [selected], pickupStopId: pickup.id, dropoffStopId: dropoff.id });
            navigation.navigate("Passengers", { holdToken: hold.holdToken, pickupStopId: pickup.id, dropoffStopId: dropoff.id });
          } catch (reason) { setError(errorMessage(reason)); }
        }}
      />
    </ScrollView>
  );
}

export function PassengersScreen({ route, navigation }: NativeStackScreenProps<SearchStackParamList, "Passengers">) {
  const session = secureSession.read();
  const [hold, setHold] = useState<Awaited<ReturnType<typeof api.getHold>> | null>(null);
  const [fullName, setFullName] = useState(session?.user.fullName ?? "");
  const [email, setEmail] = useState(session?.user.email ?? "");
  const [phone, setPhone] = useState(session?.user.phone ?? "");
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { api.getHold(route.params.holdToken).then(setHold).catch((reason) => setError(errorMessage(reason))); }, [route.params.holdToken]);
  return (
    <ScrollView contentContainerStyle={styles.scroll}>
      <Title>Thông tin hành khách</Title>
      {hold ? <Muted>Ghế {hold.seats.map((seat) => seat.code).join(", ")} · giữ đến {new Date(hold.expiresAt).toLocaleTimeString("vi-VN")}</Muted> : null}
      <Field label="Họ tên" value={fullName} onChangeText={setFullName} />
      <Field label="Email" autoCapitalize="none" value={email} onChangeText={setEmail} />
      <Field label="Điện thoại" value={phone} onChangeText={setPhone} />
      <ErrorText>{error}</ErrorText>
      <Button
        title="Tạo đơn và thanh toán"
        disabled={!hold || !fullName || !email || !phone}
        onPress={async () => {
          if (!hold) return;
          const total = hold.seats.reduce((sum, seat) => sum + seat.price.amount, 0);
          try {
            const booking = await api.createBooking({
              holdToken: hold.holdToken,
              contact: { fullName, email, phone },
              passengers: hold.seats.map((seat) => ({ seatId: seat.id, fullName, pickupStopId: route.params.pickupStopId, dropoffStopId: route.params.dropoffStopId })),
              expectedTotal: total, currency: "VND", paymentChannel: "PREPAID",
            });
            navigation.navigate("Payment", { bookingId: booking.id });
          } catch (reason) { setError(errorMessage(reason)); }
        }}
      />
    </ScrollView>
  );
}

export function PaymentScreen({ route, navigation }: NativeStackScreenProps<SearchStackParamList, "Payment">) {
  const [error, setError] = useState<string | null>(null);
  return (
    <Screen>
      <Title>Thanh toán an toàn</Title>
      <Muted>Ứng dụng mở cổng VNPay sandbox. Trạng thái chỉ đổi sau callback đã xác minh.</Muted>
      <ErrorText>{error}</ErrorText>
      <Button title="Mở VNPay" onPress={async () => {
        try {
          const payment = await api.createPayment(route.params.bookingId, { provider: "VNPAY_SANDBOX", method: "VNPAY_QR", returnUri: "busticket://payment/result" });
          if (payment.providerAction?.redirectUri) await Linking.openURL(payment.providerAction.redirectUri);
          navigation.navigate("PaymentStatus", { paymentId: payment.id });
        } catch (reason) { setError(errorMessage(reason)); }
      }} />
    </Screen>
  );
}

export function PaymentStatusScreen({ route }: NativeStackScreenProps<SearchStackParamList, "PaymentStatus">) {
  const [payment, setPayment] = useState<Payment | null>(null);
  const [error, setError] = useState<string | null>(null);
  const reload = () => api.getPayment(route.params.paymentId).then(setPayment).catch((reason) => setError(errorMessage(reason)));
  useEffect(() => { void reload(); }, [route.params.paymentId]);
  return <Screen><Title>Trạng thái thanh toán</Title><Card><Text style={styles.route}>{payment?.status ?? "Đang kiểm tra…"}</Text><Muted>{payment ? `${payment.amount.toLocaleString("vi-VN")} ${payment.currency}` : route.params.paymentId}</Muted></Card><ErrorText>{error}</ErrorText><Button title="Kiểm tra lại" onPress={reload} /></Screen>;
}

export function BookingsScreen({ navigation }: NativeStackScreenProps<TripsStackParamList, "Bookings">) {
  const [items, setItems] = useState<Booking[]>([]);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { api.listBookings().then((page) => setItems(page.items)).catch((reason) => setError(errorMessage(reason))); }, []);
  return <ScrollView contentContainerStyle={styles.scroll}><Title>Chuyến của tôi</Title><ErrorText>{error}</ErrorText>{items.map((booking) => <Card key={booking.id} onPress={() => navigation.navigate("BookingDetail", { bookingId: booking.id })}><Text style={styles.route}>{booking.code}</Text><Text>{booking.status}</Text><Muted>{booking.total.toLocaleString("vi-VN")} {booking.currency}</Muted></Card>)}{items.length === 0 ? <Muted>Chưa có đơn. Tìm chuyến để bắt đầu.</Muted> : null}</ScrollView>;
}

export function BookingDetailScreen({ route, navigation }: NativeStackScreenProps<TripsStackParamList, "BookingDetail">) {
  const [booking, setBooking] = useState<Booking | null>(null);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [error, setError] = useState<string | null>(null);
  const reload = () => Promise.all([api.getBooking(route.params.bookingId), api.listTickets()]).then(([nextBooking, page]) => { setBooking(nextBooking); const mine = page.items.filter((ticket) => ticket.bookingId === route.params.bookingId); setTickets(mine); void saveTicketCache(mine); }).catch((reason) => setError(errorMessage(reason)));
  useEffect(() => { void reload(); }, [route.params.bookingId]);
  async function requestCancellation() {
    if (!booking) return;
    try {
      const ticketIds = tickets.filter((ticket) => ticket.status !== "CANCELLED").map((ticket) => ticket.id);
      if (ticketIds.length === 0) throw new Error("Đơn không còn vé có thể hủy.");
      const preview = await api.previewCancel(booking.id, ticketIds);
      Alert.alert(
        "Xác nhận hủy vé",
        `Phí hủy ${preview.fee.toLocaleString("vi-VN")} ${preview.currency}. Hoàn lại ${preview.refundAmount.toLocaleString("vi-VN")} ${preview.currency}.`,
        [
          { text: "Giữ vé", style: "cancel" },
          { text: "Hủy vé", style: "destructive", onPress: () => { void api.cancelBooking(booking.id, { previewId: preview.previewId, reason: "CUSTOMER_CANCELLATION", expectedVersion: booking.rowVersion }).then(reload).catch((reason) => setError(errorMessage(reason))); } },
        ],
      );
    } catch (reason) { setError(errorMessage(reason)); }
  }
  const cancellable = booking && !["CANCELLED", "EXPIRED", "COMPLETED"].includes(booking.status);
  return <ScrollView contentContainerStyle={styles.scroll}><Title>{booking?.code ?? "Chi tiết đơn"}</Title><ErrorText>{error}</ErrorText>{booking ? <Card><Text style={styles.route}>{booking.status}</Text><Text>{booking.total.toLocaleString("vi-VN")} {booking.currency}</Text><Muted>{booking.items.length} hành khách · {booking.paymentChannel}</Muted></Card> : null}{tickets.map((ticket) => <Card key={ticket.id} onPress={() => navigation.navigate("Ticket", { ticketId: ticket.id })}><Text style={styles.route}>Ghế {ticket.seatCode}</Text><Text>{ticket.passengerName}</Text><Muted>{ticket.status}</Muted></Card>)}{cancellable ? <Button title="Xem phí và hủy vé" danger onPress={requestCancellation} /> : null}</ScrollView>;
}

export function TicketScreen({ route }: NativeStackScreenProps<TripsStackParamList, "Ticket">) {
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [offline, setOffline] = useState(false);
  useEffect(() => { api.getTicket(route.params.ticketId).then((next) => { setTicket(next); void saveTicketCache([next]); }).catch(async () => { const cache = await loadTicketCache(); setTicket(cache?.tickets.find((item) => item.id === route.params.ticketId) ?? null); setOffline(true); }); }, [route.params.ticketId]);
  return <Screen><Title>Vé điện tử</Title>{offline ? <Muted>Bản lưu offline — kiểm tra lại khi có mạng.</Muted> : null}<Card><Text style={styles.ticketCode}>{ticket?.publicCode ?? "Đang tải…"}</Text><Text style={styles.route}>Ghế {ticket?.seatCode ?? "—"}</Text><Muted>{ticket?.passengerName ?? ""} · {ticket?.status ?? ""}</Muted></Card></Screen>;
}

export function NotificationsScreen(_: BottomTabScreenProps<MainTabParamList, "NotificationsTab">) {
  const [items, setItems] = useState<Awaited<ReturnType<typeof api.listNotifications>>["items"]>([]);
  const [error, setError] = useState<string | null>(null);
  const reload = () => api.listNotifications().then((page) => setItems(page.items)).catch((reason) => setError(errorMessage(reason)));
  useEffect(() => { void reload(); }, []);
  return <ScrollView contentContainerStyle={styles.scroll}><Title>Thông báo</Title><ErrorText>{error}</ErrorText>{items.map((item) => <Card key={item.id} onPress={async () => { if (!item.read) await api.markNotificationRead(item.id); await reload(); }}><Text style={styles.route}>{item.title}</Text><Text>{item.body}</Text><Muted>{new Date(item.createdAt).toLocaleString("vi-VN")}{item.read ? " · Đã đọc" : " · Chạm để đánh dấu đã đọc"}</Muted></Card>)}{items.length === 0 ? <Muted>Chưa có thông báo mới.</Muted> : null}</ScrollView>;
}

export function ProfileScreen({ navigation }: BottomTabScreenProps<MainTabParamList, "ProfileTab">) {
  const session = secureSession.read();
  return <Screen><Title>Tài khoản</Title><Card><Text style={styles.route}>{session?.user.fullName}</Text><Text>{session?.user.email}</Text><Muted>{session?.user.roles.join(", ")}</Muted></Card><Button title="Đăng xuất" danger onPress={async () => { await api.logout(); navigation.getParent()?.getParent()?.navigate("Auth" as keyof RootParamList); }} /></Screen>;
}

const styles = StyleSheet.create({
  scroll: { padding: 16, gap: 16, backgroundColor: "#f4f6fb", flexGrow: 1 },
  route: { fontSize: 18, lineHeight: 24, fontWeight: "700", color: "#142033" },
  price: { color: "#ff6a00", fontWeight: "800", fontSize: 20 },
  seatGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  seatCell: { width: "30%" },
  ticketCode: { fontSize: 30, letterSpacing: 2, color: "#16375f", fontWeight: "800" },
});
