import React, { useState, useEffect } from "react";
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
  Alert,
} from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { api } from "../api";
import type { RootStackParamList } from "../navigation/types";

type Props = NativeStackScreenProps<RootStackParamList, "Transfer">;

export default function TransferScreen({ navigation }: Props) {
  const [recipientEmail, setRecipientEmail] = useState("");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [balance, setBalance] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [fetchingBalance, setFetchingBalance] = useState(true);
  const [errors, setErrors] = useState<{ [key: string]: string }>({});

  useEffect(() => {
    const fetchBalance = async () => {
      try {
        const response = await api.get("/user/dashboard");
        setBalance(response.data.balance);
      } catch (error) {
        console.error(error);
      } finally {
        setFetchingBalance(false);
      }
    };
    fetchBalance();
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

  const handleTransfer = async () => {
    const newErrors: { [key: string]: string } = {};
    const numAmount = parseFloat(amount);

    if (!recipientEmail.trim()) {
      newErrors.recipientEmail = "Recipient email is required.";
    } else if (!validateEmail(recipientEmail)) {
      newErrors.recipientEmail = "Please enter a valid recipient email address.";
    }

    if (!amount.trim()) {
      newErrors.amount = "Transfer amount is required.";
    } else if (isNaN(numAmount) || numAmount <= 0) {
      newErrors.amount = "Please enter a valid positive amount (e.g. 50.00).";
    } else if (balance !== null && numAmount > balance) {
      newErrors.amount = `Insufficient funds. Available balance: $${balance.toFixed(2)}.`;
    }

    setErrors(newErrors);

    if (Object.keys(newErrors).length > 0) {
      return;
    }

    setLoading(true);
    try {
      const response = await api.post("/user/transfer", {
        recipientEmail: recipientEmail.trim(),
        amount: numAmount,
        note: note.trim(),
      });

      if (Platform.OS === "web") {
        alert(response.data.message || "Transfer sent successfully!");
        navigation.goBack();
      } else {
        Alert.alert("Success", response.data.message || "Transfer sent successfully!", [
          { text: "OK", onPress: () => navigation.goBack() },
        ]);
      }
    } catch (error: any) {
      const message = error.response?.data?.error || "Transfer failed. Please try again.";
      showAlert("Transfer Failed", message);
    } finally {
      setLoading(false);
    }
  };

  const quickAmounts = [10, 25, 50, 100, 250];

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Send Money</Text>
        <View style={{ width: 50 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Balance Card Banner */}
        <View style={styles.balanceBanner}>
          <Text style={styles.balanceBannerLabel}>Available Balance</Text>
          {fetchingBalance ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={styles.balanceBannerValue}>
              ${balance !== null ? balance.toFixed(2) : "0.00"}
            </Text>
          )}
        </View>

        {/* Recipient Input */}
        <View style={styles.inputContainer}>
          <Text style={styles.label}>Recipient Email</Text>
          <TextInput
            style={[styles.input, errors.recipientEmail ? styles.inputError : null]}
            placeholder="e.g. alex@example.com"
            placeholderTextColor="#64748b"
            value={recipientEmail}
            onChangeText={(text) => {
              setRecipientEmail(text);
              if (errors.recipientEmail) setErrors((prev) => ({ ...prev, recipientEmail: "" }));
            }}
            keyboardType="email-address"
            autoCapitalize="none"
            editable={!loading}
          />
          {errors.recipientEmail ? <Text style={styles.errorText}>⚠️ {errors.recipientEmail}</Text> : null}
        </View>

        {/* Amount Input */}
        <View style={styles.inputContainer}>
          <Text style={styles.label}>Amount ($)</Text>
          <TextInput
            style={[styles.input, styles.amountInput, errors.amount ? styles.inputError : null]}
            placeholder="0.00"
            placeholderTextColor="#64748b"
            value={amount}
            onChangeText={(text) => {
              setAmount(text);
              if (errors.amount) setErrors((prev) => ({ ...prev, amount: "" }));
            }}
            keyboardType="decimal-pad"
            editable={!loading}
          />
          {errors.amount ? <Text style={styles.errorText}>⚠️ {errors.amount}</Text> : null}
        </View>

        {/* Quick Amount Chips */}
        <View style={styles.chipsContainer}>
          {quickAmounts.map((val) => (
            <TouchableOpacity
              key={val}
              style={[
                styles.chip,
                amount === val.toString() && styles.chipActive,
              ]}
              onPress={() => {
                setAmount(val.toString());
                if (errors.amount) setErrors((prev) => ({ ...prev, amount: "" }));
              }}
            >
              <Text
                style={[
                  styles.chipText,
                  amount === val.toString() && styles.chipTextActive,
                ]}
              >
                +${val}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Note / Message Input */}
        <View style={styles.inputContainer}>
          <Text style={styles.label}>Note / Reason (Optional)</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. Dinner split, Rent"
            placeholderTextColor="#64748b"
            value={note}
            onChangeText={setNote}
            editable={!loading}
          />
        </View>

        {/* Submit Button */}
        <TouchableOpacity
          style={[styles.sendButton, loading && styles.disabledButton]}
          onPress={handleTransfer}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.sendButtonText}>Send Money Now →</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#080c15",
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
    borderRadius: 8,
    backgroundColor: "rgba(56, 189, 248, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(56, 189, 248, 0.3)",
  },
  backText: {
    color: "#38bdf8",
    fontWeight: "700",
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#f8fafc",
  },
  scrollContent: {
    padding: 20,
  },
  balanceBanner: {
    backgroundColor: "rgba(12, 34, 64, 0.85)",
    borderRadius: 20,
    padding: 22,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: "rgba(56, 189, 248, 0.35)",
    shadowColor: "#0284c7",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 18,
    elevation: 6,
  },
  balanceBannerLabel: {
    color: "rgba(224, 242, 254, 0.8)",
    fontSize: 13,
    fontWeight: "600",
    letterSpacing: 0.5,
  },
  balanceBannerValue: {
    color: "#f8fafc",
    fontSize: 32,
    fontWeight: "900",
    marginTop: 4,
    letterSpacing: -0.5,
  },
  inputContainer: {
    marginBottom: 18,
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
    color: "#cbd5e1",
    marginBottom: 8,
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
  amountInput: {
    fontSize: 24,
    fontWeight: "800",
    color: "#38bdf8",
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
  chipsContainer: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 18,
    flexWrap: "wrap",
  },
  chip: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 20,
    backgroundColor: "rgba(30, 41, 59, 0.8)",
    borderWidth: 1,
    borderColor: "rgba(56, 189, 248, 0.2)",
  },
  chipActive: {
    backgroundColor: "#0284c7",
    borderColor: "rgba(56, 189, 248, 0.6)",
  },
  chipText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#94a3b8",
  },
  chipTextActive: {
    color: "#fff",
  },
  sendButton: {
    backgroundColor: "#0284c7",
    paddingVertical: 15,
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
  sendButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
  },
  disabledButton: {
    opacity: 0.6,
  },
});
