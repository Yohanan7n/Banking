import React, { useState } from "react";
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
  ActivityIndicator,
} from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import * as SecureStore from "expo-secure-store";
import { api } from "../api";
import type { RootStackParamList } from "../navigation/types";

type Props = NativeStackScreenProps<RootStackParamList, "Register">;

export default function RegisterScreen({ navigation }: Props) {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [errors, setErrors] = useState<{ [key: string]: string }>({});
  const [loading, setLoading] = useState(false);

  const validateEmail = (val: string) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val.trim());
  };

  const showAlert = (title: string, message: string) => {
    if (Platform.OS === "web") {
      alert(`${title}: ${message}`);
    } else {
      Alert.alert(title, message);
    }
  };

  const handleRegister = async () => {
    const newErrors: { [key: string]: string } = {};

    if (!fullName.trim()) {
      newErrors.fullName = "Full name is required.";
    } else if (fullName.trim().length < 2) {
      newErrors.fullName = "Full name must be at least 2 characters.";
    }

    if (!email.trim()) {
      newErrors.email = "Email address is required.";
    } else if (!validateEmail(email)) {
      newErrors.email = "Please enter a valid email address (e.g., name@example.com).";
    }

    if (!password) {
      newErrors.password = "Password is required.";
    } else if (password.length < 6) {
      newErrors.password = "Password must be at least 6 characters long.";
    }

    if (!confirmPassword) {
      newErrors.confirmPassword = "Please confirm your password.";
    } else if (password !== confirmPassword) {
      newErrors.confirmPassword = "Passwords do not match.";
    }

    setErrors(newErrors);

    if (Object.keys(newErrors).length > 0) {
      return;
    }

    setLoading(true);
    try {
      const response = await api.post("/auth/register", {
        fullName: fullName.trim(),
        email: email.trim(),
        password: password.trim(),
      });

      const { token } = response.data;
      if (Platform.OS === "web") {
        localStorage.setItem("userToken", token);
      } else {
        await SecureStore.setItemAsync("userToken", token);
      }

      showAlert("Account Created", "Welcome! Your banking account has been created with a $1,000 welcome bonus.");
      navigation.replace("Dashboard");
    } catch (error: any) {
      const message = error.response?.data?.error || "An error occurred during registration.";
      showAlert("Registration Failed", message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.card}>
          <View style={styles.iconContainer}>
            <Text style={{ fontSize: 32 }}>🏦</Text>
          </View>

          <Text style={styles.title}>Create Account</Text>
          <Text style={styles.subtitle}>Open your high-yield banking account in seconds</Text>

          {/* Full Name */}
          <View style={styles.inputContainer}>
            <Text style={styles.label}>Full Legal Name</Text>
            <TextInput
              style={[styles.input, errors.fullName ? styles.inputError : null]}
              placeholder="e.g. John Doe"
              placeholderTextColor="#64748b"
              value={fullName}
              onChangeText={(text) => {
                setFullName(text);
                if (errors.fullName) setErrors((prev) => ({ ...prev, fullName: "" }));
              }}
              editable={!loading}
            />
            {errors.fullName ? <Text style={styles.errorText}>⚠️ {errors.fullName}</Text> : null}
          </View>

          {/* Email */}
          <View style={styles.inputContainer}>
            <Text style={styles.label}>Email Address</Text>
            <TextInput
              style={[styles.input, errors.email ? styles.inputError : null]}
              placeholder="name@example.com"
              placeholderTextColor="#64748b"
              value={email}
              onChangeText={(text) => {
                setEmail(text);
                if (errors.email) setErrors((prev) => ({ ...prev, email: "" }));
              }}
              keyboardType="email-address"
              autoCapitalize="none"
              editable={!loading}
            />
            {errors.email ? <Text style={styles.errorText}>⚠️ {errors.email}</Text> : null}
          </View>

          {/* Password */}
          <View style={styles.inputContainer}>
            <View style={styles.labelRow}>
              <Text style={styles.label}>Create Password</Text>
              <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                <Text style={styles.toggleText}>{showPassword ? "Hide" : "Show"}</Text>
              </TouchableOpacity>
            </View>
            <TextInput
              style={[styles.input, errors.password ? styles.inputError : null]}
              placeholder="At least 6 characters"
              placeholderTextColor="#64748b"
              value={password}
              onChangeText={(text) => {
                setPassword(text);
                if (errors.password) setErrors((prev) => ({ ...prev, password: "" }));
              }}
              secureTextEntry={!showPassword}
              editable={!loading}
            />
            {errors.password ? <Text style={styles.errorText}>⚠️ {errors.password}</Text> : null}
          </View>

          {/* Confirm Password */}
          <View style={styles.inputContainer}>
            <View style={styles.labelRow}>
              <Text style={styles.label}>Confirm Password</Text>
              <TouchableOpacity onPress={() => setShowConfirmPassword(!showConfirmPassword)}>
                <Text style={styles.toggleText}>{showConfirmPassword ? "Hide" : "Show"}</Text>
              </TouchableOpacity>
            </View>
            <TextInput
              style={[styles.input, errors.confirmPassword ? styles.inputError : null]}
              placeholder="Repeat your password"
              placeholderTextColor="#64748b"
              value={confirmPassword}
              onChangeText={(text) => {
                setConfirmPassword(text);
                if (errors.confirmPassword) setErrors((prev) => ({ ...prev, confirmPassword: "" }));
              }}
              secureTextEntry={!showConfirmPassword}
              editable={!loading}
            />
            {errors.confirmPassword ? (
              <Text style={styles.errorText}>⚠️ {errors.confirmPassword}</Text>
            ) : null}
          </View>

          <TouchableOpacity
            style={[styles.registerButton, loading && styles.disabledButton]}
            onPress={handleRegister}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={styles.registerButtonText}>Open Account & Get $1,000 Bonus →</Text>
            )}
          </TouchableOpacity>

          <View style={styles.loginContainer}>
            <Text style={styles.loginText}>Already have an account? </Text>
            <TouchableOpacity onPress={() => navigation.navigate("Login")} disabled={loading}>
              <Text style={styles.loginLink}>Log In</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#080c15",
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  card: {
    backgroundColor: "rgba(15, 23, 42, 0.88)",
    borderRadius: 24,
    padding: 28,
    width: "100%",
    maxWidth: 460,
    borderWidth: 1,
    borderColor: "rgba(56, 189, 248, 0.25)",
    shadowColor: "#0284c7",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.25,
    shadowRadius: 30,
    elevation: 10,
  },
  iconContainer: {
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: "rgba(56, 189, 248, 0.12)",
    justifyContent: "center",
    alignItems: "center",
    alignSelf: "center",
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "rgba(56, 189, 248, 0.3)",
  },
  title: {
    fontSize: 26,
    fontWeight: "800",
    color: "#f8fafc",
    marginBottom: 6,
    textAlign: "center",
  },
  subtitle: {
    fontSize: 13,
    color: "#94a3b8",
    marginBottom: 24,
    textAlign: "center",
    lineHeight: 18,
  },
  inputContainer: {
    marginBottom: 16,
  },
  labelRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  label: {
    fontSize: 13,
    fontWeight: "600",
    color: "#cbd5e1",
    marginBottom: 6,
  },
  toggleText: {
    fontSize: 12,
    color: "#38bdf8",
    fontWeight: "600",
  },
  input: {
    backgroundColor: "rgba(30, 41, 59, 0.7)",
    borderWidth: 1,
    borderColor: "rgba(148, 163, 184, 0.25)",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: "#f8fafc",
  },
  inputError: {
    borderColor: "#fb7185",
    backgroundColor: "rgba(244, 63, 94, 0.1)",
  },
  errorText: {
    color: "#fb7185",
    fontSize: 12,
    marginTop: 4,
    fontWeight: "500",
  },
  registerButton: {
    backgroundColor: "#0284c7",
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
    marginTop: 10,
    borderWidth: 1,
    borderColor: "rgba(56, 189, 248, 0.4)",
    shadowColor: "#38bdf8",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 6,
  },
  registerButtonText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "700",
  },
  disabledButton: {
    opacity: 0.6,
  },
  loginContainer: {
    flexDirection: "row",
    justifyContent: "center",
    marginTop: 20,
  },
  loginText: {
    color: "#94a3b8",
    fontSize: 13,
  },
  loginLink: {
    color: "#38bdf8",
    fontSize: 13,
    fontWeight: "700",
  },
});
