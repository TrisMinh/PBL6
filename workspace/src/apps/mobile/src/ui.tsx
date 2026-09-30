import { colors, radius, space } from "@busticket/ui/theme";
import { ReactNode } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";

export function Screen({ children }: { children: ReactNode }) {
  return <View style={styles.screen}>{children}</View>;
}

export function Title({ children }: { children: ReactNode }) {
  return <Text style={styles.title}>{children}</Text>;
}

export function Muted({ children }: { children: ReactNode }) {
  return <Text style={styles.muted}>{children}</Text>;
}

export function ErrorText({ children }: { children: ReactNode }) {
  return children ? <Text style={styles.error}>{children}</Text> : null;
}

export function Field({ label, ...props }: { label: string } & React.ComponentProps<typeof TextInput>) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput placeholderTextColor={colors.neutral700} style={styles.input} {...props} />
    </View>
  );
}

export function Button({
  title,
  onPress,
  disabled,
  danger,
}: {
  title: string;
  onPress: () => void;
  disabled?: boolean;
  danger?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={disabled}
      style={[styles.button, danger && styles.danger, disabled && styles.disabled]}
    >
      <Text style={styles.buttonText}>{title}</Text>
    </Pressable>
  );
}

export function Card({ children, onPress }: { children: ReactNode; onPress?: () => void }) {
  if (onPress) {
    return (
      <Pressable onPress={onPress} style={styles.card}>
        {children}
      </Pressable>
    );
  }
  return <View style={styles.card}>{children}</View>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background, padding: space[4], gap: space[4] },
  title: { fontSize: 28, lineHeight: 36, color: colors.neutral950, fontWeight: "700" },
  muted: { color: colors.neutral700, fontSize: 14 },
  error: { color: colors.danger700 },
  field: { gap: space[1] },
  label: { fontSize: 14, color: colors.neutral700 },
  input: {
    minHeight: 44,
    borderWidth: 1,
    borderColor: colors.neutral300,
    borderRadius: radius.sm,
    paddingHorizontal: space[3],
    backgroundColor: colors.surface,
    color: colors.neutral950,
  },
  button: {
    minHeight: 44,
    borderRadius: radius.sm,
    backgroundColor: colors.action700,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: space[4],
  },
  danger: { backgroundColor: colors.danger700 },
  disabled: { opacity: 0.6 },
  buttonText: { color: colors.surface, fontWeight: "600" },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: space[4],
    gap: space[2],
  },
});
