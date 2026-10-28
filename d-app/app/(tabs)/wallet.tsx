import React, { useCallback, useState } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  TouchableOpacity, 
  ActivityIndicator, 
  RefreshControl,
  Alert,
  Modal,
  TextInput
} from 'react-native';
import { Wallet, ArrowUpRight, ArrowDownLeft, Landmark, PlusCircle, AlertCircle, X } from 'lucide-react-native';
import { router, useFocusEffect, type Href } from 'expo-router';
import api, { apiErrorMessage } from '../../src/lib/api';
import { useTheme } from '../../src/constants/theme';

interface Transaction {
  id: number;
  type: 'credit' | 'debit';
  amount: number;
  description: string;
  status: string;
  created_at: string;
}

export default function WalletScreen() {
  const { colors } = useTheme();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [wallet, setWallet] = useState<any>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [error, setError] = useState('');
  const [showTopUpModal, setShowTopUpModal] = useState(false);
  const [topUpAmount, setTopUpAmount] = useState('500');
  const [submittingTopUp, setSubmittingTopUp] = useState(false);
  const [pendingTopUp, setPendingTopUp] = useState<{ orderId: string; amount: number } | null>(null);
  const [topUpError, setTopUpError] = useState('');

  const fetchData = useCallback(async () => {
    setError('');
    try {
      const [walletRes, transRes] = await Promise.all([
        api.get('/wallet'),
        api.get('/wallet/transactions')
      ]);
      setWallet(walletRes.data.data);
      setTransactions(transRes.data.data.data || []);
    } catch (requestError) {
      setError(apiErrorMessage(requestError, 'Unable to load your wallet. Pull down or tap retry.'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => {
    void fetchData();
  }, [fetchData]));

  const onRefresh = () => {
    setRefreshing(true);
    void fetchData();
  };

  const handleWithdraw = () => {
    if (!wallet?.withdrawal_policy_configured) {
      Alert.alert('Withdrawals unavailable', 'The retained wallet balance policy has not been configured. Contact support.');
      return;
    }
    router.push('/withdrawal' as Href);
  };

  const handleTopUp = async () => {
    const numAmount = parseFloat(topUpAmount);
    if (isNaN(numAmount) || numAmount < 500) {
      Alert.alert('Invalid Amount', 'Minimum top-up amount is ₹500.');
      return;
    }

    if (submittingTopUp) return;
    setSubmittingTopUp(true);
    setTopUpError('');
    try {
      if (pendingTopUp) {
        const verifyRes = await api.post('/wallet/topup/verify', {
          razorpay_order_id: pendingTopUp.orderId,
          razorpay_payment_id: `pay_demo_${pendingTopUp.orderId}`,
          razorpay_signature: `sig_demo_${pendingTopUp.orderId}`,
        });
        if (!verifyRes.data.success) throw new Error(verifyRes.data.message || 'Could not verify payment.');
        setWallet((previous: Record<string, unknown> | null) => ({ ...previous, ...verifyRes.data.data.wallet }));
        setShowTopUpModal(false);
        setPendingTopUp(null);
        setTopUpAmount('500');
        await fetchData();
      } else {
        const orderRes = await api.post('/wallet/topup/order', { amount: numAmount });
        if (!orderRes.data.success) throw new Error(orderRes.data.message || 'Could not initiate top-up.');
        const orderData = orderRes.data.data;
        if (!orderData.is_simulation) {
          setTopUpError('Live payment checkout is not available in this app yet. Contact support to complete your top-up.');
          return;
        }
        setPendingTopUp({ orderId: orderData.order_id, amount: numAmount });
      }
    } catch (err) {
      setTopUpError(apiErrorMessage(err, 'Could not complete top-up. Please try again.'));
    } finally {
      setSubmittingTopUp(false);
    }
  };

  if (loading && !refreshing) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#0F766E" />
      </View>
    );
  }

  if (error && !wallet) {
    return (
      <View style={styles.centered}>
        <Wallet color="#be123c" size={34} />
        <Text accessibilityRole="alert" style={styles.errorTitle}>Wallet unavailable</Text>
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity accessibilityRole="button" style={styles.retryButton} onPress={() => void fetchData()}>
          <Text style={styles.retryText}>Try again</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { backgroundColor: colors.surface }]}>
        <Text style={[styles.eyebrow, { color: colors.brand }]}>YOUR EARNINGS</Text>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Wallet</Text>
      </View>

      <ScrollView 
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {error ? <Text accessibilityRole="alert" style={styles.inlineError}>{error}</Text> : null}

        {/* Balance Warning/Critical Alert */}
        {wallet && Number(wallet?.balance_minor ?? (Number(wallet?.balance || 0) * 100)) < 10000 ? (
          <View style={styles.criticalAlert}>
            <AlertCircle color="#dc2626" size={20} />
            <View style={{ flex: 1 }}>
              <Text style={styles.criticalAlertTitle}>Account Inactive (Balance Below ₹100)</Text>
              <Text style={styles.criticalAlertSubtitle}>
                Your wallet balance is ₹{(Number(wallet?.balance_minor ?? (Number(wallet?.balance || 0) * 100)) / 100).toFixed(2)}. You cannot pick rides until you top up at least ₹500.
              </Text>
            </View>
          </View>
        ) : wallet && (Number(wallet?.balance_minor ?? (Number(wallet?.balance || 0) * 100)) < 50000 || wallet?.needs_topup_warning) ? (
          <View style={styles.warningAlert}>
            <AlertCircle color="#d97706" size={20} />
            <View style={{ flex: 1 }}>
              <Text style={styles.warningAlertTitle}>Low Balance Warning (Below ₹500)</Text>
              <Text style={styles.warningAlertSubtitle}>
                Your balance is ₹{(Number(wallet?.balance_minor ?? (Number(wallet?.balance || 0) * 100)) / 100).toFixed(2)}. Top up soon to prevent being locked out when balance drops under ₹100.
              </Text>
            </View>
          </View>
        ) : null}

        <View style={styles.balanceCard}>
          <View style={styles.balanceHeader}>
             <Wallet color="rgba(255,255,255,0.8)" size={20} />
             <Text style={styles.balanceLabel}>Current Balance</Text>
             {Number(wallet?.balance_minor ?? (Number(wallet?.balance || 0) * 100)) < 10000 ? (
               <View style={styles.badgeCritical}>
                 <Text style={styles.badgeCriticalText}>Inactive (&lt; ₹100)</Text>
               </View>
             ) : Number(wallet?.balance_minor ?? (Number(wallet?.balance || 0) * 100)) < 50000 ? (
               <View style={styles.badgeWarning}>
                 <Text style={styles.badgeWarningText}>Low (&lt; ₹500)</Text>
               </View>
             ) : (
               <View style={styles.badgeActive}>
                 <Text style={styles.badgeActiveText}>Active</Text>
               </View>
             )}
          </View>
          <Text style={styles.balanceAmount}>₹{Number(wallet?.balance || 0).toFixed(2)}</Text>
          <Text style={styles.subLabel}>Withdrawable: ₹{(Number(wallet?.withdrawable_minor || 0) / 100).toFixed(2)}</Text>
          <Text style={styles.subLabel}>{wallet?.withdrawal_policy_configured ? `Retained balance: ₹${(Number(wallet.withdrawal_reserve_minor) / 100).toFixed(2)}` : 'Withdrawal policy awaiting configuration'}</Text>
          <View style={styles.balanceFooter}>
             <View>
               <Text style={styles.subLabel}>This Week</Text>
               <Text style={styles.subValue}>₹{Number(wallet?.weekly_earnings || 0).toFixed(2)}</Text>
             </View>
             <View style={styles.actionButtonsRow}>
               <TouchableOpacity accessibilityRole="button" style={styles.topUpBtn} onPress={() => { setPendingTopUp(null); setTopUpError(''); setShowTopUpModal(true); }}>
                 <PlusCircle color="#0F766E" size={16} />
                 <Text style={styles.topUpBtnText}>Top Up</Text>
               </TouchableOpacity>
               <TouchableOpacity accessibilityRole="button" style={styles.withdrawBtn} onPress={handleWithdraw}>
                 <Landmark color="#fff" size={16} />
                 <Text style={styles.withdrawText}>Withdraw</Text>
               </TouchableOpacity>
             </View>
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Recent Transactions</Text>
            <TouchableOpacity accessibilityRole="button" accessibilityLabel="Refresh wallet transactions" style={{ minHeight: 48, justifyContent: 'center' }} onPress={onRefresh}>
              <Text style={styles.seeAll}>Refresh</Text>
            </TouchableOpacity>
          </View>

          {transactions.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={[styles.emptyText, { color: colors.textSecondary }]}>No transactions found.</Text>
            </View>
          ) : (
            transactions.map((item) => (
              <View key={item.id} style={[styles.transactionItem, { backgroundColor: colors.surface }]}>
                <View style={[
                  styles.iconBox, 
                  { backgroundColor: item.type === 'credit' ? '#ecfdf5' : '#fef2f2' }
                ]}>
                  {item.type === 'credit' ? (
                    <ArrowDownLeft color="#10b981" size={20} />
                  ) : (
                    <ArrowUpRight color="#ef4444" size={20} />
                  )}
                </View>
                <View style={styles.transInfo}>
                  <Text style={[styles.transDesc, { color: colors.text }]}>{item.description}</Text>
                  <Text style={[styles.transDate, { color: colors.textSecondary }]}>{new Date(item.created_at).toLocaleDateString()}</Text>
                </View>
                <Text style={[
                  styles.transAmount,
                  { color: item.type === 'credit' ? '#10b981' : '#ef4444' }
                ]}>
                  {item.type === 'credit' ? '+' : '-'}₹{Number(item.amount).toFixed(2)}
                </Text>
              </View>
            ))
          )}
        </View>
      </ScrollView>

      {/* Top-up Modal */}
      <Modal
        visible={showTopUpModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowTopUpModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { backgroundColor: colors.surface }]}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={[styles.modalTitle, { color: colors.text }]}>Top Up Wallet</Text>
                <Text style={[styles.modalSubtitle, { color: colors.textSecondary }]}>Minimum top up: ₹500</Text>
              </View>
              <TouchableOpacity onPress={() => setShowTopUpModal(false)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <X color={colors.textSecondary} size={22} />
              </TouchableOpacity>
            </View>

            <View style={styles.rulesNotice}>
              <Text style={styles.rulesNoticeText}>
                Minimum top-up is ₹500. A minimum balance of ₹100 is required to remain active for ride dispatches.
              </Text>
            </View>

            <Text style={[styles.inputLabel, { color: colors.text }]}>Select Amount</Text>
            <View style={styles.presetRow}>
              {['500', '1000', '2000', '5000'].map((preset) => (
                <TouchableOpacity
                  key={preset}
                  style={[
                    styles.presetChip,
                    topUpAmount === preset && styles.presetChipActive
                  ]}
                  disabled={submittingTopUp}
                  onPress={() => { setTopUpAmount(preset); setPendingTopUp(null); }}
                >
                  <Text style={[
                    styles.presetChipText,
                    topUpAmount === preset && styles.presetChipTextActive
                  ]}>
                    ₹{preset}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={[styles.inputLabel, { color: colors.text, marginTop: 16 }]}>Or Enter Custom Amount (₹)</Text>
            <View style={styles.inputWrapper}>
              <Text style={styles.currencySymbol}>₹</Text>
              <TextInput
                style={[styles.amountInput, { color: colors.text }]}
                keyboardType="numeric"
                value={topUpAmount}
                editable={!submittingTopUp}
                onChangeText={value => { setTopUpAmount(value); setPendingTopUp(null); }}
                placeholder="500"
                placeholderTextColor="#94a3b8"
              />
            </View>

            {parseFloat(topUpAmount || '0') < 500 ? (
              <Text style={styles.amountWarningText}>Minimum top-up amount is ₹500</Text>
            ) : null}

            {pendingTopUp ? <Text style={[styles.rulesNoticeText, { marginTop: 12 }]}>Demo mode: confirm below to simulate a successful payment of ₹{pendingTopUp.amount.toFixed(2)}.</Text> : null}
            {topUpError ? <Text accessibilityRole="alert" style={styles.inlineError}>{topUpError}</Text> : null}
            <TouchableOpacity
              style={[
                styles.submitTopUpBtn,
                (parseFloat(topUpAmount || '0') < 500 || submittingTopUp) && styles.submitTopUpBtnDisabled
              ]}
              disabled={parseFloat(topUpAmount || '0') < 500 || submittingTopUp}
              onPress={handleTopUp}
            >
              {submittingTopUp ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.submitTopUpBtnText}>
                  {pendingTopUp ? 'Simulate Payment' : `Top Up ₹${topUpAmount || '0'}`}
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  errorTitle: { marginTop: 14, color: '#0f172a', fontSize: 19, fontWeight: '800' },
  errorText: { maxWidth: 320, marginTop: 7, color: '#64748b', fontSize: 14, lineHeight: 20, textAlign: 'center' },
  retryButton: { minWidth: 140, minHeight: 48, marginTop: 20, paddingHorizontal: 20, borderRadius: 14, backgroundColor: '#0f766e', alignItems: 'center', justifyContent: 'center' },
  retryText: { color: '#ffffff', fontSize: 14, fontWeight: '800' },
  inlineError: { marginBottom: 14, padding: 12, borderRadius: 12, backgroundColor: '#fff1f2', color: '#be123c', fontSize: 13, lineHeight: 19 },
  criticalAlert: {
    marginBottom: 16,
    padding: 14,
    borderRadius: 14,
    backgroundColor: '#fef2f2',
    borderWidth: 1,
    borderColor: '#fecaca',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  criticalAlertTitle: { fontSize: 14, fontWeight: '700', color: '#b91c1c' },
  criticalAlertSubtitle: { fontSize: 12, color: '#991b1b', marginTop: 2 },
  warningAlert: {
    marginBottom: 16,
    padding: 14,
    borderRadius: 14,
    backgroundColor: '#fffbeb',
    borderWidth: 1,
    borderColor: '#fde68a',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  warningAlertTitle: { fontSize: 14, fontWeight: '700', color: '#b45309' },
  warningAlertSubtitle: { fontSize: 12, color: '#92400e', marginTop: 2 },
  header: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 16 },
  eyebrow: { fontSize: 10, fontWeight: '900', letterSpacing: 1.2 },
  headerTitle: { fontSize: 28, fontWeight: '800', marginTop: 4 },
  scrollContent: { padding: 20, paddingTop: 4, paddingBottom: 36, width: '100%', maxWidth: 680, alignSelf: 'center' },
  balanceCard: {
    backgroundColor: '#173B35',
    borderRadius: 24,
    padding: 24,
    shadowColor: '#0F766E',
    shadowOpacity: 0.10,
    shadowRadius: 10,
    elevation: 3,
  },
  balanceHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  balanceLabel: { color: 'rgba(255,255,255,0.8)', fontSize: 14, fontWeight: '500', flex: 1 },
  badgeCritical: {
    backgroundColor: '#dc2626',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  badgeCriticalText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  badgeWarning: {
    backgroundColor: '#f59e0b',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  badgeWarningText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  badgeActive: {
    backgroundColor: 'rgba(255,255,255,0.25)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  badgeActiveText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  balanceAmount: { color: '#fff', fontSize: 36, fontWeight: '800', marginVertical: 12 },
  balanceFooter: { 
    gap: 18,
    marginTop: 8,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.2)'
  },
  subLabel: { color: '#CCE2DA', fontSize: 12 },
  subValue: { color: '#fff', fontSize: 16, fontWeight: '700', marginTop: 2 },
  actionButtonsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  topUpBtn: {
    flex: 1, minHeight: 48, justifyContent: 'center',
    backgroundColor: '#fff',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    gap: 6
  },
  topUpBtnText: { color: '#0F766E', fontWeight: '700', fontSize: 14 },
  withdrawBtn: {
    flex: 1, minHeight: 48, justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.2)',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    gap: 6
  },
  withdrawText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  section: { marginTop: 32 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: '#1e293b' },
  seeAll: { color: '#0F766E', fontSize: 14, fontWeight: '600' },
  transactionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 16,
    marginBottom: 12,
  },
  iconBox: { width: 44, height: 44, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  transInfo: { flex: 1, marginLeft: 12 },
  transDesc: { fontSize: 15, fontWeight: '600', color: '#334155' },
  transDate: { fontSize: 12, color: '#94a3b8', marginTop: 2 },
  transAmount: { maxWidth: '42%', marginLeft: 12, fontSize: 16, fontWeight: '700' },
  emptyState: { padding: 40, alignItems: 'center' },
  emptyText: { color: '#94a3b8', fontSize: 14 },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 40,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  modalTitle: { fontSize: 20, fontWeight: '800' },
  modalSubtitle: { fontSize: 13, marginTop: 2 },
  rulesNotice: {
    backgroundColor: '#eff6ff',
    borderColor: '#bfdbfe',
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginBottom: 18,
  },
  rulesNoticeText: { color: '#1e40af', fontSize: 12, lineHeight: 18 },
  inputLabel: { fontSize: 14, fontWeight: '700', marginBottom: 10 },
  presetRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 8,
  },
  presetChip: {
    minHeight: 48,
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  presetChipActive: {
    backgroundColor: '#0F766E',
    borderColor: '#115E59',
  },
  presetChipText: { fontSize: 14, fontWeight: '700', color: '#334155' },
  presetChipTextActive: { color: '#fff' },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 12,
    paddingHorizontal: 16,
    height: 52,
    marginBottom: 8,
  },
  currencySymbol: { fontSize: 20, fontWeight: '800', color: '#64748b', marginRight: 8 },
  amountInput: { flex: 1, fontSize: 18, fontWeight: '700' },
  amountWarningText: { color: '#dc2626', fontSize: 12, marginBottom: 12 },
  submitTopUpBtn: {
    backgroundColor: '#0F766E',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
  },
  submitTopUpBtnDisabled: {
    backgroundColor: '#94a3b8',
  },
  submitTopUpBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
});
