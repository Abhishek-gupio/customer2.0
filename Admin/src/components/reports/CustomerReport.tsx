import { Document, Page, Text, View, StyleSheet, Image } from '@react-pdf/renderer';

// Register a clean font (Inter is used in the web app)
// We'll use default fonts for now to avoid loading external assets, 
// but we can add Inter if needed. 

const styles = StyleSheet.create({
  page: {
    padding: 40,
    backgroundColor: '#FFFFFF',
    fontFamily: 'Helvetica',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#EEEEEE',
    paddingBottom: 15,
    marginBottom: 20,
  },
  logo: {
    width: 100,
    height: 50,
    objectFit: 'contain',
    flexShrink: 0,
  },
  reportTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    color: '#000000',
  },
  customerSection: {
    marginBottom: 30,
  },
  customerName: {
    fontSize: 24,
    fontWeight: 'extrabold',
    marginBottom: 10,
    color: '#000000',
  },
  metaGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 20,
  },
  metaItem: {
    flexDirection: 'column',
  },
  metaLabel: {
    fontSize: 8,
    fontWeight: 'bold',
    color: '#999999',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 2,
  },
  metaValue: {
    fontSize: 12,
    color: '#000000',
  },
  section: {
    marginBottom: 25,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: 'bold',
    textTransform: 'uppercase',
    letterSpacing: 1,
    color: '#000000',
    marginBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#EEEEEE',
    paddingBottom: 4,
  },
  summaryGrid: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 15,
  },
  summaryCard: {
    flex: 1,
    padding: 15,
    backgroundColor: '#F8F9FA',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#EEEEEE',
  },
  highlightCard: {
    backgroundColor: '#000000',
    borderColor: '#000000',
  },
  cardLabel: {
    fontSize: 7,
    fontWeight: 'bold',
    color: '#999999',
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  cardValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#000000',
  },
  whiteText: {
    color: '#FFFFFF',
  },
  table: {
    width: 'auto',
    borderWidth: 1,
    borderColor: '#EEEEEE',
    borderBottomWidth: 0,
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#EEEEEE',
    minHeight: 25,
    alignItems: 'center',
  },
  tableHeader: {
    backgroundColor: '#F8F9FA',
  },
  tableCell: {
    flex: 1,
    padding: 5,
    fontSize: 9,
    color: '#000000',
  },
  headerCell: {
    fontSize: 8,
    fontWeight: 'bold',
    color: '#999999',
    textTransform: 'uppercase',
  },
  badge: {
    paddingVertical: 2,
    paddingHorizontal: 4,
    borderRadius: 3,
    fontSize: 7,
    backgroundColor: '#EEEEEE',
    color: '#666666',
    textAlign: 'center',
  },
  footer: {
    position: 'absolute',
    bottom: 30,
    left: 40,
    right: 40,
    textAlign: 'center',
    fontSize: 8,
    color: '#CCCCCC',
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
    paddingTop: 10,
  },
});

interface CustomerPDFProps {
  customer: any;
  options?: {
    logoUrl?: string;
    showLogo?: boolean;
  };
}

const formatDate = (date: any) => {
  if (!date) return '—';
  return new Date(date).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  });
};

