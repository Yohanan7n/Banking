import React, { useState, useEffect } from "react";
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator,
  ScrollView,
} from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import * as SecureStore from "expo-secure-store";
import { api } from "../api";
import type { RootStackParamList } from "../navigation/types";

type Props = NativeStackScreenProps<RootStackParamList, "Login">;

export default function LoginScreen({ navigation }: Props) {
  const [portal, setPortal] = useState<"CUSTOMER" | "ADMIN">("CUSTOMER");

  // Customer Credentials
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  // Admin Credentials
  const [adminEmail, setAdminEmail] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [adminPin, setAdminPin] = useState("");
  const [showAdminPassword, setShowAdminPassword] = useState(false);

  // Validation Errors
  const [errors, setErrors] = useState<{ [key: string]: string }>({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const checkToken = async () => {
      let token;
      if (Platform.OS === "web") {
        token = localStorage.getItem("userToken");
      } else {
        token = await SecureStore.getItemAsync("userToken");
      }
      if (token) {
        try {
          const res = await api.get("/user/dashboard");
          if (res.data?.role === "ADMIN") {
            navigation.replace("Admin");
          } else {
            navigation.replace("Dashboard");
          }
        } catch {
          // Token expired or invalid, stay on login
        }
      }
    };
    checkToken();
  }, []);

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

  // 1. Handle Customer Login
  const handleCustomerLogin = async () => {
    const newErrors: { [key: string]: string } = {};

    if (!email.trim()) {
      newErrors.email = "Email address is required.";
    } else if (!validateEmail(email)) {
      newErrors.email = "Please enter a valid email address (e.g., name@example.com).";
    }

    if (!password) {
      newErrors.password = "Password is required.";
    } else if (password.length < 6) {
      newErrors.password = "Password must be at least 6 characters.";
    }

    setErrors(newErrors);

    if (Object.keys(newErrors).length > 0) {
      return;
    }

    setLoading(true);
    try {
      const response = await api.post("/auth/login", {
        email: email.trim(),
        password: password.trim(),
      });
      const { token } = response.data;

      if (Platform.OS === "web") {
        localStorage.setItem("userToken", token);
      } else {
        await SecureStore.setItemAsync("userToken", token);
      }

      navigation.replace("Dashboard");
    } catch (error: any) {
      let message = "Invalid email or password.";
      if (!error.response) {
        message = "Cannot connect to server. Please ensure the backend is running on port 3000.";
      } else if (error.response?.data?.error) {
        message = error.response.data.error;
      }
      showAlert("Customer Login Failed", message);
    } finally {
      setLoading(false);
    }
  };

  // 2. Handle Admin Portal Login
  const handleAdminLogin = async () => {
    const newErrors: { [key: string]: string } = {};

    if (!adminEmail.trim()) {
      newErrors.adminEmail = "Admin username or email is required.";
    }

    if (!adminPassword) {
      newErrors.adminPassword = "Admin master password is required.";
    } else if (adminPassword.length < 6) {
      newErrors.adminPassword = "Password must be at least 6 characters.";
    }

    if (!adminPin.trim()) {
      newErrors.adminPin = "Master Security PIN is required.";
    } else if (!/^\d{6}$/.test(adminPin.trim())) {
      newErrors.adminPin = "Master PIN must be exactly 6 digits.";
    }

    setErrors(newErrors);

    if (Object.keys(newErrors).length > 0) {
      return;
    }

    setLoading(true);
    try {
      const response = await api.post("/admin/verify-pin", {
        email: adminEmail.trim(),
        password: adminPassword.trim(),
        pin: adminPin.trim(),
      });

      const { token } = response.data;
      if (token) {
        if (Platform.OS === "web") {
          localStorage.setItem("userToken", token);
        } else {
          await SecureStore.setItemAsync("userToken", token);
        }
      }

      navigation.replace("Admin");
    } catch (error: any) {
      let message = "Invalid administrator credentials or master PIN.";
      if (!error.response) {
        message = "Cannot connect to server. Please ensure the backend is running on port 3000.";
      } else if (error.response?.data?.error) {
        message = error.response.data.error;
      }
      showAlert("Admin Access Denied", message);
    } finally {
      setLoading(false);
    }
  };

  const isAdmin = portal === "ADMIN";

  return (
    <KeyboardAvoidingView
      style={[styles.container, isAdmin ? styles.adminBg : styles.customerBg]}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.cardContainer}>
          {/* Top Portal Switcher Tabs */}
          <View style={styles.tabSelector}>
            <TouchableOpacity
              style={[styles.tabButton, !isAdmin && styles.activeCustomerTab]}
              onPress={() => {
                setPortal("CUSTOMER");
                setErrors({});
              }}
              disabled={loading}
            >
              <Text style={[styles.tabButtonText, !isAdmin && styles.activeCustomerTabText]}>
                👤 Customer Site
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.tabButton, isAdmin && styles.activeAdminTab]}
              onPress={() => {
                setPortal("ADMIN");
                setErrors({});
              }}
              disabled={loading}
            >
              <Text style={[styles.tabButtonText, isAdmin && styles.activeAdminTabText]}>
                🛡️ Admin Site
              </Text>
            </TouchableOpacity>
          </View>

          {/* Portal Card */}
          <View style={[styles.card, isAdmin ? styles.adminCard : styles.customerCard]}>
            {/* Header Section */}
            <View style={styles.header}>
              <View style={[styles.portalIconContainer, isAdmin ? styles.adminIconBg : styles.customerIconBg]}>
                <Text style={{ fontSize: 32 }}>{isAdmin ? "👑" : "🏦"}</Text>
              </View>

              <Text style={[styles.title, isAdmin && styles.adminTitle]}>
                {isAdmin ? "Administrator Portal" : "Customer Banking"}
              </Text>
              <Text style={styles.subtitle}>
                {isAdmin
                  ? "High-security terminal for bank management & vault control"
                  : "Sign in to manage your deposits, transfers, and balances"}
              </Text>

              {isAdmin && (
                <View style={styles.securityBadge}>
                  <Text style={styles.securityBadgeText}>🔒 256-Bit Encrypted Admin Access</Text>
                </View>
              )}
            </View>

            {/* Form Section */}
            {!isAdmin ? (
              /* CUSTOMER SITE FORM */
              <View style={styles.form}>
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

                <View style={styles.inputContainer}>
                  <View style={styles.labelRow}>
                    <Text style={styles.label}>Account Password</Text>
                    <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                      <Text style={styles.toggleShowText}>{showPassword ? "Hide" : "Show"}</Text>
                    </TouchableOpacity>
                  </View>
                  <TextInput
                    style={[styles.input, errors.password ? styles.inputError : null]}
                    placeholder="Enter password"
                    placeholderTextColor={isAdmin ? "#64748b" : "#94a3b8"}
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

                <TouchableOpacity
                  style={[styles.loginButton, styles.customerButton, loading && styles.disabledButton]}
                  onPress={handleCustomerLogin}
                  disabled={loading}
                >
                  {loading ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <Text style={styles.loginButtonText}>Sign In to Account →</Text>
                  )}
                </TouchableOpacity>

                <View style={styles.registerContainer}>
                  <Text style={styles.registerText}>Don't have an account? </Text>
                  <TouchableOpacity onPress={() => navigation.navigate("Register")} disabled={loading}>
                    <Text style={styles.registerLink}>Open an Account</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              /* ADMIN SITE FORM */
              <View style={styles.form}>
                <View style={styles.inputContainer}>
                  <Text style={[styles.label, styles.adminLabel]}>Admin Username / Email</Text>
                  <TextInput
                    style={[styles.input, styles.adminInput, errors.adminEmail ? styles.inputError : null]}
                    placeholder="Enter admin ID or email"
                    placeholderTextColor="#64748b"
                    value={adminEmail}
                    onChangeText={(text) => {
                      setAdminEmail(text);
                      if (errors.adminEmail) setErrors((prev) => ({ ...prev, adminEmail: "" }));
                    }}
                    autoCapitalize="none"
                    keyboardType="email-address"
                    editable={!loading}
                  />
                  {errors.adminEmail ? <Text style={styles.errorText}>⚠️ {errors.adminEmail}</Text> : null}
                </View>

                <View style={styles.inputContainer}>
                  <View style={styles.labelRow}>
                    <Text style={[styles.label, styles.adminLabel]}>Admin Master Password</Text>
                    <TouchableOpacity onPress={() => setShowAdminPassword(!showAdminPassword)}>
                      <Text style={styles.toggleAdminShowText}>{showAdminPassword ? "Hide" : "Show"}</Text>
                    </TouchableOpacity>
                  </View>
                  <TextInput
                    style={[styles.input, styles.adminInput, errors.adminPassword ? styles.inputError : null]}
                    placeholder="Enter master password"
                    placeholderTextColor="#64748b"
                    value={adminPassword}
                    onChangeText={(text) => {
                      setAdminPassword(text);
                      if (errors.adminPassword) setErrors((prev) => ({ ...prev, adminPassword: "" }));
                    }}
                    secureTextEntry={!showAdminPassword}
                    editable={!loading}
                  />
                  {errors.adminPassword ? <Text style={styles.errorText}>⚠️ {errors.adminPassword}</Text> : null}
                </View>

                <View style={styles.inputContainer}>
                  <Text style={[styles.label, styles.adminLabel]}>6-Digit Master Security PIN</Text>
                  <TextInput
                    style={[
                      styles.input,
                      styles.adminInput,
                      adminPin ? styles.pinInputActive : null,
                      errors.adminPin ? styles.inputError : null,
                    ]}
                    placeholder="Enter security PIN"
                    placeholderTextColor="#64748b"
                    value={adminPin}
                    onChangeText={(text) => {
                      setAdminPin(text);
                      if (errors.adminPin) setErrors((prev) => ({ ...prev, adminPin: "" }));
                    }}
                    keyboardType="numeric"
                    maxLength={6}
                    secureTextEntry
                    editable={!loading}
                  />
                  {errors.adminPin ? <Text style={styles.errorText}>⚠️ {errors.adminPin}</Text> : null}
                </View>

                <TouchableOpacity
                  style={[styles.loginButton, styles.adminButton, loading && styles.disabledButton]}
                  onPress={handleAdminLogin}
                  disabled={loading}
                >
                  {loading ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <Text style={styles.loginButtonText}>Authorize & Enter Console 🛡️</Text>
                  )}
                </TouchableOpacity>

                <View style={styles.adminWarningBox}>
                  <Text style={styles.adminWarningText}>
                    ⚠️ Restricted Area: All login attempts and IP addresses are audited for security compliance.
                  </Text>
                </View>
              </View>
            )}
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  customerBg: {
    backgroundColor: "#080c15",
  },
  adminBg: {
    backgroundColor: "#080c15",
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  cardContainer: {
    width: "100%",
    maxWidth: 440,
  },
  tabSelector: {
    flexDirection: "row",
    backgroundColor: "rgba(15, 23, 42, 0.9)",
    borderRadius: 14,
    padding: 5,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "rgba(148, 163, 184, 0.15)",
  },
  tabButton: {
    flex: 1,
    paddingVertical: 12,
    alignItems: "center",
    borderRadius: 10,
  },
  tabButtonText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#64748b",
  },
  activeCustomerTab: {
    backgroundColor: "#0284c7",
    shadowColor: "#0284c7",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 4,
  },
  activeCustomerTabText: {
    color: "#ffffff",
    fontWeight: "800",
  },
  activeAdminTab: {
    backgroundColor: "#7e22ce",
    shadowColor: "#a855f7",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 4,
  },
  activeAdminTabText: {
    color: "#ffffff",
    fontWeight: "800",
  },
  card: {
    borderRadius: 24,
    padding: 28,
    elevation: 8,
  },
  customerCard: {
    backgroundColor: "rgba(15, 23, 42, 0.9)",
    borderWidth: 1,
    borderColor: "rgba(56, 189, 248, 0.35)",
    shadowColor: "#0284c7",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.35,
    shadowRadius: 24,
  },
  adminCard: {
    backgroundColor: "rgba(15, 23, 42, 0.9)",
    borderWidth: 1,
    borderColor: "rgba(168, 85, 247, 0.35)",
    shadowColor: "#a855f7",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.35,
    shadowRadius: 24,
  },
  header: {
    alignItems: "center",
    marginBottom: 24,
  },
  portalIconContainer: {
    width: 68,
    height: 68,
    borderRadius: 22,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 14,
  },
  customerIconBg: {
    backgroundColor: "rgba(14, 165, 233, 0.18)",
    borderWidth: 1,
    borderColor: "rgba(56, 189, 248, 0.4)",
  },
  adminIconBg: {
    backgroundColor: "rgba(147, 51, 234, 0.18)",
    borderWidth: 1,
    borderColor: "rgba(168, 85, 247, 0.4)",
  },
  title: {
    fontSize: 24,
    fontWeight: "800",
    color: "#f8fafc",
    marginBottom: 6,
    textAlign: "center",
  },
  adminTitle: {
    color: "#f8fafc",
  },
  subtitle: {
    fontSize: 13,
    color: "#94a3b8",
    textAlign: "center",
    lineHeight: 18,
    paddingHorizontal: 8,
  },
  securityBadge: {
    backgroundColor: "#3b0764",
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
    marginTop: 10,
    borderWidth: 1,
    borderColor: "#9333ea",
  },
  securityBadgeText: {
    color: "#e9d5ff",
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  form: {
    width: "100%",
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
  },
  adminLabel: {
    color: "#cbd5e1",
  },
  toggleShowText: {
    fontSize: 12,
    color: "#38bdf8",
    fontWeight: "700",
  },
  toggleAdminShowText: {
    fontSize: 12,
    color: "#c084fc",
    fontWeight: "700",
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
  adminInput: {
    backgroundColor: "rgba(30, 41, 59, 0.7)",
    borderColor: "rgba(148, 163, 184, 0.25)",
    color: "#f8fafc",
  },
  inputError: {
    borderColor: "#ef4444",
    backgroundColor: "rgba(239, 68, 68, 0.15)",
  },
  errorText: {
    color: "#f87171",
    fontSize: 12,
    marginTop: 4,
    fontWeight: "600",
  },
  pinInput: {
    textAlign: "center",
    letterSpacing: 6,
    fontSize: 18,
    fontWeight: "700",
  },
  pinInputActive: {
    letterSpacing: 6,
    fontWeight: "700",
  },
  loginButton: {
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
    marginTop: 8,
    elevation: 5,
  },
  customerButton: {
    backgroundColor: "#0284c7",
    shadowColor: "#0284c7",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(56, 189, 248, 0.4)",
  },
  adminButton: {
    backgroundColor: "#7e22ce",
    shadowColor: "#a855f7",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(192, 132, 252, 0.4)",
  },
  loginButtonText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "800",
  },
  disabledButton: {
    opacity: 0.6,
  },
  registerContainer: {
    flexDirection: "row",
    justifyContent: "center",
    marginTop: 20,
  },
  registerText: {
    color: "#94a3b8",
    fontSize: 13,
  },
  registerLink: {
    color: "#38bdf8",
    fontSize: 13,
    fontWeight: "700",
  },
  adminWarningBox: {
    marginTop: 18,
    padding: 12,
    backgroundColor: "rgba(30, 41, 59, 0.5)",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(168, 85, 247, 0.25)",
  },
  adminWarningText: {
    color: "#94a3b8",
    fontSize: 11,
    textAlign: "center",
    lineHeight: 15,
  },
});
