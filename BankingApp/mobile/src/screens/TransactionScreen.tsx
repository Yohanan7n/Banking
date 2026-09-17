import React, { useState, useEffect } from "react";
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  FlatList,
  TextInput,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { api } from "../api";
import type { RootStackParamList } from "../navigation/types";

type Props = NativeStackScreenProps<RootStackParamList, "Transactions">;

interface Transaction {
  id: number;
  title: string;
  amount: number;
  type: "DEPOSIT" | "WITHDRAWAL";
  date: string;
}

export default function TransactionScreen({ navigation }: Props) {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [filteredTransactions, setFilteredTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filterType, setFilterType] = useState<"ALL" | "DEPOSIT" | "WITHDRAWAL">("ALL");
  const [searchQuery, setSearchQuery] = useState("");

  const fetchTransactions = async () => {
    try {
      const response = await api.get("/user/transactions");
      setTransactions(response.data);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchTransactions();
  }, []);

  useEffect(() => {
    let result = transactions;

    if (filterType !== "ALL") {
      result = result.filter((t) => t.type === filterType);
    }

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (t) =>
          t.title.toLowerCase().includes(query) ||
          t.amount.toString().includes(query)
      );
    }

    setFilteredTransactions(result);
  }, [transactions, filterType, searchQuery]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchTransactions();
  };

  const renderItem = ({ item }: { item: Transaction }) => {
    const isPositive = item.type === "DEPOSIT";
    const amountPrefix = isPositive ? "+" : "-";
    const dateObj = new Date(item.date);
    const dateStr = dateObj.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
    const timeStr = dateObj.toLocaleTimeString(undefined, {
      hour: "2-digit",
      minute: "2-digit",
    });

    return (
      <View style={styles.transactionCard}>
        <View style={styles.leftSection}>
          <View
            style={[
              styles.iconContainer,
              isPositive ? styles.depositIconBg : styles.withdrawalIconBg,
            ]}
          >
            <Text style={[styles.iconText, isPositive ? styles.depositText : styles.withdrawalText]}>
              {isPositive ? "↓" : "↑"}
            </Text>
          </View>
          <View>
            <Text style={styles.transactionTitle}>{item.title}</Text>
            <Text style={styles.transactionSubtitle}>
              {dateStr} • {timeStr}
            </Text>
          </View>
        </View>

        <Text
          style={[
            styles.transactionAmount,
            isPositive ? styles.positiveAmount : styles.negativeAmount,
          ]}
        >
          {amountPrefix}${item.amount.toFixed(2)}
        </Text>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>All Transactions</Text>
        <View style={{ width: 50 }} />
      </View>

      <View style={styles.content}>
        {/* Search Bar */}
        <View style={styles.searchContainer}>
          <TextInput
            style={styles.searchInput}
            placeholder="Search by title, transfer note or amount..."
            placeholderTextColor="#64748b"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>

        {/* Filter Tabs */}
        <View style={styles.filterTabs}>
          {(["ALL", "DEPOSIT", "WITHDRAWAL"] as const).map((type) => (
            <TouchableOpacity
              key={type}
              style={[
                styles.tabButton,
                filterType === type && styles.tabButtonActive,
              ]}
              onPress={() => setFilterType(type)}
            >
              <Text
                style={[
                  styles.tabText,
                  filterType === type && styles.tabTextActive,
                ]}
              >
                {type === "ALL" ? "All" : type === "DEPOSIT" ? "Income (+)" : "Expenses (-)"}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Transactions List */}
        {loading ? (
          <View style={styles.centerContainer}>
            <ActivityIndicator size="large" color="#0052cc" />
          </View>
        ) : filteredTransactions.length === 0 ? (
          <View style={styles.centerContainer}>
            <Text style={styles.emptyTitle}>No Transactions Found</Text>
            <Text style={styles.emptySubtitle}>
              {searchQuery
                ? "Try searching for something else."
                : "Your transaction history will appear here."}
            </Text>
          </View>
        ) : (
          <FlatList
            data={filteredTransactions}
            keyExtractor={(item) => item.id.toString()}
            renderItem={renderItem}
            contentContainerStyle={styles.listContent}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
            }
          />
        )}
      </View>
    </View>
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
    fontSize: 14,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#f8fafc",
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  searchContainer: {
    marginBottom: 12,
  },
  searchInput: {
    backgroundColor: "rgba(30, 41, 59, 0.7)",
    borderWidth: 1,
    borderColor: "rgba(148, 163, 184, 0.25)",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 11,
    fontSize: 14,
    color: "#f8fafc",
  },
  filterTabs: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 16,
  },
  tabButton: {
    flex: 1,
    backgroundColor: "rgba(30, 41, 59, 0.6)",
    borderWidth: 1,
    borderColor: "rgba(148, 163, 184, 0.18)",
    paddingVertical: 9,
    borderRadius: 10,
    alignItems: "center",
  },
  tabButtonActive: {
    backgroundColor: "#0284c7",
    borderColor: "rgba(56, 189, 248, 0.5)",
  },
  tabText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#94a3b8",
  },
  tabTextActive: {
    color: "#ffffff",
    fontWeight: "700",
  },
  listContent: {
    paddingBottom: 30,
  },
  transactionCard: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "rgba(15, 23, 42, 0.85)",
    padding: 16,
    borderRadius: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "rgba(148, 163, 184, 0.14)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 8,
    elevation: 3,
  },
  leftSection: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    flex: 1,
  },
  iconContainer: {
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
  iconText: {
    fontSize: 18,
    fontWeight: "700",
  },
  depositText: {
    color: "#34d399",
  },
  withdrawalText: {
    color: "#fb7185",
  },
  transactionTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: "#f1f5f9",
    marginBottom: 2,
  },
  transactionSubtitle: {
    fontSize: 12,
    color: "#64748b",
  },
  transactionAmount: {
    fontSize: 16,
    fontWeight: "700",
  },
  positiveAmount: {
    color: "#34d399",
  },
  negativeAmount: {
    color: "#fb7185",
  },
  centerContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingTop: 40,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: "#94a3b8",
    marginBottom: 6,
  },
  emptySubtitle: {
    fontSize: 14,
    color: "#64748b",
    textAlign: "center",
  },
});
