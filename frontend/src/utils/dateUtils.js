// ============================================
// Date and Time Utilities
// ============================================

/**
 * Format date for display in various formats
 * @param {Date|string|number} date - Date to format
 * @param {string} format - Format type ('short', 'medium', 'long', 'time', 'datetime', 'relative')
 * @param {string} locale - Locale string (default: 'en-US')
 * @returns {string} Formatted date string
 */
export const formatDate = (date, format = 'medium', locale = 'en-US') => {
  if (!date) return 'N/A';
  
  const dateObj = new Date(date);
  if (isNaN(dateObj.getTime())) return 'Invalid Date';
  
  const options = {
    short: { month: 'short', day: 'numeric' },
    medium: { year: 'numeric', month: 'short', day: 'numeric' },
    long: { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    },
    time: { 
      hour: '2-digit', 
      minute: '2-digit',
      hour12: true 
    },
    datetime: { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric',
      hour: '2-digit', 
      minute: '2-digit',
      hour12: true 
    },
    iso: null // Special case for ISO string
  };
  
  if (format === 'iso') {
    return dateObj.toISOString();
  }
  
  if (format === 'relative') {
    return formatRelativeTime(dateObj);
  }
  
  const formatOptions = options[format] || options.medium;
  return dateObj.toLocaleDateString(locale, formatOptions);
};

/**
 * Format relative time (e.g., "2 hours ago", "in 5 minutes")
 * @param {Date|string|number} date - Date to compare
 * @param {Date} baseDate - Base date for comparison (default: now)
 * @returns {string} Relative time string
 */
export const formatRelativeTime = (date, baseDate = new Date()) => {
  if (!date) return 'Unknown';
  
  const dateObj = new Date(date);
  const base = new Date(baseDate);
  
  if (isNaN(dateObj.getTime()) || isNaN(base.getTime())) {
    return 'Invalid Date';
  }
  
  const diffMs = dateObj - base;
  const absMs = Math.abs(diffMs);
  const isPast = diffMs < 0;
  
  const units = [
    { name: 'year', ms: 365 * 24 * 60 * 60 * 1000 },
    { name: 'month', ms: 30 * 24 * 60 * 60 * 1000 },
    { name: 'week', ms: 7 * 24 * 60 * 60 * 1000 },
    { name: 'day', ms: 24 * 60 * 60 * 1000 },
    { name: 'hour', ms: 60 * 60 * 1000 },
    { name: 'minute', ms: 60 * 1000 },
    { name: 'second', ms: 1000 }
  ];
  
  for (const unit of units) {
    const value = Math.floor(absMs / unit.ms);
    if (value >= 1) {
      const plural = value !== 1 ? 's' : '';
      return isPast 
        ? `${value} ${unit.name}${plural} ago`
        : `in ${value} ${unit.name}${plural}`;
    }
  }
  
  return 'just now';
};

/**
 * Calculate duration between two dates
 * @param {Date|string} startDate - Start date
 * @param {Date|string} endDate - End date
 * @returns {Object} Duration breakdown
 */
export const calculateDuration = (startDate, endDate) => {
  const start = new Date(startDate);
  const end = new Date(endDate);
  
  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
    return { error: 'Invalid date(s)' };
  }
  
  const diffMs = Math.abs(end - start);
  
  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((diffMs % (1000 * 60)) / 1000);
  
  return {
    totalMs: diffMs,
    totalSeconds: Math.floor(diffMs / 1000),
    totalMinutes: Math.floor(diffMs / (1000 * 60)),
    totalHours: Math.floor(diffMs / (1000 * 60 * 60)),
    totalDays: Math.floor(diffMs / (1000 * 60 * 60 * 24)),
    days,
    hours,
    minutes,
    seconds,
    formatted: formatDuration({ days, hours, minutes, seconds })
  };
};

/**
 * Format duration object into readable string
 * @param {Object} duration - Duration object with days, hours, minutes, seconds
 * @param {boolean} short - Use short format (default: false)
 * @returns {string} Formatted duration string
 */
export const formatDuration = (duration, short = false) => {
  const { days = 0, hours = 0, minutes = 0, seconds = 0 } = duration;
  const parts = [];
  
  if (days > 0) {
    parts.push(short ? `${days}d` : `${days} day${days !== 1 ? 's' : ''}`);
  }
  if (hours > 0) {
    parts.push(short ? `${hours}h` : `${hours} hour${hours !== 1 ? 's' : ''}`);
  }
  if (minutes > 0) {
    parts.push(short ? `${minutes}m` : `${minutes} minute${minutes !== 1 ? 's' : ''}`);
  }
  if (seconds > 0 && days === 0) { // Don't show seconds if days are present
    parts.push(short ? `${seconds}s` : `${seconds} second${seconds !== 1 ? 's' : ''}`);
  }
  
  if (parts.length === 0) {
    return short ? '0s' : '0 seconds';
  }
  
  return parts.join(short ? ' ' : ', ');
};

