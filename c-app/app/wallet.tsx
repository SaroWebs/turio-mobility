import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, Alert, Modal, Platform, RefreshControl, TextInput, Pressable
} from 'react-native';
import { useRouter } from 'expo-router';
import { ArrowLeft, Wallet, Plus, ArrowUpRight, ArrowDownLeft, RotateCcw, X, ShieldCheck } from 'lucide-react-native';
import api from '../src/lib/api';
import { CardShadow, Radius, Spacing, Typography, useTheme } from '../src/constants/theme';

interface Transaction {
  id: number;
  type: 'credit' | 'debit';
  amount: string;
  description: string;
  created_at: string;
  reference_id: string | null;
}

export default function WalletScreen() {
  const router = useRouter();
  const { colors, isDark } = useTheme();
  const [balance, setBalance] = useState<number>(0);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  
  const [showTopUp, setShowTopUp] = useState(false);
  const [topUpAmount, setTopUpAmount] = useState('');
  const [processing, setProcessing] = useState(false);

  const fetchData = async () => {
    try {
      const [walletRes, transRes] = await Promise.all([
        api.get('/wallet', { params: { _t: Date.now() } }),
        api.get('/wallet/transactions')
      ]);
      setBalance(parseFloat(walletRes.data.data.balance));
      setTransactions(transRes.data.data.data);
    } catch (error) {
      console.error('Wallet fetch error', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleTopUp = async () => {
    const amount = parseFloat(topUpAmount);
    if (isNaN(amount) || amount <= 0) {
      Alert.alert('Invalid Amount', 'Please enter a valid amount to add.');
      return;
    }

    setProcessing(true);
    try {
      const orderRes = await api.post('/wallet/topup/order', {
        amount: amount,
        payment_method: 'upi' 
      });

      if (orderRes.data.success) {
        const verifyRes = await api.post('/wallet/topup/verify', {
          order_id: orderRes.data.data.id,
          payment_id: 'sim_pay_' + Date.now(),
          status: 'success'
        });

        if (verifyRes.data.success) {
          Alert.alert('Success', `₹${amount} added to your wallet!`);
          setShowTopUp(false);
          setTopUpAmount('');
          fetchData();
        }
      }
    } catch (error: any) {
      Alert.alert('Payment Failed', error.response?.data?.message || 'Transaction could not be completed.');
    } finally {
      setProcessing(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  const renderTransaction = (item: Transaction) => {
    const isCredit = item.type === 'credit';
    const accentColor = isCredit ? '#10B981' : '#EF4444';
    const bgSoft = isCredit ? (isDark ? 'rgba(16,185,129,0.15)' : '#ECFDF5') : (isDark ? 'rgba(239,68,68,0.15)' : '#FEF2F2');
    return (
      <View key={item.id} style={[styles.transactionItem, { borderBottomColor: colors.border }]}>
        <View style={[styles.iconBox, { backgroundColor: bgSoft }]}>
          {isCredit ? (
            <ArrowDownLeft size={20} color={accentColor} strokeWidth={2.4} />
          ) : (
            <ArrowUpRight size={20} color={accentColor} strokeWidth={2.4} />
          )}
        </View>
        <View style={styles.transMain}>
          <Text style={[styles.transDesc, { color: colors.text }]}>{item.description}</Text>
          <Text style={[styles.transDate, { color: colors.textSecondary }]}>
            {new Date(item.created_at).toLocaleDateString('en-IN', {
              day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
            })}
          </Text>
        </View>
        <View style={styles.transRight}>
          <Text style={[styles.transAmount, { color: accentColor }]}>
            {isCredit ? '+' : '-'} ₹{parseFloat(item.amount).toLocaleString('en-IN')}
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 3 }}>
            <View style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: '#10B981' }} />
            <Text style={[styles.transStatus, { color: colors.textMuted }]}>Success</Text>
          </View>
        </View>
      </View>
    );
  };

  if (loading) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.brand} />
      </View>
    );
  }

  const totalSpent = transactions
    .filter((t) => t.type === 'debit')
    .reduce((sum, t) => sum + parseFloat(t.amount || '0'), 0);

  const totalRefunds = transactions
    .filter((t) => t.type === 'credit' && t.description?.toLowerCase().includes('refund'))
    .reduce((sum, t) => sum + parseFloat(t.amount || '0'), 0);

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} accessibilityLabel="Go back">
            <ArrowLeft size={22} color={colors.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.text }]}>Travel Wallet</Text>
          <TouchableOpacity style={styles.filterBtn} onPress={onRefresh} accessibilityLabel="Refresh wallet">
            <RotateCcw size={19} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView 
        style={styles.scroll}
        contentContainerStyle={{ paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.brand} colors={[colors.brand]} />}
      >
        {/* DriveLux Carbon Card */}
        <View style={[styles.balanceCard, { backgroundColor: isDark ? '#18181B' : '#0F172A', borderColor: isDark ? '#27272A' : '#1E293B' }, CardShadow]}>
          <View style={styles.cardTopRow}>
            <View>
              <Text style={styles.brandTag}>HAPPYMILES PAY</Text>
              <Text style={styles.balanceLabel}>Available Balance</Text>
            </View>
            <View style={styles.secureBadge}>
              <ShieldCheck size={14} color="#10B981" />
              <Text style={styles.secureText}>Active</Text>
            </View>
          </View>

          <View style={styles.balanceRow}>
            <Text style={styles.currency}>₹</Text>
            <Text style={styles.balanceValue}>{balance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</Text>
          </View>

          <TouchableOpacity 
            style={[styles.topUpBtn, { backgroundColor: colors.brand }]}
            onPress={() => setShowTopUp(true)}
            activeOpacity={0.88}
          >
            <Plus size={18} color="#fff" strokeWidth={2.8} />
            <Text style={styles.topUpText}>Top-up Funds</Text>
          </TouchableOpacity>
        </View>

        <Modal
          visible={showTopUp}
          transparent
          animationType="slide"
          onRequestClose={() => setShowTopUp(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
              <View style={styles.modalHeader}>
                <Text style={[styles.modalTitle, { color: colors.text }]}>Add Funds</Text>
                <TouchableOpacity onPress={() => setShowTopUp(false)} style={styles.closeBtn}>
                  <X size={20} color={colors.textSecondary} />
                </TouchableOpacity>
              </View>

              <View style={[styles.demoNotice, { backgroundColor: isDark ? 'rgba(37,99,235,0.15)' : '#EFF6FF', borderColor: isDark ? 'rgba(37,99,235,0.3)' : '#BFDBFE' }]}>
                <Text style={styles.demoNoticeTag}>DEMO MODE</Text>
                <Text style={[styles.demoNoticeText, { color: isDark ? '#93C5FD' : '#1E40AF' }]}>Top-ups simulate instant UPI verification.</Text>
              </View>
              
              <View style={[styles.amountInputContainer, { backgroundColor: isDark ? '#27272A' : '#F8FAFC', borderColor: colors.border }]}>
                <Text style={[styles.inputPrefix, { color: colors.text }]}>₹</Text>
                <TextInput
                  style={[styles.amountInput, { color: colors.text }]}
                  placeholder="0"
                  placeholderTextColor={colors.textMuted}
                  keyboardType="numeric"
                  value={topUpAmount}
                  onChangeText={setTopUpAmount}
                  autoFocus
                />
              </View>

              <View style={styles.quickAmounts}>
                {[500, 1000, 2000, 5000].map(amt => (
                  <TouchableOpacity 
                    key={amt} 
                    style={[styles.quickAmtBtn, { backgroundColor: isDark ? '#27272A' : '#F1F5F9', borderColor: colors.border }]}
                    onPress={() => setTopUpAmount(amt.toString())}
                  >
                    <Text style={[styles.quickAmtText, { color: colors.text }]}>+₹{amt}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <TouchableOpacity 
                style={[styles.proceedBtn, { backgroundColor: colors.brand }, processing && styles.disabledBtn]}
                onPress={handleTopUp}
                disabled={processing}
                activeOpacity={0.88}
              >
                {processing ? <ActivityIndicator color="#fff" /> : (
                  <Text style={styles.proceedText}>Confirm &amp; Add</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

        {/* Stats Row */}
        <View style={[styles.statsRow, { backgroundColor: colors.surface, borderColor: colors.border }, CardShadow]}>
          <View style={styles.statBox}>
            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Total Spent</Text>
            <Text style={[styles.statValue, { color: '#EF4444' }]}>₹{totalSpent.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</Text>
          </View>
          <View style={[styles.vLine, { backgroundColor: colors.border }]} />
          <View style={styles.statBox}>
            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Total Refunds</Text>
            <Text style={[styles.statValue, { color: '#10B981' }]}>₹{totalRefunds.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</Text>
          </View>
        </View>

        {/* Transactions Section */}
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Transaction History</Text>
          <TouchableOpacity onPress={onRefresh}>
            <Text style={[styles.viewAllText, { color: colors.brand }]}>Refresh</Text>
          </TouchableOpacity>
        </View>

        <View style={[styles.transactionsCard, { backgroundColor: colors.surface, borderColor: colors.border }, CardShadow]}>
          {transactions.length > 0 ? (
            transactions.map(renderTransaction)
          ) : (
            <View style={styles.emptyState}>
              <Wallet size={40} color={colors.textMuted} />
              <Text style={[styles.emptyText, { color: colors.textSecondary }]}>No transactions yet</Text>
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: {
    paddingTop: Platform.OS === 'ios' ? 12 : 44,
    borderBottomWidth: 1,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    justifyContent: 'space-between',
  },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 17, fontWeight: '800' },
  filterBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },

  scroll: { flex: 1 },
  balanceCard: {
    margin: Spacing.md,
    padding: 22,
    borderRadius: Radius.lg,
    borderWidth: 1,
  },
  cardTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  brandTag: { color: 'rgba(255,255,255,0.5)', fontSize: 10, fontWeight: '900', letterSpacing: 1.2 },
  balanceLabel: { color: '#9CA3AF', fontSize: 13, fontWeight: '700', marginTop: 3 },
  secureBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(16,185,129,0.18)', paddingHorizontal: 8, paddingVertical: 3, borderRadius: Radius.full },
  secureText: { color: '#10B981', fontSize: 10, fontWeight: '800' },
  balanceRow: { flexDirection: 'row', alignItems: 'baseline', marginTop: 16, marginBottom: 20 },
  currency: { color: '#fff', fontSize: 24, fontWeight: '900', marginRight: 4 },
  balanceValue: { color: '#fff', fontSize: 36, fontWeight: '900' },
  topUpBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: Radius.full,
    width: '100%',
    justifyContent: 'center',
  },
  topUpText: { color: '#fff', fontSize: 15, fontWeight: '800' },

  statsRow: {
    flexDirection: 'row',
    marginHorizontal: Spacing.md,
    padding: 16,
    borderRadius: Radius.lg,
    borderWidth: 1,
    alignItems: 'center',
    marginBottom: 20,
  },
  statBox: { flex: 1, alignItems: 'center' },
  statLabel: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', marginBottom: 4 },
  statValue: { fontSize: 16, fontWeight: '900' },
  vLine: { width: 1, height: 32 },

  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    marginBottom: 10,
  },
  sectionTitle: { ...Typography.heading },
  viewAllText: { fontSize: 13, fontWeight: '700' },

  transactionsCard: {
    marginHorizontal: Spacing.md,
    borderRadius: Radius.lg,
    borderWidth: 1,
    overflow: 'hidden',
  },
  transactionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    gap: 12,
  },
  iconBox: {
    width: 42,
    height: 42,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  transMain: { flex: 1 },
  transDesc: { fontSize: 14, fontWeight: '700' },
  transDate: { fontSize: 11, marginTop: 3 },
  transRight: { alignItems: 'flex-end' },
  transAmount: { fontSize: 14, fontWeight: '900' },
  transStatus: { fontSize: 10, fontWeight: '700' },

  emptyState: { alignItems: 'center', paddingVertical: 40, gap: 8 },
  emptyText: { fontSize: 14, fontWeight: '600' },

  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: Radius.sheet,
    borderTopRightRadius: Radius.sheet,
    padding: 24,
    paddingBottom: Platform.OS === 'ios' ? 44 : 28,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  demoNotice: {
    borderWidth: 1,
    borderRadius: Radius.md,
    padding: 12,
    marginBottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  demoNoticeTag: {
    backgroundColor: '#2563EB',
    color: '#ffffff',
    fontSize: 9,
    fontWeight: '900',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  demoNoticeText: {
    flex: 1,
    fontSize: 12,
    fontWeight: '600',
  },
  amountInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: Radius.full,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderWidth: 1,
    marginBottom: 20,
  },
  inputPrefix: {
    fontSize: 22,
    fontWeight: '900',
    marginRight: 8,
  },
  amountInput: {
    flex: 1,
    fontSize: 22,
    fontWeight: '900',
  },
  quickAmounts: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 26,
  },
  quickAmtBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: Radius.full,
    borderWidth: 1,
  },
  quickAmtText: {
    fontSize: 13,
    fontWeight: '800',
  },
  proceedBtn: {
    paddingVertical: 16,
    borderRadius: Radius.full,
    alignItems: 'center',
  },
  disabledBtn: {
    opacity: 0.6,
  },
  proceedText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '900',
  },
});
