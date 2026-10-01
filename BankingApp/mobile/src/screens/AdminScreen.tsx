import React, { useState, useEffect } from "react";
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Modal,
  Alert,
  Platform,
  RefreshControl,
  KeyboardAvoidingView,
} from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import * as SecureStore from "expo-secure-store";
import { api } from "../api";
import type { RootStackParamList } from "../navigation/types";

type Props = NativeStackScreenProps<RootStackParamList, "Admin">;

interface AdminStats {
  totalUsers: number;
  totalTransactions: number;
  totalBankReserves: number;
  totalDepositedVolume: number;
  totalWithdrawnVolume: number;
}

interface UserItem {
  id: number;
  fullName: string;
  email: string;
  balance: number;
  role: string;
  createdAt: string;
  _count: {
    transactions: number;
  };
}

interface GlobalTransaction {
  id: number;
  title: string;
  amount: number;
  type: "DEPOSIT" | "WITHDRAWAL";
  date: string;
  senderName?: string;
  senderEmail?: string;
  recipientName?: string;
  recipientEmail?: string;
  user: {
    id: number;
    fullName: string;
    email: string;
  };
}

export default function AdminScreen({ navigation }: Props) {
  // Authentication Gate State
  const [isAuthenticatedAdmin, setIsAuthenticatedAdmin] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [authMode, setAuthMode] = useState<"PIN" | "CREDENTIALS">("PIN");
  const [adminPin, setAdminPin] = useState("");
  const [adminEmail, setAdminEmail] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);
  const [isCurrentUserAdminRole, setIsCurrentUserAdminRole] = useState(false);

  // Admin Board Data State
  const [activeTab, setActiveTab] = useState<"USERS" | "TRANSACTIONS">("USERS");
  const [txFilter, setTxFilter] = useState<"ALL" | "TRANSFERS" | "DEPOSITS" | "WITHDRAWALS">("ALL");
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [users, setUsers] = useState<UserItem[]>([]);
  const [transactions, setTransactions] = useState<GlobalTransaction[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // Adjust Balance Modal State
  const [selectedUser, setSelectedUser] = useState<UserItem | null>(null);
  const [adjustModalVisible, setAdjustModalVisible] = useState(false);
  const [adjustAmount, setAdjustAmount] = useState("");
  const [adjustType, setAdjustType] = useState<"CREDIT" | "DEBIT">("CREDIT");
  const [adjustReason, setAdjustReason] = useState("");
  const [adjusting, setAdjusting] = useState(false);

  // Password Recovery / Reset Modal State
  const [resetModalVisible, setResetModalVisible] = useState(false);
  const [resetUser, setResetUser] = useState<UserItem | null>(null);
  const [newPasswordInput, setNewPasswordInput] = useState("");
  const [resettingPassword, setResettingPassword] = useState(false);

  // Create New Customer Account Modal State
  const [createUserModalVisible, setCreateUserModalVisible] = useState(false);
  const [createFullName, setCreateFullName] = useState("");
  const [createEmail, setCreateEmail] = useState("");
  const [createPassword, setCreatePassword] = useState("");
  const [createInitialBalance, setCreateInitialBalance] = useState("1000");
  const [createRole, setCreateRole] = useState<"USER" | "ADMIN">("USER");
  const [creatingUser, setCreatingUser] = useState(false);
  const [createdCredentialsModal, setCreatedCredentialsModal] = useState<{
    fullName: string;
    email: string;
    password: string;
    initialBalance: number;
    role: string;
  } | null>(null);

  // Check current session info
  useEffect(() => {
    const checkCurrentUserRole = async () => {
      try {
        const res = await api.get("/user/dashboard");
        if (res.data?.role === "ADMIN") {
          setIsCurrentUserAdminRole(true);
          setIsAuthenticatedAdmin(true);
          fetchAdminData();
        } else {
          setIsCurrentUserAdminRole(false);
          setIsAuthenticatedAdmin(false);
          setAuthMode("CREDENTIALS");
        }
      } catch (error) {
        setIsCurrentUserAdminRole(false);
        setIsAuthenticatedAdmin(false);
        setAuthMode("CREDENTIALS");
      } finally {
        setCheckingAuth(false);
      }
    };
    checkCurrentUserRole();
  }, []);

  // 1. Verify via Master PIN
  const handleVerifyMasterPin = async () => {
    if (!adminPin.trim()) {
      showAlert("PIN Required", "Please enter the 6-digit Master Admin Security PIN.");
      return;
    }

    setLoginLoading(true);
    try {
      await api.post("/admin/verify-pin", { pin: adminPin.trim() });
      setIsAuthenticatedAdmin(true);
      fetchAdminData();
    } catch (error: any) {
      const msg = error.response?.data?.error || "Invalid Master Security PIN. Access denied.";
      showAlert("Security Verification Failed", msg);
    } finally {
      setLoginLoading(false);
    }
  };

  // 2. Verify via Admin Account Credentials + PIN
  const handleAdminLogin = async () => {
    if (!adminEmail.trim() || !adminPassword.trim()) {
      showAlert("Credentials Required", "Please enter both administrator email/username and password.");
      return;
    }

    setLoginLoading(true);
    try {
      const res = await api.post("/admin/verify-pin", {
        pin: adminPin.trim() || "889900",
        email: adminEmail.trim(),
        password: adminPassword.trim(),
      });

      if (res.data.token) {
        if (Platform.OS === "web") {
          localStorage.setItem("userToken", res.data.token);
        } else {
          await SecureStore.setItemAsync("userToken", res.data.token);
        }
      }

      setIsAuthenticatedAdmin(true);
      fetchAdminData();
    } catch (error: any) {
      const msg = error.response?.data?.error || "Invalid administrator credentials or access denied.";
      showAlert("Admin Access Denied", msg);
    } finally {
      setLoginLoading(false);
    }
  };

  // Back navigation from Security Gate
  const handleGateBack = () => {
    if (navigation.canGoBack()) {
      navigation.goBack();
    } else {
      navigation.replace("Login");
    }
  };

  // Back navigation from Admin Dashboard
  const handleDashboardBack = () => {
    if (navigation.canGoBack()) {
      navigation.goBack();
    } else {
      navigation.replace("Dashboard");
    }
  };

  // Admin Logout
  const handleAdminLogout = async () => {
    if (Platform.OS === "web") {
      localStorage.removeItem("userToken");
    } else {
      await SecureStore.deleteItemAsync("userToken");
    }
    navigation.replace("Login");
  };

  // Lock Admin Console
  const handleLockConsole = () => {
    setIsAuthenticatedAdmin(false);
    setAdminPin("");
    setAdminPassword("");
    showAlert("Console Locked", "Administrator console has been locked securely.");
  };

  const fetchAdminData = async () => {
    setLoading(true);
    try {
      const [statsRes, usersRes, txRes] = await Promise.all([
        api.get("/admin/stats"),
        api.get("/admin/users"),
        api.get("/admin/transactions"),
      ]);
      setStats(statsRes.data);
      setUsers(usersRes.data);
      setTransactions(txRes.data);
    } catch (error: any) {
      console.error(error);
      const msg = error.response?.data?.error || "Failed to load admin data.";
      showAlert("Error", msg);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchAdminData();
  };

  const showAlert = (title: string, message: string) => {
    if (Platform.OS === "web") {
      alert(`${title}: ${message}`);
    } else {
      Alert.alert(title, message);
    }
  };

  const handleAdjustBalance = async () => {
    if (!selectedUser) return;
    const numAmount = parseFloat(adjustAmount);
    if (isNaN(numAmount) || numAmount <= 0) {
      showAlert("Error", "Please enter a valid positive amount.");
      return;
    }

    setAdjusting(true);
    try {
      const res = await api.post("/admin/user/adjust-balance", {
        userId: selectedUser.id,
        amount: numAmount,
        type: adjustType,
        reason: adjustReason.trim(),
      });

      showAlert("Success", res.data.message);
      setAdjustModalVisible(false);
      setAdjustAmount("");
      setAdjustReason("");
      setSelectedUser(null);
      fetchAdminData();
    } catch (error: any) {
      const msg = error.response?.data?.error || "Failed to adjust balance.";
      showAlert("Adjustment Failed", msg);
    } finally {
      setAdjusting(false);
    }
  };

  // Password Recovery / Reset Handlers
  const handleOpenResetModal = (user: UserItem) => {
    setResetUser(user);
    const randomPin = Math.floor(100000 + Math.random() * 900000);
    setNewPasswordInput(`Bank#${randomPin}`);
    setResetModalVisible(true);
  };

  const handleGenerateTempPassword = () => {
    const randomPin = Math.floor(100000 + Math.random() * 900000);
    setNewPasswordInput(`Bank#${randomPin}`);
  };

  const handleConfirmResetPassword = async () => {
    if (!resetUser) return;
    if (!newPasswordInput.trim() || newPasswordInput.trim().length < 6) {
      showAlert("Invalid Password", "New password must be at least 6 characters long.");
      return;
    }

    setResettingPassword(true);
    try {
      await api.post("/admin/user/reset-password", {
        userId: resetUser.id,
        newPassword: newPasswordInput.trim(),
      });

      const updatedPass = newPasswordInput.trim();
      const userName = resetUser.fullName;
      const userEmail = resetUser.email;

      setResetModalVisible(false);
      setResetUser(null);
      setNewPasswordInput("");

      if (Platform.OS === "web") {
        alert(
          `✅ Password Updated Successfully!\n\nCustomer: ${userName} (${userEmail})\nNew Password: ${updatedPass}\n\nPlease share this password with the customer so they can sign in immediately.`
        );
      } else {
        Alert.alert(
          "Password Updated Successfully",
          `Customer: ${userName} (${userEmail})\n\nNew Password: ${updatedPass}\n\nPlease share this password with the customer so they can sign in immediately.`
        );
      }
    } catch (error: any) {
      const msg = error.response?.data?.error || "Failed to reset customer password.";
      showAlert("Reset Failed", msg);
    } finally {
      setResettingPassword(false);
    }
  };

  // Create New Customer Handlers
  const handleOpenCreateModal = () => {
    setCreateFullName("");
    setCreateEmail("");
    const randomPin = Math.floor(100000 + Math.random() * 900000);
    setCreatePassword(`Bank#${randomPin}`);
    setCreateInitialBalance("1000");
    setCreateRole("USER");
    setCreateUserModalVisible(true);
  };

  const handleGenerateCreatePassword = () => {
    const randomPin = Math.floor(100000 + Math.random() * 900000);
    setCreatePassword(`Bank#${randomPin}`);
  };

  const handleConfirmCreateUser = async () => {
    if (!createFullName.trim()) {
      showAlert("Missing Information", "Please enter the customer's full name.");
      return;
    }
    if (!createEmail.trim()) {
      showAlert("Missing Information", "Please enter a valid email address/username.");
      return;
    }
    if (!createPassword.trim() || createPassword.trim().length < 6) {
      showAlert("Invalid Password", "Password must be at least 6 characters long.");
      return;
    }

    setCreatingUser(true);
    try {
      const res = await api.post("/admin/user/create", {
        fullName: createFullName.trim(),
        email: createEmail.trim().toLowerCase(),
        password: createPassword.trim(),
        initialBalance: parseFloat(createInitialBalance) || 0,
        role: createRole,
      });

      const creds = res.data.issuedCredentials;
      setCreateUserModalVisible(false);
      fetchAdminData();

      setCreatedCredentialsModal({
        fullName: res.data.user.fullName,
        email: creds.username,
        password: creds.password,
        initialBalance: creds.initialBalance,
        role: creds.role,
      });
    } catch (error: any) {
      const msg = error.response?.data?.error || "Failed to create customer account.";
      showAlert("Account Creation Failed", msg);
    } finally {
      setCreatingUser(false);
    }
  };

  const handleDeleteUser = (user: UserItem) => {
    const confirmDelete = async () => {
      try {
        await api.delete(`/admin/user/${user.id}`);
        showAlert("User Deleted", `Account for ${user.fullName} has been removed.`);
        fetchAdminData();
      } catch (error: any) {
        const msg = error.response?.data?.error || "Failed to delete user.";
        showAlert("Error", msg);
      }
    };

    if (Platform.OS === "web") {
      if (window.confirm(`Are you sure you want to delete user ${user.fullName} (${user.email})? This will delete all their transactions.`)) {
        confirmDelete();
      }
    } else {
      Alert.alert(
        "Delete User",
        `Are you sure you want to delete ${user.fullName}? All transaction history will be wiped.`,
        [
          { text: "Cancel", style: "cancel" },
          { text: "Delete", style: "destructive", onPress: confirmDelete },
        ]
      );
    }
  };

  const handleToggleRole = async (user: UserItem) => {
    const newRole = user.role === "ADMIN" ? "USER" : "ADMIN";
    try {
      await api.post("/admin/user/role", { userId: user.id, role: newRole });
      showAlert("Role Updated", `${user.fullName} is now a ${newRole}.`);
      fetchAdminData();
    } catch (error: any) {
      const msg = error.response?.data?.error || "Failed to update role.";
      showAlert("Error", msg);
    }
  };

  const filteredUsers = users.filter((u) => {
    const q = searchQuery.toLowerCase();
    return (
      u.fullName.toLowerCase().includes(q) ||
      u.email.toLowerCase().includes(q) ||
      u.id.toString().includes(q)
    );
  });

  const filteredTransactions = transactions.filter((t) => {
    const q = searchQuery.toLowerCase();
    const matchesSearch =
      !q ||
      t.title.toLowerCase().includes(q) ||
      t.user.fullName.toLowerCase().includes(q) ||
      t.user.email.toLowerCase().includes(q) ||
      (t.senderName && t.senderName.toLowerCase().includes(q)) ||
      (t.senderEmail && t.senderEmail.toLowerCase().includes(q)) ||
      (t.recipientName && t.recipientName.toLowerCase().includes(q)) ||
      (t.recipientEmail && t.recipientEmail.toLowerCase().includes(q)) ||
      t.amount.toString().includes(q);

    if (!matchesSearch) return false;

    if (txFilter === "TRANSFERS") {
      return t.title.toLowerCase().includes("transfer");
    }
    if (txFilter === "DEPOSITS") {
      return t.type === "DEPOSIT" && !t.title.toLowerCase().includes("transfer");
    }
    if (txFilter === "WITHDRAWALS") {
      return t.type === "WITHDRAWAL" && !t.title.toLowerCase().includes("transfer");
    }
    return true;
  });

  // Initial loading state
  if (checkingAuth) {
    return (
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator size="large" color="#7e22ce" />
      </View>
    );
  }

  // 1. ADMIN SECURITY GATEWAY (If not authenticated as ADMIN)
  if (!isAuthenticatedAdmin) {
    return (
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={handleGateBack}>
            <Text style={styles.backText}>← Back</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Admin Security Gate</Text>
          <View style={{ width: 50 }} />
        </View>

        <View style={styles.loginCardContainer}>
          <View style={styles.loginCard}>
            <View style={styles.lockIconContainer}>
              <Text style={{ fontSize: 36 }}>🛡️</Text>
            </View>

            <Text style={styles.loginTitle}>High Security Access</Text>
            <Text style={styles.loginSubtitle}>
              Authentication with verified Administrator Credentials and Master PIN is required to access bank reserves and customer data.
            </Text>

            {/* Auth Method Selector */}
            <View style={styles.authModeSelector}>
              <TouchableOpacity
                style={[styles.authModeTab, authMode === "PIN" && styles.authModeTabActive]}
                onPress={() => setAuthMode("PIN")}
              >
                <Text style={[styles.authModeTabText, authMode === "PIN" && styles.authModeTabTextActive]}>
                  🔑 Master PIN
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.authModeTab, authMode === "CREDENTIALS" && styles.authModeTabActive]}
                onPress={() => setAuthMode("CREDENTIALS")}
              >
                <Text style={[styles.authModeTabText, authMode === "CREDENTIALS" && styles.authModeTabTextActive]}>
                  👤 Credentials + PIN
                </Text>
              </TouchableOpacity>
            </View>

            {authMode === "PIN" ? (
              <View>
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>6-Digit Master Security PIN</Text>
                  <TextInput
                    style={[
                      styles.inputField,
                      adminPin ? { textAlign: "center", fontSize: 20, letterSpacing: 8, fontWeight: "700" } : null,
                    ]}
                    placeholder="Enter security PIN"
                    placeholderTextColor="#94a3b8"
                    value={adminPin}
                    onChangeText={setAdminPin}
                    keyboardType="numeric"
                    maxLength={6}
                    secureTextEntry
                    editable={!loginLoading}
                  />
                </View>

                <TouchableOpacity
                  style={[styles.loginSubmitBtn, loginLoading && { opacity: 0.7 }]}
                  onPress={handleVerifyMasterPin}
                  disabled={loginLoading}
                >
                  {loginLoading ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <Text style={styles.loginSubmitBtnText}>Verify Security PIN 🔓</Text>
                  )}
                </TouchableOpacity>
              </View>
            ) : (
              <View>
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Admin Email / Username</Text>
                  <TextInput
                    style={styles.inputField}
                    placeholder="Enter admin ID or email"
                    placeholderTextColor="#94a3b8"
                    value={adminEmail}
                    onChangeText={setAdminEmail}
                    autoCapitalize="none"
                    keyboardType="email-address"
                    editable={!loginLoading}
                  />
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Admin Master Password</Text>
                  <TextInput
                    style={styles.inputField}
                    placeholder="Enter master password"
                    placeholderTextColor="#94a3b8"
                    value={adminPassword}
                    onChangeText={setAdminPassword}
                    secureTextEntry
                    editable={!loginLoading}
                  />
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Master Security PIN</Text>
                  <TextInput
                    style={[
                      styles.inputField,
                      adminPin ? { letterSpacing: 6, fontWeight: "700" } : null,
                    ]}
                    placeholder="Enter security PIN"
                    placeholderTextColor="#94a3b8"
                    value={adminPin}
                    onChangeText={setAdminPin}
                    keyboardType="numeric"
                    maxLength={6}
                    secureTextEntry
                    editable={!loginLoading}
                  />
                </View>

                <TouchableOpacity
                  style={[styles.loginSubmitBtn, loginLoading && { opacity: 0.7 }]}
                  onPress={handleAdminLogin}
                  disabled={loginLoading}
                >
                  {loginLoading ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <Text style={styles.loginSubmitBtnText}>Authorize Administrator 🛡️</Text>
                  )}
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>
      </KeyboardAvoidingView>
    );
  }

  // 2. UNLOCKED ADMIN DASHBOARD
  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={handleDashboardBack}>
          <Text style={styles.backText}>👤 Customer View</Text>
        </TouchableOpacity>
        <View style={styles.headerTitleContainer}>
          <Text style={styles.headerBadge}>ADMIN CONSOLE</Text>
          <Text style={styles.headerTitle}>Bank Management</Text>
        </View>
        <View style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>
          <TouchableOpacity style={styles.lockIconBtn} onPress={handleLockConsole}>
            <Text style={{ fontSize: 13, color: "#c5221f", fontWeight: "700" }}>🔒 Lock</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.logoutHeaderBtn} onPress={handleAdminLogout}>
            <Text style={{ fontSize: 13, color: "#64748b", fontWeight: "600" }}>Log out</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.refreshIconBtn} onPress={onRefresh}>
            <Text style={{ fontSize: 16 }}>🔄</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* KPI Stats Grid */}
        <View style={styles.kpiGrid}>
          <View style={styles.kpiCard}>
            <Text style={styles.kpiLabel}>Vault Total Reserves</Text>
            <Text style={styles.kpiValue}>
              ${stats?.totalBankReserves ? stats.totalBankReserves.toFixed(2) : "0.00"}
            </Text>
            <Text style={styles.kpiFootnote}>⚡ High-Security Liquidity Pool</Text>
          </View>

          <View style={styles.kpiRow}>
            <View style={styles.kpiCardSmall}>
              <Text style={styles.kpiLabelSmall}>Total Users</Text>
              <Text style={styles.kpiValueSmall}>{stats?.totalUsers || 0}</Text>
              <Text style={styles.kpiTag}>👥 Active Accounts</Text>
            </View>

            <View style={styles.kpiCardSmall}>
              <Text style={styles.kpiLabelSmall}>Total Transactions</Text>
              <Text style={styles.kpiValueSmall}>{stats?.totalTransactions || 0}</Text>
              <Text style={[styles.kpiTag, { color: "#38bdf8" }]}>⚡ Global Ledger</Text>
            </View>
          </View>
        </View>

        {/* Search Bar */}
        <View style={styles.searchContainer}>
          <TextInput
            style={styles.searchInput}
            placeholder={
              activeTab === "USERS"
                ? "Search users by name, email, or ID..."
                : "Search transactions by description, user, amount..."
            }
            placeholderTextColor="#64748b"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>

        {/* Tab Selector */}
        <View style={styles.tabBar}>
          <TouchableOpacity
            style={[styles.tabItem, activeTab === "USERS" && styles.tabItemActive]}
            onPress={() => {
              setActiveTab("USERS");
              setSearchQuery("");
            }}
          >
            <Text style={[styles.tabItemText, activeTab === "USERS" && styles.tabItemTextActive]}>
              👥 User Accounts ({filteredUsers.length})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tabItem, activeTab === "TRANSACTIONS" && styles.tabItemActive]}
            onPress={() => {
              setActiveTab("TRANSACTIONS");
              setSearchQuery("");
            }}
          >
            <Text style={[styles.tabItemText, activeTab === "TRANSACTIONS" && styles.tabItemTextActive]}>
              📜 Global Ledger ({filteredTransactions.length})
            </Text>
          </TouchableOpacity>
        </View>

        {/* TAB 1: USERS LIST */}
        {activeTab === "USERS" && (
          <View style={styles.sectionContainer}>
            {/* Action Bar */}
            <View style={styles.sectionHeaderRow}>
              <View>
                <Text style={styles.sectionHeadingTitle}>Customer Accounts</Text>
                <Text style={styles.sectionHeadingSubtitle}>Issue credentials, adjust balances & audit profiles</Text>
              </View>
              <TouchableOpacity
                style={styles.createCustomerBtn}
                onPress={handleOpenCreateModal}
              >
                <Text style={styles.createCustomerBtnText}>👤+ Issue New Account</Text>
              </TouchableOpacity>
            </View>

            {filteredUsers.length === 0 ? (
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyText}>No users found.</Text>
              </View>
            ) : (
              filteredUsers.map((u) => (
                <View key={u.id} style={styles.userCard}>
                  <View style={styles.userCardHeader}>
                    <View style={styles.userInfo}>
                      <View style={styles.avatar}>
                        <Text style={styles.avatarText}>
                          {u.fullName.charAt(0).toUpperCase()}
                        </Text>
                      </View>
                      <View>
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                          <Text style={styles.userFullName}>{u.fullName}</Text>
                          {u.role === "ADMIN" && (
                            <View style={styles.adminBadge}>
                              <Text style={styles.adminBadgeText}>ADMIN</Text>
                            </View>
                          )}
                        </View>
                        <Text style={styles.userEmail}>{u.email}</Text>
                        <Text style={styles.userMeta}>
                          Joined {new Date(u.createdAt).toLocaleDateString()} • {u._count.transactions} txs
                        </Text>
                      </View>
                    </View>

                    <View style={styles.userBalanceContainer}>
                      <Text style={styles.userBalanceLabel}>Balance</Text>
                      <Text style={styles.userBalanceAmount}>${u.balance.toFixed(2)}</Text>
                    </View>
                  </View>

                  {/* Action Buttons for User */}
                  <View style={styles.userActions}>
                    <TouchableOpacity
                      style={styles.adjustBtn}
                      onPress={() => {
                        setSelectedUser(u);
                        setAdjustModalVisible(true);
                      }}
                    >
                      <Text style={styles.adjustBtnText}>⚡ Adjust Balance</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.resetPassBtn}
                      onPress={() => handleOpenResetModal(u)}
                    >
                      <Text style={styles.resetPassBtnText}>🔑 Reset Pass</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.roleBtn}
                      onPress={() => handleToggleRole(u)}
                    >
                      <Text style={styles.roleBtnText}>
                        {u.role === "ADMIN" ? "Demote to User" : "Make Admin"}
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.deleteBtn}
                      onPress={() => handleDeleteUser(u)}
                    >
                      <Text style={styles.deleteBtnText}>🗑️ Delete</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))
            )}
          </View>
        )}

        {/* TAB 2: GLOBAL TRANSACTIONS LIST */}
        {activeTab === "TRANSACTIONS" && (
          <View style={styles.sectionContainer}>
            {/* Filter Pills */}
            <View style={styles.txFilterRow}>
              <TouchableOpacity
                style={[styles.txFilterChip, txFilter === "ALL" && styles.txFilterChipActive]}
                onPress={() => setTxFilter("ALL")}
              >
                <Text style={[styles.txFilterChipText, txFilter === "ALL" && styles.txFilterChipTextActive]}>
                  All ({transactions.length})
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.txFilterChip, txFilter === "TRANSFERS" && styles.txFilterChipActive]}
                onPress={() => setTxFilter("TRANSFERS")}
              >
                <Text style={[styles.txFilterChipText, txFilter === "TRANSFERS" && styles.txFilterChipTextActive]}>
                  💸 P2P Transfers
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.txFilterChip, txFilter === "DEPOSITS" && styles.txFilterChipActive]}
                onPress={() => setTxFilter("DEPOSITS")}
              >
                <Text style={[styles.txFilterChipText, txFilter === "DEPOSITS" && styles.txFilterChipTextActive]}>
                  📥 Deposits
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.txFilterChip, txFilter === "WITHDRAWALS" && styles.txFilterChipActive]}
                onPress={() => setTxFilter("WITHDRAWALS")}
              >
                <Text style={[styles.txFilterChipText, txFilter === "WITHDRAWALS" && styles.txFilterChipTextActive]}>
                  📤 Withdrawals
                </Text>
              </TouchableOpacity>
            </View>

            {filteredTransactions.length === 0 ? (
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyText}>No matching transactions found.</Text>
              </View>
            ) : (
              filteredTransactions.map((tx) => {
                const isTransfer = tx.title.toLowerCase().includes("transfer");
                const isDeposit = tx.type === "DEPOSIT";
                const dateObj = new Date(tx.date);

                const senderDisplay = tx.senderName || (isDeposit ? "Direct / Bank Deposit" : tx.user.fullName);
                const senderEmailDisplay = tx.senderEmail || (isDeposit ? "bank@system" : tx.user.email);
                const recipientDisplay = tx.recipientName || (isDeposit ? tx.user.fullName : "ATM / External");
                const recipientEmailDisplay = tx.recipientEmail || (isDeposit ? tx.user.email : "");

                return (
                  <View key={tx.id} style={styles.txAuditCard}>
                    {/* Header: Category Badge + Amount */}
                    <View style={styles.txCardHeader}>
                      <View
                        style={[
                          styles.txCategoryBadge,
                          isTransfer
                            ? styles.txBadgeTransfer
                            : isDeposit
                            ? styles.txBadgeDeposit
                            : styles.txBadgeWithdrawal,
                        ]}
                      >
                        <Text
                          style={[
                            styles.txCategoryBadgeText,
                            isTransfer
                              ? styles.txBadgeTransferText
                              : isDeposit
                              ? styles.txBadgeDepositText
                              : styles.txBadgeWithdrawalText,
                          ]}
                        >
                          {isTransfer
                            ? "🔄 P2P MONEY TRANSFER"
                            : isDeposit
                            ? "📥 DEPOSIT"
                            : "📤 WITHDRAWAL"}
                        </Text>
                      </View>

                      <Text
                        style={[
                          styles.txCardAmount,
                          isDeposit ? styles.depositColor : styles.withdrawalColor,
                        ]}
                      >
                        {isDeposit ? "+" : "-"}${tx.amount.toFixed(2)}
                      </Text>
                    </View>

                    {/* Sender and Recipient Flow Box */}
                    <View style={styles.partyBox}>
                      {/* Sender */}
                      <View style={styles.partyColumn}>
                        <Text style={styles.partyRoleLabel}>📤 SENDER (Sent By)</Text>
                        <Text style={styles.partyName} numberOfLines={1}>
                          {senderDisplay}
                        </Text>
                        {senderEmailDisplay ? (
                          <Text style={styles.partyEmail} numberOfLines={1}>
                            {senderEmailDisplay}
                          </Text>
                        ) : null}
                      </View>

                      {/* Direction Arrow */}
                      <View style={styles.partyArrowContainer}>
                        <Text style={styles.partyArrow}>➔</Text>
                      </View>

                      {/* Recipient */}
                      <View style={[styles.partyColumn, { alignItems: "flex-end" }]}>
                        <Text style={styles.partyRoleLabel}>📥 RECIPIENT (Received By)</Text>
                        <Text style={[styles.partyName, { textAlign: "right" }]} numberOfLines={1}>
                          {recipientDisplay}
                        </Text>
                        {recipientEmailDisplay ? (
                          <Text style={[styles.partyEmail, { textAlign: "right" }]} numberOfLines={1}>
                            {recipientEmailDisplay}
                          </Text>
                        ) : null}
                      </View>
                    </View>

                    {/* Footer Info: Description, Ledger Account, Date, Ref ID */}
                    <View style={styles.txCardFooter}>
                      <View style={{ flex: 1, paddingRight: 8 }}>
                        <Text style={styles.txCardTitle}>{tx.title}</Text>
                        <Text style={styles.txLedgerOwner}>
                          Account Ledger: <Text style={{ color: "#cbd5e1", fontWeight: "600" }}>{tx.user.fullName}</Text> ({tx.user.email})
                        </Text>
                      </View>

                      <View style={{ alignItems: "flex-end" }}>
                        <Text style={styles.txCardRef}>#TX-{tx.id}</Text>
                        <Text style={styles.txCardTime}>
                          {dateObj.toLocaleDateString()} {dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </Text>
                      </View>
                    </View>
                  </View>
                );
              })
            )}
          </View>
        )}
      </ScrollView>

      {/* ADJUST BALANCE MODAL */}
      <Modal
        visible={adjustModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setAdjustModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Adjust User Balance</Text>
            <Text style={styles.modalSubtitle}>
              Target: <Text style={{ fontWeight: "700" }}>{selectedUser?.fullName}</Text> ({selectedUser?.email})
            </Text>
            <Text style={styles.currentBalanceText}>
              Current: ${selectedUser?.balance.toFixed(2)}
            </Text>

            {/* Type selector (Credit vs Debit) */}
            <View style={styles.adjustTypeRow}>
              <TouchableOpacity
                style={[
                  styles.adjustTypeBtn,
                  adjustType === "CREDIT" && styles.adjustTypeBtnCreditActive,
                ]}
                onPress={() => setAdjustType("CREDIT")}
              >
                <Text
                  style={[
                    styles.adjustTypeBtnText,
                    adjustType === "CREDIT" && styles.adjustTypeBtnTextActive,
                  ]}
                >
                  ➕ Credit (Add Money)
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.adjustTypeBtn,
                  adjustType === "DEBIT" && styles.adjustTypeBtnDebitActive,
                ]}
                onPress={() => setAdjustType("DEBIT")}
              >
                <Text
                  style={[
                    styles.adjustTypeBtnText,
                    adjustType === "DEBIT" && styles.adjustTypeBtnTextActive,
                  ]}
                >
                  ➖ Debit (Deduct)
                </Text>
              </TouchableOpacity>
            </View>

            {/* Amount Input */}
            <TextInput
              style={styles.modalAmountInput}
              placeholder="$0.00"
              placeholderTextColor="#64748b"
              keyboardType="decimal-pad"
              value={adjustAmount}
              onChangeText={setAdjustAmount}
              editable={!adjusting}
            />

            {/* Reason Input */}
            <TextInput
              style={styles.modalReasonInput}
              placeholder="Reason for adjustment (e.g. VIP Bonus, Correction)..."
              placeholderTextColor="#64748b"
              value={adjustReason}
              onChangeText={setAdjustReason}
              editable={!adjusting}
            />

            {/* Modal Buttons */}
            <View style={styles.modalBtnRow}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setAdjustModalVisible(false)}
                disabled={adjusting}
              >
                <Text style={styles.modalCancelBtnText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalSubmitBtn, adjusting && { opacity: 0.6 }]}
                onPress={handleAdjustBalance}
                disabled={adjusting}
              >
                {adjusting ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.modalSubmitBtnText}>Execute Adjustment</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* 2. Customer Password Recovery / Reset Modal */}
      <Modal
        visible={resetModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setResetModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>🔑 Customer Password Recovery</Text>
            <Text style={styles.modalSubtitle}>
              Issue a new password for this customer so they can log back into their account.
            </Text>

            {resetUser && (
              <View style={styles.userInfoBox}>
                <Text style={styles.userInfoName}>{resetUser.fullName}</Text>
                <Text style={styles.userInfoEmail}>{resetUser.email}</Text>
                <Text style={styles.userInfoMeta}>Account ID: #{resetUser.id}</Text>
              </View>
            )}

            <View style={{ marginBottom: 16 }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                <Text style={styles.inputLabelSmall}>New Password to Issue</Text>
                <TouchableOpacity onPress={handleGenerateTempPassword}>
                  <Text style={styles.generateBtnText}>🎲 Generate Random Pass</Text>
                </TouchableOpacity>
              </View>
              <TextInput
                style={styles.modalReasonInput}
                placeholder="Enter new password (min 6 chars)..."
                placeholderTextColor="#64748b"
                value={newPasswordInput}
                onChangeText={setNewPasswordInput}
                editable={!resettingPassword}
              />
            </View>

            {/* Modal Buttons */}
            <View style={styles.modalBtnRow}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setResetModalVisible(false)}
                disabled={resettingPassword}
              >
                <Text style={styles.modalCancelBtnText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalSubmitBtn, { backgroundColor: "#0284c7" }, resettingPassword && { opacity: 0.6 }]}
                onPress={handleConfirmResetPassword}
                disabled={resettingPassword}
              >
                {resettingPassword ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.modalSubmitBtnText}>Set & Issue Password</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* 3. Register New Customer Modal */}
      <Modal
        visible={createUserModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setCreateUserModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { maxWidth: 460 }]}>
            <Text style={styles.modalTitle}>👤 Issue New Customer Account</Text>
            <Text style={styles.modalSubtitle}>
              Create a new customer profile with login username, password, and starting balance.
            </Text>

            {/* Full Name */}
            <View style={{ marginTop: 14, marginBottom: 8 }}>
              <Text style={styles.inputLabelSmall}>Customer Full Name</Text>
              <TextInput
                style={styles.modalReasonInput}
                placeholder="e.g. Sarah Jenkins"
                placeholderTextColor="#64748b"
                value={createFullName}
                onChangeText={setCreateFullName}
                editable={!creatingUser}
              />
            </View>

            {/* Email / Username */}
            <View style={{ marginBottom: 8 }}>
              <Text style={styles.inputLabelSmall}>Account Username / Email</Text>
              <TextInput
                style={styles.modalReasonInput}
                placeholder="e.g. sarah@example.com"
                placeholderTextColor="#64748b"
                value={createEmail}
                onChangeText={setCreateEmail}
                autoCapitalize="none"
                keyboardType="email-address"
                editable={!creatingUser}
              />
            </View>

            {/* Password */}
            <View style={{ marginBottom: 8 }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                <Text style={styles.inputLabelSmall}>Initial Password</Text>
                <TouchableOpacity onPress={handleGenerateCreatePassword}>
                  <Text style={styles.generateBtnText}>🎲 Generate Password</Text>
                </TouchableOpacity>
              </View>
              <TextInput
                style={styles.modalReasonInput}
                placeholder="Enter or generate password..."
                placeholderTextColor="#64748b"
                value={createPassword}
                onChangeText={setCreatePassword}
                editable={!creatingUser}
              />
            </View>

            {/* Starting Balance & Role Row */}
            <View style={{ flexDirection: "row", gap: 10, marginBottom: 14 }}>
              <View style={{ flex: 1 }}>
                <Text style={styles.inputLabelSmall}>Starting Balance ($)</Text>
                <TextInput
                  style={styles.modalReasonInput}
                  placeholder="1000.00"
                  placeholderTextColor="#64748b"
                  keyboardType="decimal-pad"
                  value={createInitialBalance}
                  onChangeText={setCreateInitialBalance}
                  editable={!creatingUser}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.inputLabelSmall}>Account Role</Text>
                <View style={{ flexDirection: "row", gap: 4, marginTop: 4 }}>
                  <TouchableOpacity
                    style={[
                      styles.roleSelectBtn,
                      createRole === "USER" && styles.roleSelectBtnActive,
                    ]}
                    onPress={() => setCreateRole("USER")}
                  >
                    <Text style={[styles.roleSelectBtnText, createRole === "USER" && styles.roleSelectBtnTextActive]}>
                      Customer
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.roleSelectBtn,
                      createRole === "ADMIN" && styles.roleSelectBtnActiveAdmin,
                    ]}
                    onPress={() => setCreateRole("ADMIN")}
                  >
                    <Text style={[styles.roleSelectBtnText, createRole === "ADMIN" && styles.roleSelectBtnTextActive]}>
                      Admin
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>

            {/* Modal Buttons */}
            <View style={styles.modalBtnRow}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setCreateUserModalVisible(false)}
                disabled={creatingUser}
              >
                <Text style={styles.modalCancelBtnText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalSubmitBtn, { backgroundColor: "#10b981", borderColor: "#34d399" }, creatingUser && { opacity: 0.6 }]}
                onPress={handleConfirmCreateUser}
                disabled={creatingUser}
              >
                {creatingUser ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.modalSubmitBtnText}>Create & Issue Account 🚀</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* 4. Credentials Issued Success Modal */}
      <Modal
        visible={!!createdCredentialsModal}
        transparent
        animationType="fade"
        onRequestClose={() => setCreatedCredentialsModal(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { maxWidth: 440 }]}>
            <View style={styles.successIconBadge}>
              <Text style={{ fontSize: 32 }}>🎉</Text>
            </View>
            <Text style={[styles.modalTitle, { textAlign: "center" }]}>Account Active & Ready!</Text>
            <Text style={[styles.modalSubtitle, { textAlign: "center" }]}>
              Please copy or hand these login credentials to the customer:
            </Text>

            {createdCredentialsModal && (
              <View style={styles.credsCard}>
                <View style={styles.credsRow}>
                  <Text style={styles.credsLabel}>Full Name</Text>
                  <Text style={styles.credsValue}>{createdCredentialsModal.fullName}</Text>
                </View>
                <View style={styles.credsRow}>
                  <Text style={styles.credsLabel}>Username / Email</Text>
                  <Text style={[styles.credsValue, { color: "#38bdf8" }]}>{createdCredentialsModal.email}</Text>
                </View>
                <View style={styles.credsRow}>
                  <Text style={styles.credsLabel}>Password</Text>
                  <Text style={styles.credsPassValue}>{createdCredentialsModal.password}</Text>
                </View>
                <View style={styles.credsRow}>
                  <Text style={styles.credsLabel}>Starting Balance</Text>
                  <Text style={[styles.credsValue, { color: "#34d399" }]}>${createdCredentialsModal.initialBalance.toFixed(2)}</Text>
                </View>
                <View style={[styles.credsRow, { borderBottomWidth: 0 }]}>
                  <Text style={styles.credsLabel}>Role</Text>
                  <Text style={[styles.credsValue, { color: createdCredentialsModal.role === "ADMIN" ? "#fbbf24" : "#cbd5e1" }]}>
                    {createdCredentialsModal.role}
                  </Text>
                </View>
              </View>
            )}

            <TouchableOpacity
              style={[styles.modalSubmitBtn, { backgroundColor: "#7e22ce" }]}
              onPress={() => setCreatedCredentialsModal(null)}
            >
              <Text style={styles.modalSubmitBtnText}>Done / Dismiss 📋</Text>
            </TouchableOpacity>
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
    paddingHorizontal: 20,
    paddingTop: 55,
    paddingBottom: 16,
    backgroundColor: "rgba(15, 23, 42, 0.95)",
    borderBottomWidth: 1,
    borderBottomColor: "rgba(148, 163, 184, 0.12)",
  },
  backButton: {
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: "rgba(30, 41, 59, 0.7)",
    borderWidth: 1,
    borderColor: "rgba(148, 163, 184, 0.2)",
  },
  backText: {
    color: "#38bdf8",
    fontWeight: "700",
    fontSize: 13,
  },
  headerTitleContainer: {
    alignItems: "center",
  },
  headerBadge: {
    fontSize: 10,
    fontWeight: "800",
    color: "#c084fc",
    letterSpacing: 1.5,
    backgroundColor: "rgba(147, 51, 234, 0.18)",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "rgba(168, 85, 247, 0.3)",
    marginBottom: 3,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: "800",
    color: "#f8fafc",
  },
  refreshIconBtn: {
    padding: 6,
  },
  scrollContent: {
    padding: 16,
    maxWidth: 1000,
    width: "100%",
    alignSelf: "center",
  },
  loginCardContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
    backgroundColor: "#080c15",
  },
  loginCard: {
    backgroundColor: "rgba(15, 23, 42, 0.9)",
    borderRadius: 24,
    padding: 30,
    width: "100%",
    maxWidth: 440,
    shadowColor: "#a855f7",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.35,
    shadowRadius: 24,
    elevation: 8,
    borderWidth: 1,
    borderColor: "rgba(168, 85, 247, 0.35)",
  },
  lockIconContainer: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: "rgba(147, 51, 234, 0.18)",
    borderWidth: 1,
    borderColor: "rgba(168, 85, 247, 0.4)",
    justifyContent: "center",
    alignItems: "center",
    alignSelf: "center",
    marginBottom: 16,
  },
  loginTitle: {
    fontSize: 24,
    fontWeight: "800",
    color: "#f8fafc",
    textAlign: "center",
    marginBottom: 8,
  },
  loginSubtitle: {
    fontSize: 13,
    color: "#94a3b8",
    textAlign: "center",
    marginBottom: 24,
    lineHeight: 19,
  },
  inputGroup: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: "#cbd5e1",
    marginBottom: 6,
  },
  inputField: {
    backgroundColor: "rgba(30, 41, 59, 0.7)",
    borderWidth: 1,
    borderColor: "rgba(148, 163, 184, 0.25)",
    borderRadius: 12,
    padding: 13,
    fontSize: 15,
    color: "#f8fafc",
  },
  loginSubmitBtn: {
    backgroundColor: "#7e22ce",
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
    marginTop: 10,
    shadowColor: "#a855f7",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 5,
    borderWidth: 1,
    borderColor: "rgba(192, 132, 252, 0.4)",
  },
  loginSubmitBtnText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "800",
    letterSpacing: 0.3,
  },
  authModeSelector: {
    flexDirection: "row",
    backgroundColor: "rgba(30, 41, 59, 0.6)",
    borderRadius: 12,
    padding: 4,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "rgba(148, 163, 184, 0.15)",
  },
  authModeTab: {
    flex: 1,
    paddingVertical: 9,
    alignItems: "center",
    borderRadius: 9,
  },
  authModeTabActive: {
    backgroundColor: "#7e22ce",
    shadowColor: "#a855f7",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 3,
  },
  authModeTabText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#94a3b8",
  },
  authModeTabTextActive: {
    color: "#ffffff",
    fontWeight: "700",
  },
  pinHint: {
    fontSize: 11,
    color: "#64748b",
    textAlign: "center",
    marginTop: 8,
  },
  lockIconBtn: {
    backgroundColor: "rgba(239, 68, 68, 0.15)",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(248, 113, 113, 0.35)",
  },
  logoutHeaderBtn: {
    backgroundColor: "rgba(30, 41, 59, 0.7)",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(148, 163, 184, 0.2)",
  },
  kpiGrid: {
    marginBottom: 16,
  },
  kpiCard: {
    borderRadius: 20,
    padding: 22,
    marginBottom: 12,
    backgroundColor: "#17122b",
    borderWidth: 1,
    borderColor: "rgba(168, 85, 247, 0.4)",
    shadowColor: "#a855f7",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 18,
    elevation: 6,
  },
  kpiLabel: {
    color: "#c084fc",
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  kpiValue: {
    color: "#ffffff",
    fontSize: 36,
    fontWeight: "800",
    marginVertical: 6,
    letterSpacing: -0.5,
  },
  kpiFootnote: {
    color: "rgba(226, 232, 240, 0.8)",
    fontSize: 12,
    fontWeight: "500",
  },
  kpiRow: {
    flexDirection: "row",
    gap: 12,
  },
  kpiCardSmall: {
    flex: 1,
    borderRadius: 16,
    padding: 16,
    backgroundColor: "rgba(15, 23, 42, 0.85)",
    borderWidth: 1,
    borderColor: "rgba(148, 163, 184, 0.15)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 3,
  },
  kpiLabelSmall: {
    fontSize: 12,
    color: "#94a3b8",
    fontWeight: "600",
  },
  kpiValueSmall: {
    fontSize: 26,
    fontWeight: "800",
    color: "#f8fafc",
    marginVertical: 4,
  },
  kpiTag: {
    fontSize: 11,
    color: "#c084fc",
    fontWeight: "700",
  },
  searchContainer: {
    marginBottom: 14,
  },
  searchInput: {
    backgroundColor: "rgba(15, 23, 42, 0.85)",
    borderWidth: 1,
    borderColor: "rgba(148, 163, 184, 0.2)",
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 14,
    color: "#f8fafc",
  },
  tabBar: {
    flexDirection: "row",
    backgroundColor: "rgba(15, 23, 42, 0.9)",
    borderRadius: 12,
    padding: 4,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "rgba(148, 163, 184, 0.15)",
  },
  tabItem: {
    flex: 1,
    paddingVertical: 11,
    borderRadius: 9,
    alignItems: "center",
  },
  tabItemActive: {
    backgroundColor: "#7e22ce",
    shadowColor: "#a855f7",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 3,
  },
  tabItemText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#94a3b8",
  },
  tabItemTextActive: {
    color: "#ffffff",
    fontWeight: "800",
  },
  sectionContainer: {
    gap: 12,
  },
  emptyContainer: {
    backgroundColor: "rgba(15, 23, 42, 0.8)",
    padding: 36,
    borderRadius: 16,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(148, 163, 184, 0.12)",
  },
  emptyText: {
    color: "#64748b",
    fontSize: 14,
    fontWeight: "500",
  },
  userCard: {
    backgroundColor: "rgba(15, 23, 42, 0.85)",
    borderRadius: 18,
    padding: 18,
    borderWidth: 1,
    borderColor: "rgba(148, 163, 184, 0.15)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 3,
  },
  userCardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 14,
  },
  userInfo: {
    flexDirection: "row",
    gap: 12,
    flex: 1,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(147, 51, 234, 0.2)",
    borderWidth: 1,
    borderColor: "rgba(168, 85, 247, 0.4)",
    justifyContent: "center",
    alignItems: "center",
  },
  avatarText: {
    fontSize: 18,
    fontWeight: "800",
    color: "#c084fc",
  },
  userFullName: {
    fontSize: 16,
    fontWeight: "700",
    color: "#f8fafc",
  },
  adminBadge: {
    backgroundColor: "rgba(245, 158, 11, 0.18)",
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: "rgba(251, 191, 36, 0.4)",
  },
  adminBadgeText: {
    fontSize: 10,
    fontWeight: "800",
    color: "#fbbf24",
    letterSpacing: 0.5,
  },
  userEmail: {
    fontSize: 13,
    color: "#94a3b8",
    marginTop: 2,
  },
  userMeta: {
    fontSize: 11,
    color: "#64748b",
    marginTop: 4,
  },
  userBalanceContainer: {
    alignItems: "flex-end",
  },
  userBalanceLabel: {
    fontSize: 10,
    color: "#64748b",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    fontWeight: "600",
  },
  userBalanceAmount: {
    fontSize: 19,
    fontWeight: "800",
    color: "#34d399",
  },
  userActions: {
    flexDirection: "row",
    gap: 8,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "rgba(148, 163, 184, 0.1)",
  },
  adjustBtn: {
    flex: 2,
    backgroundColor: "#7e22ce",
    paddingVertical: 9,
    borderRadius: 9,
    alignItems: "center",
    shadowColor: "#a855f7",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  adjustBtnText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "700",
  },
  resetPassBtn: {
    backgroundColor: "rgba(14, 165, 233, 0.15)",
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: "rgba(56, 189, 248, 0.35)",
    alignItems: "center",
  },
  resetPassBtnText: {
    color: "#38bdf8",
    fontSize: 12,
    fontWeight: "700",
  },
  roleBtn: {
    flex: 1.5,
    backgroundColor: "rgba(30, 41, 59, 0.7)",
    paddingVertical: 9,
    borderRadius: 9,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(148, 163, 184, 0.2)",
  },
  roleBtnText: {
    color: "#cbd5e1",
    fontSize: 11,
    fontWeight: "600",
  },
  deleteBtn: {
    paddingVertical: 9,
    paddingHorizontal: 12,
    backgroundColor: "rgba(239, 68, 68, 0.15)",
    borderRadius: 9,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(248, 113, 113, 0.35)",
  },
  deleteBtnText: {
    color: "#f87171",
    fontSize: 11,
    fontWeight: "700",
  },
  txFilterRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 16,
  },
  txFilterChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    backgroundColor: "rgba(30, 41, 59, 0.7)",
    borderWidth: 1,
    borderColor: "rgba(148, 163, 184, 0.15)",
  },
  txFilterChipActive: {
    backgroundColor: "#7e22ce",
    borderColor: "#a855f7",
  },
  txFilterChipText: {
    color: "#94a3b8",
    fontSize: 12,
    fontWeight: "600",
  },
  txFilterChipTextActive: {
    color: "#fff",
    fontWeight: "700",
  },
  txAuditCard: {
    backgroundColor: "rgba(15, 23, 42, 0.88)",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(148, 163, 184, 0.15)",
    padding: 16,
    marginBottom: 14,
  },
  txCardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  txCategoryBadge: {
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
  },
  txCategoryBadgeText: {
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  txBadgeTransfer: {
    backgroundColor: "rgba(99, 102, 241, 0.15)",
    borderColor: "rgba(129, 140, 248, 0.4)",
  },
  txBadgeTransferText: {
    color: "#818cf8",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  txBadgeDeposit: {
    backgroundColor: "rgba(16, 185, 129, 0.15)",
    borderColor: "rgba(52, 211, 153, 0.4)",
  },
  txBadgeDepositText: {
    color: "#34d399",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  txBadgeWithdrawal: {
    backgroundColor: "rgba(244, 63, 94, 0.15)",
    borderColor: "rgba(251, 113, 133, 0.4)",
  },
  txBadgeWithdrawalText: {
    color: "#fb7185",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  txCardAmount: {
    fontSize: 18,
    fontWeight: "900",
  },
  partyBox: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "rgba(30, 41, 59, 0.5)",
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "rgba(148, 163, 184, 0.1)",
  },
  partyColumn: {
    flex: 1,
  },
  partyRoleLabel: {
    fontSize: 10,
    fontWeight: "700",
    color: "#94a3b8",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 3,
  },
  partyName: {
    fontSize: 13,
    fontWeight: "700",
    color: "#f8fafc",
  },
  partyEmail: {
    fontSize: 11,
    color: "#64748b",
    marginTop: 1,
  },
  partyArrowContainer: {
    paddingHorizontal: 10,
  },
  partyArrow: {
    fontSize: 16,
    color: "#818cf8",
    fontWeight: "900",
  },
  txCardFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: "rgba(148, 163, 184, 0.1)",
  },
  txCardTitle: {
    fontSize: 12,
    color: "#e2e8f0",
    fontWeight: "600",
  },
  txLedgerOwner: {
    fontSize: 11,
    color: "#64748b",
    marginTop: 3,
  },
  txCardRef: {
    fontSize: 11,
    fontWeight: "800",
    color: "#94a3b8",
  },
  txCardTime: {
    fontSize: 10,
    color: "#64748b",
    marginTop: 2,
  },
  depositColor: {
    color: "#34d399",
  },
  withdrawalColor: {
    color: "#fb7185",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(3, 7, 18, 0.85)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  modalCard: {
    backgroundColor: "#0f172a",
    borderRadius: 22,
    padding: 26,
    width: "100%",
    maxWidth: 440,
    borderWidth: 1,
    borderColor: "rgba(168, 85, 247, 0.4)",
    shadowColor: "#a855f7",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.4,
    shadowRadius: 25,
    elevation: 10,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: "#f8fafc",
  },
  modalSubtitle: {
    fontSize: 13,
    color: "#94a3b8",
    marginTop: 4,
    lineHeight: 18,
  },
  currentBalanceText: {
    fontSize: 14,
    color: "#c084fc",
    fontWeight: "700",
    marginTop: 8,
    marginBottom: 14,
  },
  adjustTypeRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 16,
  },
  adjustTypeBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: "rgba(30, 41, 59, 0.7)",
    borderWidth: 1,
    borderColor: "rgba(148, 163, 184, 0.18)",
    alignItems: "center",
  },
  adjustTypeBtnCreditActive: {
    backgroundColor: "rgba(16, 185, 129, 0.2)",
    borderColor: "#34d399",
  },
  adjustTypeBtnDebitActive: {
    backgroundColor: "rgba(244, 63, 94, 0.2)",
    borderColor: "#fb7185",
  },
  adjustTypeBtnText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#94a3b8",
  },
  adjustTypeBtnTextActive: {
    color: "#f8fafc",
  },
  modalAmountInput: {
    backgroundColor: "rgba(30, 41, 59, 0.7)",
    borderWidth: 1,
    borderColor: "rgba(168, 85, 247, 0.4)",
    borderRadius: 12,
    padding: 14,
    fontSize: 24,
    fontWeight: "800",
    color: "#c084fc",
    textAlign: "center",
    marginBottom: 12,
  },
  modalReasonInput: {
    backgroundColor: "rgba(30, 41, 59, 0.7)",
    borderWidth: 1,
    borderColor: "rgba(148, 163, 184, 0.2)",
    borderRadius: 12,
    padding: 12,
    fontSize: 14,
    color: "#f8fafc",
    marginBottom: 18,
  },
  modalBtnRow: {
    flexDirection: "row",
    gap: 10,
  },
  modalCancelBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: "rgba(30, 41, 59, 0.8)",
    borderWidth: 1,
    borderColor: "rgba(148, 163, 184, 0.2)",
    alignItems: "center",
  },
  modalCancelBtnText: {
    color: "#cbd5e1",
    fontWeight: "700",
  },
  modalSubmitBtn: {
    flex: 2,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: "#7e22ce",
    borderWidth: 1,
    borderColor: "rgba(192, 132, 252, 0.4)",
    alignItems: "center",
    shadowColor: "#a855f7",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
  },
  modalSubmitBtnText: {
    color: "#fff",
    fontWeight: "800",
  },
  userInfoBox: {
    backgroundColor: "rgba(30, 41, 59, 0.6)",
    padding: 14,
    borderRadius: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "rgba(56, 189, 248, 0.3)",
  },
  userInfoName: {
    fontSize: 16,
    fontWeight: "800",
    color: "#f8fafc",
  },
  userInfoEmail: {
    fontSize: 13,
    color: "#94a3b8",
    marginTop: 2,
  },
  userInfoMeta: {
    fontSize: 11,
    color: "#38bdf8",
    fontWeight: "600",
    marginTop: 4,
  },
  inputLabelSmall: {
    fontSize: 12,
    fontWeight: "700",
    color: "#cbd5e1",
  },
  generateBtnText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#38bdf8",
  },
  sectionHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 14,
    paddingHorizontal: 2,
  },
  sectionHeadingTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#f8fafc",
  },
  sectionHeadingSubtitle: {
    fontSize: 12,
    color: "#94a3b8",
    marginTop: 2,
  },
  createCustomerBtn: {
    backgroundColor: "rgba(16, 185, 129, 0.18)",
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(52, 211, 153, 0.45)",
    shadowColor: "#10b981",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
  },
  createCustomerBtnText: {
    color: "#34d399",
    fontSize: 13,
    fontWeight: "700",
  },
  roleSelectBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: "rgba(30, 41, 59, 0.7)",
    borderWidth: 1,
    borderColor: "rgba(148, 163, 184, 0.2)",
    alignItems: "center",
  },
  roleSelectBtnActive: {
    backgroundColor: "rgba(14, 165, 233, 0.25)",
    borderColor: "#38bdf8",
  },
  roleSelectBtnActiveAdmin: {
    backgroundColor: "rgba(245, 158, 11, 0.25)",
    borderColor: "#fbbf24",
  },
  roleSelectBtnText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#94a3b8",
  },
  roleSelectBtnTextActive: {
    color: "#f8fafc",
    fontWeight: "800",
  },
  successIconBadge: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "rgba(16, 185, 129, 0.18)",
    borderWidth: 1,
    borderColor: "rgba(52, 211, 153, 0.45)",
    justifyContent: "center",
    alignItems: "center",
    alignSelf: "center",
    marginBottom: 12,
  },
  credsCard: {
    backgroundColor: "rgba(30, 41, 59, 0.7)",
    borderRadius: 14,
    padding: 16,
    marginVertical: 14,
    borderWidth: 1,
    borderColor: "rgba(56, 189, 248, 0.35)",
  },
  credsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(148, 163, 184, 0.12)",
  },
  credsLabel: {
    fontSize: 12,
    color: "#94a3b8",
    fontWeight: "600",
  },
  credsValue: {
    fontSize: 13,
    color: "#f8fafc",
    fontWeight: "700",
  },
  credsPassValue: {
    fontSize: 14,
    color: "#38bdf8",
    fontWeight: "800",
    letterSpacing: 0.5,
  },
});