/**
 * Calculate next lottery drawing time based on schedule
 * @param {string} scheduleType - Type of schedule ('daily', 'weekly', 'monthly')
 * @param {string} scheduleTime - Time specification (e.g., '20:00', 'sunday_18:00')
 * @param {Date} fromDate - Base date to calculate from (default: now)
 * @returns {Date} Next scheduled drawing time
 */
export const calculateNextDrawTime = (scheduleType, scheduleTime, fromDate = new Date()) => {
  const now = new Date(fromDate);
  const drawTime = new Date(now);
  
  switch (scheduleType) {
    case 'daily':
      if (scheduleTime.includes(':')) {
        const [hours, minutes] = scheduleTime.split(':').map(Number);
        drawTime.setHours(hours, minutes, 0, 0);
        
        // If time has passed today, move to tomorrow
        if (drawTime <= now) {
          drawTime.setDate(drawTime.getDate() + 1);
        }
      }
      break;
      
    case 'weekly':
      if (scheduleTime.includes('_')) {
        const [dayName, time] = scheduleTime.split('_');
        const [hours, minutes] = time.split(':').map(Number);
        
        const targetDay = getDayOfWeek(dayName);
        const currentDay = drawTime.getDay();
        
        let daysUntilTarget = (targetDay - currentDay + 7) % 7;
        if (daysUntilTarget === 0 && drawTime.getHours() * 60 + drawTime.getMinutes() >= hours * 60 + minutes) {
          daysUntilTarget = 7; // Move to next week
        }
        
        drawTime.setDate(drawTime.getDate() + daysUntilTarget);
        drawTime.setHours(hours, minutes, 0, 0);
      }
      break;
      
    case 'monthly':
      if (scheduleTime === 'last_day_21:00') {
        // Set to last day of current month
        drawTime.setMonth(drawTime.getMonth() + 1, 0);
        drawTime.setHours(21, 0, 0, 0);
        
        // If we've passed this month's draw, move to next month
        if (drawTime <= now) {
          drawTime.setMonth(drawTime.getMonth() + 2, 0);
          drawTime.setHours(21, 0, 0, 0);
        }
      } else if (scheduleTime.includes(':')) {
        // First day of next month
        const [hours, minutes] = scheduleTime.split(':').map(Number);
        drawTime.setMonth(drawTime.getMonth() + 1, 1);
        drawTime.setHours(hours, minutes, 0, 0);
      }
      break;
      
    default:
      // Default to 24 hours from now
      drawTime.setHours(drawTime.getHours() + 24);
  }
  
  return drawTime;
};

/**
 * Get day of week number from day name
 * @param {string} dayName - Day name (e.g., 'sunday', 'monday')
 * @returns {number} Day number (0 = Sunday, 1 = Monday, etc.)
 */
const getDayOfWeek = (dayName) => {
  const days = {
    sunday: 0, monday: 1, tuesday: 2, wednesday: 3,
    thursday: 4, friday: 5, saturday: 6
  };
  return days[dayName.toLowerCase()] || 0;
};

/**
 * Check if date is within business hours
 * @param {Date} date - Date to check
 * @param {Object} businessHours - Business hours configuration
 * @returns {boolean} True if within business hours
 */
export const isWithinBusinessHours = (date = new Date(), businessHours = {}) => {
  const {
    startHour = 9,
    endHour = 17,
    workDays = [1, 2, 3, 4, 5], // Monday to Friday
    timezone = Intl.DateTimeFormat().resolvedOptions().timeZone
  } = businessHours;
  
  const checkDate = new Date(date);
  const dayOfWeek = checkDate.getDay();
  const hour = checkDate.getHours();
  
  const isWorkDay = workDays.includes(dayOfWeek);
  const isWorkHour = hour >= startHour && hour < endHour;
  
  return isWorkDay && isWorkHour;
};

/**
 * Generate date range array
 * @param {Date|string} startDate - Start date
 * @param {Date|string} endDate - End date
 * @param {string} interval - Interval ('day', 'week', 'month')
 * @returns {Array} Array of dates
 */
export const generateDateRange = (startDate, endDate, interval = 'day') => {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const dates = [];
  
  if (start > end) return dates;
  
  const current = new Date(start);
  
  while (current <= end) {
    dates.push(new Date(current));
    
    switch (interval) {
      case 'day':
        current.setDate(current.getDate() + 1);
        break;
      case 'week':
        current.setDate(current.getDate() + 7);
        break;
      case 'month':
        current.setMonth(current.getMonth() + 1);
        break;
      default:
        current.setDate(current.getDate() + 1);
    }
  }
  
  return dates;
};

/**
 * Get start and end of period (day, week, month, year)
 * @param {Date} date - Reference date
 * @param {string} period - Period type
 * @returns {Object} Start and end dates
 */
