import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, Pressable } from 'react-native';
import { Calendar, Clock, ChevronLeft, ChevronRight } from 'lucide-react-native';
import {
  addDays,
  addMonths,
  differenceInDays,
  endOfMonth,
  endOfWeek,
  format,
  isBefore,
  isSameDay,
  isSameMonth,
  startOfMonth,
  startOfWeek,
  subMonths,
} from 'date-fns';
import { PlanningState } from '../tripPlannerTypes';

interface Props {
  planning: PlanningState;
  onChange: (partial: Partial<PlanningState>) => void;
}

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

const parseDateInput = (value: string): Date | null => {
  if (!DATE_REGEX.test(value)) return null;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  if (
    Number.isNaN(date.getTime()) ||
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }
  return date;
};

const toInputDate = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const WEEKDAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const getCalendarDays = (monthDate: Date) => {
  const monthStart = startOfMonth(monthDate);
  const monthEnd = endOfMonth(monthDate);
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });

  const days: Date[] = [];
  let current = calendarStart;
  while (current <= calendarEnd) {
    days.push(current);
    current = addDays(current, 1);
  }
  return days;
};

const DateSelector = ({ planning, onChange }: Props) => {
  const [pickerVisible, setPickerVisible] = useState(false);
  const [pickerType, setPickerType] = useState<'arrival' | 'departure'>('arrival');
  const [visibleMonth, setVisibleMonth] = useState<Date>(new Date());

  const handleDateChange = (dateStr: string, type: 'arrival' | 'departure') => {
    const newState: Partial<PlanningState> = {};
    if (type === 'arrival') newState.arrivalDate = dateStr;
    else newState.departureDate = dateStr;

    // Auto-calculate stayDays when both dates are valid.
    const arrival = type === 'arrival' ? dateStr : planning.arrivalDate;
    const departure = type === 'departure' ? dateStr : planning.departureDate;
    const d1 = arrival ? parseDateInput(arrival) : null;
    const d2 = departure ? parseDateInput(departure) : null;

    if (d1 && d2) {
      if (isBefore(d1, d2) || d1.getTime() === d2.getTime()) {
        newState.stayDays = Math.max(0, differenceInDays(d2, d1));
      } else {
        newState.stayDays = 0;
      }
    }

    onChange(newState);
  };

  const arrivalDate = planning.arrivalDate ? parseDateInput(planning.arrivalDate) : null;
  const departureDate = planning.departureDate ? parseDateInput(planning.departureDate) : null;

  const openPicker = (type: 'arrival' | 'departure') => {
    setPickerType(type);
    const current = type === 'arrival' ? arrivalDate : departureDate;
    setVisibleMonth(current || new Date());
    setPickerVisible(true);
  };

  const selectedDate = pickerType === 'arrival' ? arrivalDate : departureDate;
  const calendarDays = useMemo(() => getCalendarDays(visibleMonth), [visibleMonth]);

  const handleSelectCalendarDate = (date: Date) => {
    handleDateChange(toInputDate(date), pickerType);
    setPickerVisible(false);
  };

  let dateError: string | null = null;

  if (planning.arrivalDate && !arrivalDate) {
    dateError = 'Arrival date must be in YYYY-MM-DD format.';
  } else if (planning.departureDate && !departureDate) {
    dateError = 'Departure date must be in YYYY-MM-DD format.';
  } else if (arrivalDate && departureDate && isBefore(departureDate, arrivalDate)) {
    dateError = 'Departure date cannot be earlier than arrival date.';
  }

  return (
    <View style={styles.container}>
      <Text style={styles.label}>Arrival Date</Text>
      <TouchableOpacity style={styles.inputWrapper} onPress={() => openPicker('arrival')} activeOpacity={0.85}>
        <Calendar size={18} color="#FFD700" />
        <Text style={[styles.dateText, !planning.arrivalDate && styles.dateTextPlaceholder]}>
          {planning.arrivalDate || 'Tap to select arrival date'}
        </Text>
      </TouchableOpacity>

      <Text style={[styles.label, { marginTop: 20 }]}>Departure Date</Text>
      <TouchableOpacity style={styles.inputWrapper} onPress={() => openPicker('departure')} activeOpacity={0.85}>
        <Calendar size={18} color="#FFD700" />
        <Text style={[styles.dateText, !planning.departureDate && styles.dateTextPlaceholder]}>
          {planning.departureDate || 'Tap to select departure date'}
        </Text>
      </TouchableOpacity>

      {dateError && <Text style={styles.errorText}>{dateError}</Text>}

      {!dateError && arrivalDate && departureDate && (
        <View style={styles.infoBox}>
          <Clock size={16} color="#FFD700" />
          <Text style={styles.infoText}>
            {planning.stayDays > 0 ? `Duration: ${planning.stayDays} Days Stay` : 'Same-day trip'}
          </Text>
        </View>
      )}

      <Modal visible={pickerVisible} transparent animationType="fade" onRequestClose={() => setPickerVisible(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setPickerVisible(false)}>
          <Pressable style={styles.calendarModal} onPress={(event) => event.stopPropagation()}>
            <View style={styles.calendarHeader}>
              <TouchableOpacity style={styles.navBtn} onPress={() => setVisibleMonth((prev) => subMonths(prev, 1))}>
                <ChevronLeft size={18} color="#FFF" />
              </TouchableOpacity>
              <Text style={styles.monthTitle}>{format(visibleMonth, 'MMMM yyyy')}</Text>
              <TouchableOpacity style={styles.navBtn} onPress={() => setVisibleMonth((prev) => addMonths(prev, 1))}>
                <ChevronRight size={18} color="#FFF" />
              </TouchableOpacity>
            </View>

            <View style={styles.weekRow}>
              {WEEKDAY_LABELS.map((day) => (
                <Text key={day} style={styles.weekLabel}>{day}</Text>
              ))}
            </View>

            <View style={styles.daysGrid}>
              {calendarDays.map((day) => {
                const inMonth = isSameMonth(day, visibleMonth);
                const isSelected = selectedDate ? isSameDay(day, selectedDate) : false;
                return (
                  <TouchableOpacity
                    key={day.toISOString()}
                    style={[
                      styles.dayCell,
                      !inMonth && styles.dayCellOutsideMonth,
                      isSelected && styles.dayCellSelected,
                    ]}
                    onPress={() => handleSelectCalendarDate(day)}
                  >
                    <Text
                      style={[
                        styles.dayText,
                        !inMonth && styles.dayTextOutsideMonth,
                        isSelected && styles.dayTextSelected,
                      ]}
                    >
                      {format(day, 'd')}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <TouchableOpacity style={styles.doneBtn} onPress={() => setPickerVisible(false)}>
              <Text style={styles.doneBtnText}>Done</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { padding: 10 },
  label: { color: '#888', fontSize: 12, fontWeight: 'bold', marginBottom: 8, textTransform: 'uppercase' },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#111',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#222',
    paddingHorizontal: 12,
    height: 54,
  },
  dateText: { flex: 1, color: '#FFF', marginLeft: 10, fontSize: 15, fontWeight: '600' },
  dateTextPlaceholder: { color: '#666', fontWeight: '500' },
  errorText: { color: '#ff8a80', fontSize: 12, marginTop: 10, lineHeight: 18 },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 215, 0, 0.1)',
    padding: 12,
    borderRadius: 8,
    marginTop: 20,
    gap: 8,
  },
  infoText: { color: '#FFD700', fontWeight: 'bold', fontSize: 14 },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  calendarModal: {
    backgroundColor: '#111',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#222',
    padding: 14,
  },
  calendarHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  navBtn: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1a1a1a',
    borderWidth: 1,
    borderColor: '#2a2a2a',
  },
  monthTitle: { color: '#FFF', fontSize: 16, fontWeight: '700' },
  weekRow: {
    flexDirection: 'row',
    marginBottom: 6,
  },
  weekLabel: {
    width: '14.28%',
    textAlign: 'center',
    color: '#777',
    fontSize: 11,
    fontWeight: '700',
  },
  daysGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 10,
  },
  dayCell: {
    width: '14.28%',
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
    marginBottom: 2,
  },
  dayCellOutsideMonth: {
    opacity: 0.35,
  },
  dayCellSelected: {
    backgroundColor: '#FFD700',
  },
  dayText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '600',
  },
  dayTextOutsideMonth: {
    color: '#666',
  },
  dayTextSelected: {
    color: '#000',
    fontWeight: '800',
  },
  doneBtn: {
    height: 44,
    borderRadius: 12,
    backgroundColor: '#FFD700',
    alignItems: 'center',
    justifyContent: 'center',
  },
  doneBtnText: {
    color: '#000',
    fontSize: 14,
    fontWeight: '800',
  },
});

export default DateSelector;
