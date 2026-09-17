import React, { useEffect, useState, useCallback } from "react";
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Platform,
  RefreshControl,
  Modal,
  TextInput,
  Alert,
} from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import * as SecureStore from "expo-secure-store";
import { useFocusEffect } from "@react-navigation/native";
import { api } from "../api";
import type { RootStackParamList } from "../navigation/types";

type Props = NativeStackScreenProps<RootStackParamList, "Dashboard">;

interface Transaction {
  id: number;
  title: string;
  amount: number;
  type: "DEPOSIT" | "WITHDRAWAL";
  date: string;
}

interface DashboardData {
  fullName: string;
  email?: string;
  balance: number;
  role?: string;
  transactions: Transaction[];
}

export default function DashboardScreen({ navigation }: Props) {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Deposit Modal State
  const [depositModalVisible, setDepositModalVisible] = useState(false);
  const [depositAmount, setDepositAmount] = useState("");
  const [depositing, setDepositing] = useState(false);

  // Change Password Modal State
  const [changePassModalVisible, setChangePassModalVisible] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPasswords, setShowPasswords] = useState(false);
  const [passError, setPassError] = useState("");
  const [changingPass, setChangingPass] = useState(false);

  const fetchDashboard = async (isRefreshing = false) => {
    if (!isRefreshing && !data) setLoading(true);
    try {
      const response = await api.get("/user/dashboard");
      setData(response.data);
    } catch (error) {
      console.error(error);
      if (Platform.OS === "web") {
        localStorage.removeItem("userToken");
      } else {
        await SecureStore.deleteItemAsync("userToken");
      }
      navigation.replace("Login");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchDashboard();
    }, [])
  );

  const onRefresh = () => {
    setRefreshing(true);
    fetchDashboard(true);
  };

  const handleLogout = async () => {
    if (Platform.OS === "web") {
      localStorage.removeItem("userToken");
    } else {
      await SecureStore.deleteItemAsync("userToken");
    }
    navigation.replace("Login");
  };

  const handleDeposit = async () => {
    const numAmount = parseFloat(depositAmount);
    if (isNaN(numAmount) || numAmount <= 0) {
      if (Platform.OS === "web") {
        alert("Please enter a valid deposit amount.");
      } else {
        Alert.alert("Invalid Amount", "Please enter a valid deposit amount.");
      }
      return;
    }

    setDepositing(true);
    try {
      const res = await api.post("/user/deposit", { amount: numAmount });
      setDepositModalVisible(false);
      setDepositAmount("");
      if (Platform.OS === "web") {
        alert(`Successfully deposited $${numAmount.toFixed(2)}!`);
      } else {
        Alert.alert("Success", `Successfully deposited $${numAmount.toFixed(2)}!`);
      }
      fetchDashboard(true);
    } catch (error: any) {
      const msg = error.response?.data?.error || "Deposit failed.";
      if (Platform.OS === "web") {
        alert(msg);
      } else {
        Alert.alert("Deposit Failed", msg);
      }
    } finally {
      setDepositing(false);
    }
  };

  const handleOpenChangePassModal = () => {
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setPassError("");
    setShowPasswords(false);
    setChangePassModalVisible(true);
  };

  const handleChangePassword = async () => {
    setPassError("");
    if (!currentPassword.trim()) {
      setPassError("Please enter your current or admin-issued password.");
      return;
    }
    if (!newPassword.trim() || newPassword.trim().length < 6) {
      setPassError("New personal password must be at least 6 characters.");
      return;
    }
    if (newPassword.trim() !== confirmPassword.trim()) {
      setPassError("New password and confirmation do not match.");
      return;
    }
    if (currentPassword.trim() === newPassword.trim()) {
      setPassError("New password must be different from your current password.");
      return;
    }

    setChangingPass(true);
    try {
      await api.post("/user/change-password", {
        currentPassword: currentPassword.trim(),
        newPassword: newPassword.trim(),
      });

      setChangePassModalVisible(false);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");

      if (Platform.OS === "web") {
        alert("✅ Password Updated Successfully!\n\nYour personal password is now active. Please use it for all future logins.");
      } else {
        Alert.alert(
          "Password Updated",
          "Your personal password is now active. Please use it for all future logins."
        );
      }
    } catch (error: any) {
      const msg = error.response?.data?.error || "Failed to update password. Please check your current password.";
      setPassError(msg);
    } finally {
      setChangingPass(false);
    }
  };

  if (loading && !data) {
    return (
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator size="large" color="#0052cc" />
      </View>
    );
  }

  const fullName = data?.fullName || "User";
  const balance = data?.balance || 0;
  const transactions = data?.transactions || [];

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>Welcome back,</Text>
          <Text style={styles.userName}>{fullName}</Text>
        </View>
        <View style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>
          {data?.role === "ADMIN" && (
            <TouchableOpacity
              style={styles.adminHeaderButton}
              onPress={() => navigation.navigate("Admin")}
            >
              <Text style={styles.adminHeaderButtonText}>👑 Admin Console</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={styles.passwordHeaderButton}
            onPress={handleOpenChangePassModal}
          >
            <Text style={styles.passwordHeaderButtonText}>🔑 Change Password</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
            <Text style={styles.logoutText}>Log out</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* Balance Card */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Total Balance</Text>
          <Text style={styles.balance}>${balance.toFixed(2)}</Text>
          <View style={styles.actionButtons}>
            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => navigation.navigate("Transfer")}
            >
              <Text style={styles.actionButtonText}>↑ Send Money</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionButton, styles.receiveButton]}
              onPress={() => setDepositModalVisible(true)}
            >
              <Text style={[styles.actionButtonText, styles.receiveButtonText]}>
                ↓ Deposit Funds
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Quick Actions Grid */}
        <View style={styles.quickNav}>
          <TouchableOpacity
            style={styles.quickNavCard}
            onPress={() => navigation.navigate("Transfer")}
          >
            <View style={[styles.quickNavIcon, { backgroundColor: "rgba(56, 189, 248, 0.15)", borderWidth: 1, borderColor: "rgba(56, 189, 248, 0.3)" }]}>
              <Text style={{ fontSize: 20 }}>💸</Text>
            </View>
            <Text style={styles.quickNavTitle}>Transfer</Text>
            <Text style={styles.quickNavSubtitle}>Send money</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.quickNavCard}
            onPress={() => setDepositModalVisible(true)}
          >
            <View style={[styles.quickNavIcon, { backgroundColor: "rgba(52, 211, 153, 0.15)", borderWidth: 1, borderColor: "rgba(52, 211, 153, 0.3)" }]}>
              <Text style={{ fontSize: 20 }}>💳</Text>
            </View>
            <Text style={styles.quickNavTitle}>Deposit</Text>
            <Text style={styles.quickNavSubtitle}>Add funds</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.quickNavCard}
            onPress={() => navigation.navigate("Transactions")}
          >
            <View style={[styles.quickNavIcon, { backgroundColor: "rgba(251, 191, 36, 0.15)", borderWidth: 1, borderColor: "rgba(251, 191, 36, 0.3)" }]}>
              <Text style={{ fontSize: 20 }}>📜</Text>
            </View>
            <Text style={styles.quickNavTitle}>History</Text>
            <Text style={styles.quickNavSubtitle}>All activity</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.quickNavCard}
            onPress={handleOpenChangePassModal}
          >
            <View style={[styles.quickNavIcon, { backgroundColor: "rgba(168, 85, 247, 0.15)", borderWidth: 1, borderColor: "rgba(168, 85, 247, 0.3)" }]}>
              <Text style={{ fontSize: 20 }}>🔐</Text>
            </View>
            <Text style={styles.quickNavTitle}>Security</Text>
            <Text style={styles.quickNavSubtitle}>Change Pass</Text>
          </TouchableOpacity>

          {data?.role === "ADMIN" && (
            <TouchableOpacity
              style={styles.quickNavCard}
              onPress={() => navigation.navigate("Admin")}
            >
              <View style={[styles.quickNavIcon, { backgroundColor: "rgba(236, 72, 153, 0.15)", borderWidth: 1, borderColor: "rgba(236, 72, 153, 0.3)" }]}>
                <Text style={{ fontSize: 20 }}>👑</Text>
              </View>
              <Text style={styles.quickNavTitle}>Admin</Text>
              <Text style={styles.quickNavSubtitle}>Console</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Recent Transactions Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Recent Transactions</Text>
            <TouchableOpacity onPress={() => navigation.navigate("Transactions")}>
              <Text style={styles.seeAll}>See All →</Text>
            </TouchableOpacity>
          </View>

          {transactions.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyStateText}>No transactions yet.</Text>
              <Text style={styles.emptyStateSubtext}>
                Deposit or send money to get started!
              </Text>
            </View>
          ) : (
            transactions.map((t) => {
              const isPositive = t.type === "DEPOSIT";
              const amountPrefix = isPositive ? "+" : "-";
              const dateStr = new Date(t.date).toLocaleDateString(undefined, {
                month: "short",
                day: "numeric",
              });

              return (
                <View key={t.id} style={styles.transactionItem}>
                  <View style={styles.transactionInfo}>
                    <View
                      style={[
                        styles.transactionIcon,
                        isPositive
                          ? styles.depositIconBg
                          : styles.withdrawalIconBg,
                      ]}
                    >
                      <Text
                        style={[
                          styles.transactionIconText,
                          isPositive
                            ? styles.depositIconText
                            : styles.withdrawalIconText,
                        ]}
                      >
                        {isPositive ? "↓" : "↑"}
                      </Text>
                    </View>
                    <View>
                      <Text style={styles.transactionTitle}>{t.title}</Text>
                      <Text style={styles.transactionDate}>{dateStr}</Text>
                    </View>
                  </View>
                  <Text
                    style={[
                      styles.transactionAmount,
                      isPositive && styles.positiveAmount,
                    ]}
                  >
                    {amountPrefix}${t.amount.toFixed(2)}
                  </Text>
                </View>
              );
            })
          )}
        </View>
      </ScrollView>

      {/* Deposit / Add Money Modal */}
      <Modal
        visible={depositModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setDepositModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Deposit Funds</Text>
            <Text style={styles.modalSubtitle}>
              Add money directly to your account balance
            </Text>

            <TextInput
              style={styles.modalInput}
              placeholder="$0.00"
              placeholderTextColor="#64748b"
              keyboardType="decimal-pad"
              value={depositAmount}
              onChangeText={setDepositAmount}
              editable={!depositing}
            />

            {/* Quick deposit chips */}
            <View style={styles.modalChips}>
              {[20, 50, 100, 500].map((v) => (
                <TouchableOpacity
                  key={v}
                  style={styles.modalChip}
                  onPress={() => setDepositAmount(v.toString())}
                >
                  <Text style={styles.modalChipText}>+${v}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.modalCancelButton}
                onPress={() => setDepositModalVisible(false)}
                disabled={depositing}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalConfirmButton, depositing && { opacity: 0.6 }]}
                onPress={handleDeposit}
                disabled={depositing}
              >
                {depositing ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.modalConfirmText}>Confirm Deposit</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* CHANGE PASSWORD MODAL */}
      <Modal
        visible={changePassModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setChangePassModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { maxWidth: 440 }]}>
            <View style={styles.changePassIconContainer}>
              <Text style={{ fontSize: 30 }}>🔐</Text>
            </View>
            <Text style={styles.modalTitle}>Set Personal Password</Text>
            <Text style={styles.modalSubtitle}>
              Replace your temporary or admin-issued password with your own secure personal password.
            </Text>

            {passError ? (
              <View style={styles.errorBanner}>
                <Text style={styles.errorBannerText}>⚠️ {passError}</Text>
              </View>
            ) : null}

            {/* Current Password Input */}
            <View style={styles.passInputGroup}>
              <Text style={styles.inputLabelSmall}>Current / General Password</Text>
              <TextInput
                style={styles.modalPassInputField}
                placeholder="Enter current or admin-issued password..."
                placeholderTextColor="#94a3b8"
                value={currentPassword}
                onChangeText={setCurrentPassword}
                secureTextEntry={!showPasswords}
                editable={!changingPass}
              />
            </View>

            {/* New Password Input */}
            <View style={styles.passInputGroup}>
              <Text style={styles.inputLabelSmall}>New Personal Password</Text>
              <TextInput
                style={styles.modalPassInputField}
                placeholder="At least 6 characters..."
                placeholderTextColor="#94a3b8"
                value={newPassword}
                onChangeText={setNewPassword}
                secureTextEntry={!showPasswords}
                editable={!changingPass}
              />
            </View>

            {/* Confirm New Password Input */}
            <View style={styles.passInputGroup}>
              <Text style={styles.inputLabelSmall}>Confirm New Password</Text>
              <TextInput
                style={styles.modalPassInputField}
                placeholder="Re-enter new password..."
                placeholderTextColor="#94a3b8"
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry={!showPasswords}
                editable={!changingPass}
              />
            </View>

            {/* Toggle Show/Hide Passwords */}
            <TouchableOpacity
              style={styles.showPassToggle}
              onPress={() => setShowPasswords(!showPasswords)}
            >
              <Text style={styles.showPassToggleText}>
                {showPasswords ? "🙈 Hide Passwords" : "👁️ Show Passwords"}
              </Text>
            </TouchableOpacity>

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.modalCancelButton}
                onPress={() => setChangePassModalVisible(false)}
                disabled={changingPass}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalConfirmButton, { backgroundColor: "#0284c7" }, changingPass && { opacity: 0.6 }]}
                onPress={handleChangePassword}
                disabled={changingPass}
              >
                {changingPass ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.modalConfirmText}>Save My Password 🔒</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#080c15",
  },
  center: {
    justifyContent: "center",
    alignItems: "center",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 24,
    paddingTop: 55,
    paddingBottom: 16,
    backgroundColor: "rgba(15, 23, 42, 0.95)",
    borderBottomWidth: 1,
    borderBottomColor: "rgba(148, 163, 184, 0.12)",
  },
  greeting: {
    fontSize: 13,
    color: "#94a3b8",
  },
  userName: {
    fontSize: 20,
    fontWeight: "800",
    color: "#f8fafc",
  },
  adminHeaderButton: {
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: "rgba(168, 85, 247, 0.15)",
    borderWidth: 1,
    borderColor: "rgba(168, 85, 247, 0.4)",
  },
  adminHeaderButtonText: {
    color: "#c084fc",
    fontWeight: "700",
    fontSize: 12,
  },
  logoutButton: {
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: "rgba(244, 63, 94, 0.15)",
    borderWidth: 1,
    borderColor: "rgba(244, 63, 94, 0.3)",
  },
  logoutText: {
    color: "#fb7185",
    fontWeight: "600",
    fontSize: 13,
  },
  scrollContent: {
    padding: 20,
  },
  card: {
    backgroundColor: "rgba(12, 34, 64, 0.85)",
    borderRadius: 20,
    padding: 24,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "rgba(56, 189, 248, 0.35)",
    shadowColor: "#0284c7",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 8,
  },
  cardTitle: {
    color: "rgba(224, 242, 254, 0.8)",
    fontSize: 13,
    fontWeight: "600",
    marginBottom: 6,
    letterSpacing: 0.5,
  },
  balance: {
    color: "#f8fafc",
    fontSize: 38,
    fontWeight: "900",
    marginBottom: 20,
    letterSpacing: -0.5,
  },
  actionButtons: {
    flexDirection: "row",
    gap: 12,
  },
  actionButton: {
    flex: 1,
    backgroundColor: "rgba(56, 189, 248, 0.15)",
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(56, 189, 248, 0.35)",
  },
  receiveButton: {
    backgroundColor: "#0284c7",
    borderColor: "rgba(56, 189, 248, 0.5)",
  },
  actionButtonText: {
    color: "#38bdf8",
    fontWeight: "700",
    fontSize: 14,
  },
  receiveButtonText: {
    color: "#ffffff",
  },
  quickNav: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 20,
  },
  quickNavCard: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.85)",
    padding: 14,
    borderRadius: 14,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(148, 163, 184, 0.15)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 3,
  },
  quickNavIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 8,
  },
  quickNavTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#f8fafc",
  },
  quickNavSubtitle: {
    fontSize: 11,
    color: "#94a3b8",
    marginTop: 2,
  },
  section: {
    backgroundColor: "rgba(15, 23, 42, 0.85)",
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: "rgba(148, 163, 184, 0.15)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 4,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#f8fafc",
  },
  seeAll: {
    color: "#38bdf8",
    fontWeight: "700",
    fontSize: 13,
  },
  emptyState: {
    paddingVertical: 24,
    alignItems: "center",
  },
  emptyStateText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#94a3b8",
  },
  emptyStateSubtext: {
    fontSize: 13,
    color: "#64748b",
    marginTop: 4,
  },
  transactionItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(148, 163, 184, 0.1)",
  },
  transactionInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  transactionIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
  },
  depositIconBg: {
    backgroundColor: "rgba(52, 211, 153, 0.15)",
    borderColor: "rgba(52, 211, 153, 0.3)",
  },
  withdrawalIconBg: {
    backgroundColor: "rgba(244, 63, 94, 0.15)",
    borderColor: "rgba(244, 63, 94, 0.3)",
  },
  transactionIconText: {
    fontSize: 18,
    fontWeight: "700",
  },
  depositIconText: {
    color: "#34d399",
  },
  withdrawalIconText: {
    color: "#fb7185",
  },
  transactionTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#f1f5f9",
    marginBottom: 2,
  },
  transactionDate: {
    fontSize: 12,
    color: "#64748b",
  },
  transactionAmount: {
    fontSize: 15,
    fontWeight: "700",
    color: "#fb7185",
  },
  positiveAmount: {
    color: "#34d399",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(3, 7, 18, 0.75)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  modalContent: {
    backgroundColor: "#0f172a",
    borderRadius: 20,
    padding: 24,
    width: "100%",
    maxWidth: 400,
    borderWidth: 1,
    borderColor: "rgba(56, 189, 248, 0.3)",
    shadowColor: "#0284c7",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.35,
    shadowRadius: 24,
    elevation: 10,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: "#f8fafc",
    marginBottom: 4,
  },
  modalSubtitle: {
    fontSize: 13,
    color: "#94a3b8",
    marginBottom: 16,
  },
  modalInput: {
    backgroundColor: "rgba(30, 41, 59, 0.7)",
    borderWidth: 1,
    borderColor: "rgba(56, 189, 248, 0.35)",
    borderRadius: 12,
    padding: 14,
    fontSize: 24,
    fontWeight: "700",
    color: "#38bdf8",
    textAlign: "center",
    marginBottom: 14,
  },
  modalChips: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 20,
  },
  modalChip: {
    backgroundColor: "rgba(30, 41, 59, 0.8)",
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(56, 189, 248, 0.2)",
  },
  modalChipText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#38bdf8",
  },
  modalButtons: {
    flexDirection: "row",
    gap: 10,
  },
  modalCancelButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: "rgba(30, 41, 59, 0.7)",
    borderWidth: 1,
    borderColor: "rgba(148, 163, 184, 0.2)",
    alignItems: "center",
  },
  modalCancelText: {
    color: "#cbd5e1",
    fontWeight: "600",
  },
  modalConfirmButton: {
    flex: 2,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: "#0284c7",
    borderWidth: 1,
    borderColor: "rgba(56, 189, 248, 0.4)",
    alignItems: "center",
    shadowColor: "#38bdf8",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
  },
  modalConfirmText: {
    color: "#fff",
    fontWeight: "700",
  },
  passwordHeaderButton: {
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: "rgba(56, 189, 248, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(56, 189, 248, 0.35)",
  },
  passwordHeaderButtonText: {
    color: "#38bdf8",
    fontWeight: "700",
    fontSize: 12,
  },
  changePassIconContainer: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "rgba(56, 189, 248, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(56, 189, 248, 0.3)",
    justifyContent: "center",
    alignItems: "center",
    alignSelf: "center",
    marginBottom: 12,
  },
  errorBanner: {
    backgroundColor: "rgba(244, 63, 94, 0.12)",
    padding: 10,
    borderRadius: 10,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: "rgba(244, 63, 94, 0.35)",
  },
  errorBannerText: {
    color: "#fb7185",
    fontSize: 12,
    fontWeight: "600",
  },
  passInputGroup: {
    marginBottom: 12,
  },
  inputLabelSmall: {
    fontSize: 12,
    fontWeight: "600",
    color: "#cbd5e1",
    marginBottom: 6,
  },
  modalPassInputField: {
    backgroundColor: "rgba(30, 41, 59, 0.7)",
    borderWidth: 1,
    borderColor: "rgba(148, 163, 184, 0.25)",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
    color: "#f8fafc",
  },
  showPassToggle: {
    alignSelf: "flex-end",
    marginBottom: 16,
  },
  showPassToggleText: {
    fontSize: 12,
    color: "#38bdf8",
    fontWeight: "600",
  },
});