export const getPeriodBounds = (date = new Date(), period = 'day') => {
  const baseDate = new Date(date);
  let start, end;
  
  switch (period) {
    case 'day':
      start = new Date(baseDate);
      start.setHours(0, 0, 0, 0);
      end = new Date(baseDate);
      end.setHours(23, 59, 59, 999);
      break;
      
    case 'week':
      start = new Date(baseDate);
      start.setDate(baseDate.getDate() - baseDate.getDay());
      start.setHours(0, 0, 0, 0);
      end = new Date(start);
      end.setDate(start.getDate() + 6);
      end.setHours(23, 59, 59, 999);
      break;
      
    case 'month':
      start = new Date(baseDate.getFullYear(), baseDate.getMonth(), 1);
      end = new Date(baseDate.getFullYear(), baseDate.getMonth() + 1, 0);
      end.setHours(23, 59, 59, 999);
      break;
      
    case 'year':
      start = new Date(baseDate.getFullYear(), 0, 1);
      end = new Date(baseDate.getFullYear(), 11, 31);
      end.setHours(23, 59, 59, 999);
      break;
      
    default:
      start = end = new Date(baseDate);
  }
  
  return { start, end };
};

/**
 * Format countdown timer
 * @param {number} totalSeconds - Total seconds remaining
 * @returns {Object} Formatted countdown object
 */
export const formatCountdown = (totalSeconds) => {
  if (totalSeconds <= 0) {
    return {
      expired: true,
      days: 0,
      hours: 0,
      minutes: 0,
      seconds: 0,
      formatted: '00:00:00',
      display: 'Expired'
    };
  }
  
  const days = Math.floor(totalSeconds / (24 * 60 * 60));
  const hours = Math.floor((totalSeconds % (24 * 60 * 60)) / (60 * 60));
  const minutes = Math.floor((totalSeconds % (60 * 60)) / 60);
  const seconds = totalSeconds % 60;
  
  const pad = (num) => num.toString().padStart(2, '0');
  
  let formatted, display;
  
  if (days > 0) {
    formatted = `${days}:${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
    display = `${days}d ${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
  } else {
    formatted = `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
    display = formatted;
  }
  
  return {
    expired: false,
    days,
    hours,
    minutes,
    seconds,
    formatted,
    display,
    totalSeconds
  };
};

/**
 * Check if date is valid
 * @param {any} date - Date to validate
 * @returns {boolean} True if valid date
 */
export const isValidDate = (date) => {
  if (!date) return false;
  const dateObj = new Date(date);
  return !isNaN(dateObj.getTime());
};

/**
 * Convert timezone
 * @param {Date|string} date - Date to convert
 * @param {string} fromTimezone - Source timezone
 * @param {string} toTimezone - Target timezone
 * @returns {Date} Converted date
 */
export const convertTimezone = (date, fromTimezone, toTimezone) => {
  if (!isValidDate(date)) return null;
  
  const dateObj = new Date(date);
  
  // Create formatter for the target timezone
  const formatter = new Intl.DateTimeFormat('en', {
    timeZone: toTimezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });
  
  const parts = formatter.formatToParts(dateObj);
  const partsObj = parts.reduce((acc, part) => {
    acc[part.type] = part.value;
    return acc;
  }, {});
  
  return new Date(
    `${partsObj.year}-${partsObj.month}-${partsObj.day}T${partsObj.hour}:${partsObj.minute}:${partsObj.second}`
  );
};

/**
 * Get user's timezone
 * @returns {string} User's timezone
 */
export const getUserTimezone = () => {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
};

/**
 * Parse various date formats
 * @param {string} dateString - Date string to parse
 * @returns {Date|null} Parsed date or null if invalid
 */
export const parseDate = (dateString) => {
  if (!dateString || typeof dateString !== 'string') return null;
  
  // Try different date formats
  const formats = [
    // ISO formats
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z?$/,
    /^\d{4}-\d{2}-\d{2}$/,
    // US formats
    /^\d{1,2}\/\d{1,2}\/\d{4}$/,
    /^\d{1,2}-\d{1,2}-\d{4}$/,
    // European formats
    /^\d{1,2}\.\d{1,2}\.\d{4}$/,
  ];
  
  // Try parsing with Date constructor first
  let date = new Date(dateString);
  if (!isNaN(date.getTime())) {
    return date;
  }
  
  // Try manual parsing for specific formats
  if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(dateString)) {
    const [month, day, year] = dateString.split('/').map(Number);
    date = new Date(year, month - 1, day);
    if (!isNaN(date.getTime())) return date;
  }
  
  return null;
};

export default {
  formatDate,
  formatRelativeTime,
  calculateDuration,
  formatDuration,
  calculateNextDrawTime,
  isWithinBusinessHours,
  generateDateRange,
  getPeriodBounds,
  formatCountdown,
  isValidDate,
  convertTimezone,
  getUserTimezone,
  parseDate
};
