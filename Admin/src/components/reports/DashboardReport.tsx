import { Document, Page, Text, View, StyleSheet, Image } from '@react-pdf/renderer';

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
    width: 120,
    height: 60,
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
  metaInfo: {
    fontSize: 10,
    color: '#000000',
    marginBottom: 20,
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
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 20,
  },
  card: {
    flex: 1,
    minWidth: '45%',
    padding: 15,
    backgroundColor: '#F8F9FA',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#EEEEEE',
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
  healthGrid: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 20,
  },
  healthCard: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    borderLeftWidth: 4,
    backgroundColor: '#F8F9FA',
  },
  critical: { borderLeftColor: '#EF4444' },
  warning: { borderLeftColor: '#F59E0B' },
  good: { borderLeftColor: '#10B981' },
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

interface DashboardReportProps {
  stats: any;
  selectedRange: number;
  logoUrl?: string;
}

const formatDate = (date: any) => {
  return new Date(date).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  });
};

export const DashboardReport = ({ stats, selectedRange, logoUrl }: DashboardReportProps) => {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.reportTitle}>Admin Dashboard Report</Text>
            <Text style={styles.metaInfo}>
              Analysis Period: {selectedRange} Days | Date: {formatDate(new Date())}
            </Text>
          </View>
          {logoUrl && <Image src={logoUrl} style={styles.logo} />}
        </View>

        {/* Global Stats */}
        <View style={styles.grid}>
          <View style={styles.card}>
            <Text style={styles.cardLabel}>Total Customers</Text>
            <Text style={styles.cardValue}>{stats?.customers || 0}</Text>
          </View>
          <View style={styles.card}>
            <Text style={styles.cardLabel}>Active Fleet</Text>
            <Text style={styles.cardValue}>{stats?.vehicles || 0}</Text>
          </View>
          <View style={styles.card}>
            <Text style={styles.cardLabel}>Operating Expenses</Text>
            <Text style={styles.cardValue}>₹{(stats?.totalExpenses || 0).toLocaleString('en-IN')}</Text>
          </View>
          <View style={styles.card}>
            <Text style={styles.cardLabel}>Support Tickets</Text>
            <Text style={styles.cardValue}>{stats?.supportTicketsOpen || 0} Open</Text>
          </View>
        </View>

        {/* Fleet Health */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Fleet Health Summary</Text>
          <View style={styles.healthGrid}>
            <View style={[styles.healthCard, styles.critical]}>
              <Text style={styles.cardLabel}>Critical</Text>
              <Text style={styles.cardValue}>{stats?.vehicleHealthDistribution?.critical || 0}</Text>
            </View>
            <View style={[styles.healthCard, styles.warning]}>
              <Text style={styles.cardLabel}>Warning</Text>
              <Text style={styles.cardValue}>{stats?.vehicleHealthDistribution?.warning || 0}</Text>
            </View>
            <View style={[styles.healthCard, styles.good]}>
              <Text style={styles.cardLabel}>Good</Text>
              <Text style={styles.cardValue}>{stats?.vehicleHealthDistribution?.good || 0}</Text>
            </View>
          </View>
        </View>

        {/* Cost Breakdown */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Operating Costs Breakdown</Text>
          <View style={styles.table}>
            <View style={[styles.tableRow, styles.tableHeader]}>
              <Text style={[styles.tableCell, styles.headerCell, { flex: 2 }]}>Expense Category</Text>
              <Text style={[styles.tableCell, styles.headerCell]}>Records</Text>
              <Text style={[styles.tableCell, styles.headerCell, { textAlign: 'right' }]}>Total Amount</Text>
            </View>
            {(stats?.expenseCategoryBreakdown || []).map((cat: any, i: number) => (
              <View key={i} style={styles.tableRow}>
                <Text style={[styles.tableCell, { flex: 2, fontWeight: 'bold' }]}>{cat.category}</Text>
                <Text style={styles.tableCell}>{cat.count}</Text>
                <Text style={[styles.tableCell, { textAlign: 'right' }]}>₹{cat.amount.toLocaleString('en-IN')}</Text>
              </View>
            ))}
          </View>
        </View>

        <Text style={styles.footer}>
          Generated by Gupio Admin Terminal • Confidential Operational Data
        </Text>
      </Page>
    </Document>
  );
};
