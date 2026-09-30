import { ApiError } from "@busticket/api-client";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useState } from "react";
import { Button, ErrorText, Field, Screen, Title } from "../ui";
import { api } from "../session";
import type { AuthStackParamList } from "../types";

function message(error: unknown) {
  return error instanceof ApiError ? `${error.code}: ${error.message}` : "Không thực hiện được.";
}

type Props<T extends keyof AuthStackParamList> = NativeStackScreenProps<AuthStackParamList, T>;

export function LoginScreen({ navigation }: Props<"Login">) {
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  return (
    <Screen>
      <Title>Đăng nhập</Title>
      <Field label="Email hoặc số điện thoại" autoCapitalize="none" value={identifier} onChangeText={setIdentifier} />
      <Field label="Mật khẩu" secureTextEntry value={password} onChangeText={setPassword} />
      <ErrorText>{error}</ErrorText>
      <Button
        title="Đăng nhập"
        onPress={async () => {
          try {
            await api.login(identifier, password);
            navigation.getParent()?.navigate("Main" as never);
          } catch (err) {
            setError(message(err));
          }
        }}
      />
      <Button title="Đăng ký" onPress={() => navigation.navigate("Register")} />
      <Button title="Quên mật khẩu" onPress={() => navigation.navigate("ForgotPassword")} />
    </Screen>
  );
}

export function RegisterScreen({ navigation }: Props<"Register">) {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  return (
    <Screen>
      <Title>Đăng ký</Title>
      <Field label="Họ tên" value={fullName} onChangeText={setFullName} />
      <Field label="Email" autoCapitalize="none" value={email} onChangeText={setEmail} />
      <Field label="Số điện thoại" value={phone} onChangeText={setPhone} />
      <Field label="Mật khẩu (chữ + số, ≥ 10)" secureTextEntry value={password} onChangeText={setPassword} />
      <ErrorText>{error}</ErrorText>
      <Button
        title="Tạo tài khoản"
        onPress={async () => {
          try {
            const result = await api.register({ fullName, email, phone, password });
            navigation.navigate("VerifyEmail", { challengeId: result.operationId });
          } catch (err) {
            setError(message(err));
          }
        }}
      />
    </Screen>
  );
}

export function VerifyEmailScreen({ route, navigation }: Props<"VerifyEmail">) {
  const [challengeId, setChallengeId] = useState(route.params.challengeId);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  return (
    <Screen>
      <Title>Xác minh email</Title>
      <Field label="Mã xác minh" value={challengeId} onChangeText={setChallengeId} />
      <Field label="OTP" value={code} onChangeText={setCode} />
      <ErrorText>{error}</ErrorText>
      <Button
        title="Xác minh"
        onPress={async () => {
          try {
            await api.verify({ challengeId, code });
            navigation.navigate("Login");
          } catch (err) {
            setError(message(err));
          }
        }}
      />
    </Screen>
  );
}

export function ForgotPasswordScreen({ navigation }: Props<"ForgotPassword">) {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  return (
    <Screen>
      <Title>Quên mật khẩu</Title>
      <Field label="Email" autoCapitalize="none" value={email} onChangeText={setEmail} />
      <ErrorText>{error}</ErrorText>
      <Button
        title="Gửi mã"
        onPress={async () => {
          try {
            const result = await api.forgotPassword(email);
            navigation.navigate("ResetPassword", { challengeId: result.operationId });
          } catch (err) {
            setError(message(err));
          }
        }}
      />
    </Screen>
  );
}

export function ResetPasswordScreen({ route, navigation }: Props<"ResetPassword">) {
  const [challengeId, setChallengeId] = useState(route.params.challengeId);
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  return (
    <Screen>
      <Title>Đặt lại mật khẩu</Title>
      <Field label="Mã xác minh" value={challengeId} onChangeText={setChallengeId} />
      <Field label="OTP" value={code} onChangeText={setCode} />
      <Field label="Mật khẩu mới" secureTextEntry value={newPassword} onChangeText={setNewPassword} />
      <ErrorText>{error}</ErrorText>
      <Button
        title="Cập nhật"
        onPress={async () => {
          try {
            await api.resetPassword({ challengeId, code, newPassword });
            navigation.navigate("Login");
          } catch (err) {
            setError(message(err));
          }
        }}
      />
    </Screen>
  );
}
