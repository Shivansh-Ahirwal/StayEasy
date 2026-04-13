import React, { forwardRef, useMemo } from 'react';
import DatePicker from 'react-datepicker';
import { registerLocale } from 'react-datepicker';
import { enGB } from 'date-fns/locale';
import {
  formatDateRangeLabel,
  parseDateInput,
  startOfToday,
  toDateInputValue,
} from '../utils/dateDefaults';

import 'react-datepicker/dist/react-datepicker.css';
import './DateRangePickerField.css';

registerLocale('en-GB', enGB);

const DateRangeTrigger = forwardRef(function DateRangeTrigger(
  { onClick, displayText, label, id },
  ref,
) {
  return (
    <button
      type="button"
      id={id}
      className="date-range-trigger"
      onClick={onClick}
      ref={ref}
      aria-label={label}
    >
      <span className="date-range-trigger__text">{displayText}</span>
    </button>
  );
});

/**
 * OYO-style range picker: two months, formatted "Fri, 10 Apr — Sat, 11 Apr".
 * Controlled via checkIn / checkOut strings (YYYY-MM-DD).
 */
export default function DateRangePickerField({
  checkIn,
  checkOut,
  onRangeChange,
  minDate = null,
  className = '',
  popperClassName = 'date-range-popper',
  triggerId = 'date-range-trigger',
}) {
  const startDate = useMemo(() => parseDateInput(checkIn), [checkIn]);
  const endDate = useMemo(() => parseDateInput(checkOut), [checkOut]);
  const floor = minDate ?? startOfToday();

  const handleChange = (update) => {
    if (!update) {
      onRangeChange({ checkIn: '', checkOut: '' });
      return;
    }
    const [start, end] = update;
    if (!start) {
      onRangeChange({ checkIn: '', checkOut: '' });
      return;
    }
    const ci = toDateInputValue(start);
    if (!end) {
      onRangeChange({ checkIn: ci, checkOut: '' });
      return;
    }
    onRangeChange({
      checkIn: ci,
      checkOut: toDateInputValue(end),
    });
  };

  const displayText = formatDateRangeLabel(checkIn, checkOut);

  return (
    <div className={`date-range-field ${className}`.trim()}>
      <DatePicker
        selectsRange
        startDate={startDate}
        endDate={endDate}
        onChange={handleChange}
        minDate={floor}
        monthsShown={2}
        shouldCloseOnSelect={false}
        locale="en-GB"
        popperClassName={popperClassName}
        popperPlacement="bottom-start"
        dateFormat="d MMM yyyy"
        customInput={
          <DateRangeTrigger
            id={triggerId}
            displayText={displayText}
            label={`Stay dates: ${displayText}`}
          />
        }
      />
    </div>
  );
}