export const CustomerPDF = ({ customer, options }: CustomerPDFProps) => {
  const { vehicles = [], expenses = [], supportTickets = [], expenseSummary } = customer;
  const totalExpenses = expenseSummary?.total || 0;
  const currency = expenseSummary?.currency || 'INR';
  const breakdown = expenseSummary?.breakdown || {};
  const activeCategories = Object.entries(breakdown)
    .filter(([_, amount]) => (amount as number) > 0)
    .sort((a, b) => (b[1] as number) - (a[1] as number));

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          {options?.showLogo && options.logoUrl && (
            <Image src={options.logoUrl} style={styles.logo} />
          )}
          <Text style={styles.reportTitle}>Customer Insight Report</Text>
        </View>

        {/* Customer Info */}
        <View style={styles.customerSection}>
          <Text style={styles.customerName}>{customer.fullName || 'Unnamed Customer'}</Text>
          <View style={styles.metaGrid}>
            <View style={styles.metaItem}>
              <Text style={styles.metaLabel}>Phone Number</Text>
              <Text style={styles.metaValue}>{customer.phoneNumber || '—'}</Text>
            </View>
            <View style={styles.metaItem}>
              <Text style={styles.metaLabel}>Email Address</Text>
              <Text style={styles.metaValue}>{customer.email || '—'}</Text>
            </View>
            <View style={styles.metaItem}>
              <Text style={styles.metaLabel}>Joined On</Text>
              <Text style={styles.metaValue}>{formatDate(customer.createdAt)}</Text>
            </View>
            <View style={styles.metaItem}>
              <Text style={styles.metaLabel}>Report Date</Text>
              <Text style={styles.metaValue}>{formatDate(new Date())}</Text>
            </View>
          </View>
        </View>

        {/* Financial Overview */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Financial Overview</Text>
          <View style={styles.summaryGrid}>
            <View style={[styles.summaryCard, styles.highlightCard]}>
              <Text style={[styles.cardLabel, styles.whiteText]}>Total Expenditure</Text>
              <Text style={[styles.cardValue, styles.whiteText]}>
                {currency} {totalExpenses.toLocaleString('en-IN')}
              </Text>
            </View>
            {activeCategories.slice(0, 2).map(([cat, amt]) => (
              <View key={cat} style={styles.summaryCard}>
                <Text style={styles.cardLabel}>{cat.toUpperCase()} Expenses</Text>
                <Text style={styles.cardValue}>
                  {currency} {(amt as number).toLocaleString('en-IN')}
                </Text>
              </View>
            ))}
          </View>
        </View>

        {/* Vehicles Table */}
        {vehicles.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Vehicles ({vehicles.length})</Text>
            <View style={styles.table}>
              <View style={[styles.tableRow, styles.tableHeader]}>
                <Text style={[styles.tableCell, styles.headerCell]}>Make & Model</Text>
                <Text style={[styles.tableCell, styles.headerCell]}>Reg. Number</Text>
                <Text style={[styles.tableCell, styles.headerCell]}>Fuel Type</Text>
                <Text style={[styles.tableCell, styles.headerCell]}>Health</Text>
              </View>
              {vehicles.map((v: any, i: number) => (
                <View key={i} style={styles.tableRow}>
                  <Text style={styles.tableCell}>{v.make} {v.model}</Text>
                  <Text style={styles.tableCell}>{v.registrationNumber}</Text>
                  <Text style={styles.tableCell}>{v.fuelType || '—'}</Text>
                  <Text style={styles.tableCell}>{v.healthScore?.overallScore ? `${v.healthScore.overallScore}%` : 'N/A'}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Expenses Table */}
        {expenses.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Recent Expenses ({expenses.length})</Text>
            <View style={styles.table}>
              <View style={[styles.tableRow, styles.tableHeader]}>
                <Text style={[styles.tableCell, styles.headerCell]}>Date</Text>
                <Text style={[styles.tableCell, styles.headerCell]}>Category</Text>
                <Text style={[styles.tableCell, styles.headerCell, { flex: 1.5 }]}>Merchant/Notes</Text>
                <Text style={[styles.tableCell, styles.headerCell, { textAlign: 'right' }]}>Amount</Text>
              </View>
              {expenses.slice(0, 10).map((e: any, i: number) => (
                <View key={i} style={styles.tableRow}>
                  <Text style={styles.tableCell}>{formatDate(e.date)}</Text>
                  <View style={styles.tableCell}>
                    <Text style={styles.badge}>{e.category}</Text>
                  </View>
                  <Text style={[styles.tableCell, { flex: 1.5 }]}>{e.merchantName || e.description || '—'}</Text>
                  <Text style={[styles.tableCell, { textAlign: 'right', fontWeight: 'bold' }]}>
                    {currency} {e.amount.toLocaleString('en-IN')}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Support Tickets */}
        {supportTickets.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Assistance History ({supportTickets.length})</Text>
            <View style={styles.table}>
              <View style={[styles.tableRow, styles.tableHeader]}>
                <Text style={[styles.tableCell, styles.headerCell, { flex: 1.5 }]}>Subject</Text>
                <Text style={[styles.tableCell, styles.headerCell]}>Status</Text>
                <Text style={[styles.tableCell, styles.headerCell]}>Date</Text>
              </View>
              {supportTickets.slice(0, 5).map((t: any, i: number) => (
                <View key={i} style={styles.tableRow}>
                  <Text style={[styles.tableCell, { flex: 1.5 }]}>{t.subject}</Text>
                  <View style={styles.tableCell}>
                    <Text style={styles.badge}>{t.status}</Text>
                  </View>
                  <Text style={styles.tableCell}>{formatDate(t.createdAt)}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Footer */}
        <Text style={styles.footer}>
          Generated by Gupio Admin Panel • {new Date().getFullYear()} • Confidential Data
        </Text>
      </Page>
    </Document>
  );
};
