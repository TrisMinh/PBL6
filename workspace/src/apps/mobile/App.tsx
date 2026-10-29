import "react-native-gesture-handler";
import { NavigationContainer } from "@react-navigation/native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { StatusBar } from "expo-status-bar";
import { useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { hydrateSession } from "./src/session";
import { ForgotPasswordScreen, LoginScreen, RegisterScreen, ResetPasswordScreen, VerifyEmailScreen } from "./src/screens/Auth";
import {
  BookingDetailScreen,
  BookingsScreen,
  NotificationsScreen,
  PassengersScreen,
  PaymentScreen,
  PaymentStatusScreen,
  ProfileScreen,
  ResultsScreen,
  SearchScreen,
  TicketScreen,
  TripScreen,
} from "./src/screens/Main";
import type { AuthStackParamList, MainTabParamList, RootParamList, SearchStackParamList, TripsStackParamList } from "./src/types";

const Root = createNativeStackNavigator<RootParamList>();
const Auth = createNativeStackNavigator<AuthStackParamList>();
const Search = createNativeStackNavigator<SearchStackParamList>();
const Trips = createNativeStackNavigator<TripsStackParamList>();
const Tabs = createBottomTabNavigator<MainTabParamList>();

const stackOptions = { headerTintColor: "#0c2340", headerShadowVisible: false, headerStyle: { backgroundColor: "#f4f6fb" } } as const;

function AuthNavigator() {
  return (
    <Auth.Navigator screenOptions={stackOptions}>
      <Auth.Screen name="Login" component={LoginScreen} options={{ headerShown: false }} />
      <Auth.Screen name="Register" component={RegisterScreen} options={{ title: "Đăng ký" }} />
      <Auth.Screen name="VerifyEmail" component={VerifyEmailScreen} options={{ title: "Xác minh" }} />
      <Auth.Screen name="ForgotPassword" component={ForgotPasswordScreen} options={{ title: "Quên mật khẩu" }} />
      <Auth.Screen name="ResetPassword" component={ResetPasswordScreen} options={{ title: "Đặt lại mật khẩu" }} />
    </Auth.Navigator>
  );
}

function SearchNavigator() {
  return (
    <Search.Navigator screenOptions={stackOptions}>
      <Search.Screen name="Search" component={SearchScreen} options={{ headerShown: false }} />
      <Search.Screen name="Results" component={ResultsScreen} options={{ title: "Kết quả" }} />
      <Search.Screen name="Trip" component={TripScreen} options={{ title: "Chọn ghế" }} />
      <Search.Screen name="Passengers" component={PassengersScreen} options={{ title: "Hành khách" }} />
      <Search.Screen name="Payment" component={PaymentScreen} options={{ title: "Thanh toán" }} />
      <Search.Screen name="PaymentStatus" component={PaymentStatusScreen} options={{ title: "Kết quả" }} />
    </Search.Navigator>
  );
}

function TripsNavigator() {
  return (
    <Trips.Navigator screenOptions={stackOptions}>
      <Trips.Screen name="Bookings" component={BookingsScreen} options={{ headerShown: false }} />
      <Trips.Screen name="BookingDetail" component={BookingDetailScreen} options={{ title: "Đơn đặt vé" }} />
      <Trips.Screen name="Ticket" component={TicketScreen} options={{ title: "Vé điện tử" }} />
    </Trips.Navigator>
  );
}

function MainNavigator() {
  return (
    <Tabs.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: "#ff6a00",
        tabBarInactiveTintColor: "#5b6b82",
        tabBarStyle: { minHeight: 62, paddingTop: 6, paddingBottom: 8 },
        tabBarLabelStyle: { fontSize: 12, fontWeight: "600" },
      }}
    >
      <Tabs.Screen name="SearchTab" component={SearchNavigator} options={{ title: "Tìm chuyến" }} />
      <Tabs.Screen name="TripsTab" component={TripsNavigator} options={{ title: "Vé của tôi" }} />
      <Tabs.Screen name="NotificationsTab" component={NotificationsScreen} options={{ title: "Thông báo" }} />
      <Tabs.Screen name="ProfileTab" component={ProfileScreen} options={{ title: "Tài khoản" }} />
    </Tabs.Navigator>
  );
}

export function App() {
  const [ready, setReady] = useState(false);
  const [signedIn, setSignedIn] = useState(false);
  useEffect(() => { hydrateSession().then((session) => setSignedIn(Boolean(session))).finally(() => setReady(true)); }, []);
  if (!ready) return <View style={styles.loading}><ActivityIndicator size="large" color="#ff6a00" /></View>;
  return (
    <NavigationContainer>
      <StatusBar style="dark" />
      <Root.Navigator initialRouteName={signedIn ? "Main" : "Auth"} screenOptions={{ headerShown: false }}>
        <Root.Screen name="Auth" component={AuthNavigator} />
        <Root.Screen name="Main" component={MainNavigator} />
      </Root.Navigator>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({ loading: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#f4f6fb" } });
