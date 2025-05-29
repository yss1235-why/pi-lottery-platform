// ============================================
// Value Formatting Utilities
// ============================================

/**
 * Format Pi cryptocurrency amounts
 * @param {number} amount - Amount to format
 * @param {Object} options - Formatting options
 * @returns {string} Formatted Pi amount
 */
export const formatPiAmount = (amount, options = {}) => {
  const {
    decimals = 4,
    showSymbol = true,
    showPlusSign = false,
    compact = false,
    locale = 'en-US'
  } = options;

  if (amount === null || amount === undefined || isNaN(amount)) {
    return showSymbol ? '0 π' : '0';
  }

  const numAmount = parseFloat(amount);
  let formatted;

  if (compact && Math.abs(numAmount) >= 1000) {
    formatted = formatCompactNumber(numAmount, decimals);
  } else {
    formatted = numAmount.toLocaleString(locale, {
      minimumFractionDigits: 0,
      maximumFractionDigits: decimals
    });
  }

  if (showPlusSign && numAmount > 0) {
    formatted = '+' + formatted;
  }

  return showSymbol ? `${formatted} π` : formatted;
};

/**
 * Format currency amounts in various formats
 * @param {number} amount - Amount to format
 * @param {string} currency - Currency code (USD, EUR, etc.)
 * @param {Object} options - Formatting options
 * @returns {string} Formatted currency amount
 */
export const formatCurrency = (amount, currency = 'USD', options = {}) => {
  const {
    decimals = 2,
    showSymbol = true,
    compact = false,
    locale = 'en-US'
  } = options;

  if (amount === null || amount === undefined || isNaN(amount)) {
    return '$0.00';
  }

  const numAmount = parseFloat(amount);

  if (compact && Math.abs(numAmount) >= 1000) {
    const compactValue = formatCompactNumber(numAmount, decimals);
    return showSymbol ? `$${compactValue}` : compactValue;
  }

  return new Intl.NumberFormat(locale, {
    style: showSymbol ? 'currency' : 'decimal',
    currency: currency,
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  }).format(numAmount);
};

/**
 * Format numbers in compact notation (K, M, B, T)
 * @param {number} number - Number to format
 * @param {number} decimals - Number of decimal places
 * @returns {string} Compact formatted number
 */
export const formatCompactNumber = (number, decimals = 1) => {
  if (number === null || number === undefined || isNaN(number)) {
    return '0';
  }

  const num = parseFloat(number);
  const absNum = Math.abs(num);
  
  const units = [
    { value: 1e12, suffix: 'T' },
    { value: 1e9, suffix: 'B' },
    { value: 1e6, suffix: 'M' },
    { value: 1e3, suffix: 'K' }
  ];

  for (const unit of units) {
    if (absNum >= unit.value) {
      const formatted = (num / unit.value).toFixed(decimals);
      return `${formatted}${unit.suffix}`;
    }
  }

  return num.toFixed(decimals);
};

/**
 * Format percentages
 * @param {number} value - Value to format as percentage
 * @param {Object} options - Formatting options
 * @returns {string} Formatted percentage
 */
export const formatPercentage = (value, options = {}) => {
  const {
    decimals = 1,
    showSign = false,
    showSymbol = true,
    locale = 'en-US'
  } = options;

  if (value === null || value === undefined || isNaN(value)) {
    return showSymbol ? '0%' : '0';
  }

  const numValue = parseFloat(value);
  const formatted = numValue.toLocaleString(locale, {
    minimumFractionDigits: 0,
    maximumFractionDigits: decimals
  });

  let result = formatted;
  if (showSign && numValue > 0) {
    result = '+' + result;
  }
  if (showSymbol) {
    result += '%';
  }

  return result;
};

/**
 * Format large numbers with appropriate units
 * @param {number} number - Number to format
 * @param {Object} options - Formatting options
 * @returns {string} Formatted number with units
 */
export const formatNumber = (number, options = {}) => {
  const {
    decimals = 0,
    compact = false,
    locale = 'en-US',
    notation = 'standard'
  } = options;

  if (number === null || number === undefined || isNaN(number)) {
    return '0';
  }

  const numValue = parseFloat(number);

  if (compact) {
    return formatCompactNumber(numValue, decimals);
  }

  return numValue.toLocaleString(locale, {
    notation,
    minimumFractionDigits: 0,
    maximumFractionDigits: decimals
  });
};

/**
 * Format time duration in human-readable format
 * @param {number} seconds - Duration in seconds
 * @param {Object} options - Formatting options
 * @returns {string} Formatted duration
 */
export const formatDuration = (seconds, options = {}) => {
  const {
    short = false,
    precise = false,
    maxUnits = 2
  } = options;

  if (!seconds || seconds < 0) {
    return short ? '0s' : '0 seconds';
  }

  const units = [
    { name: 'year', short: 'y', seconds: 31536000 },
    { name: 'month', short: 'mo', seconds: 2592000 },
    { name: 'week', short: 'w', seconds: 604800 },
    { name: 'day', short: 'd', seconds: 86400 },
    { name: 'hour', short: 'h', seconds: 3600 },
    { name: 'minute', short: 'm', seconds: 60 },
    { name: 'second', short: 's', seconds: 1 }
  ];

  let remainingSeconds = Math.floor(seconds);
  const parts = [];

  for (const unit of units) {
    if (remainingSeconds >= unit.seconds) {
      const count = Math.floor(remainingSeconds / unit.seconds);
      remainingSeconds %= unit.seconds;

      if (short) {
        parts.push(`${count}${unit.short}`);
      } else {
        const unitName = count === 1 ? unit.name : `${unit.name}s`;
        parts.push(`${count} ${unitName}`);
      }

      if (parts.length >= maxUnits) break;
    }
  }

  if (parts.length === 0) {
    return short ? '0s' : '0 seconds';
  }

  return short ? parts.join(' ') : parts.join(', ');
};

/**
 * Format file sizes in human-readable format
 * @param {number} bytes - Size in bytes
 * @param {Object} options - Formatting options
 * @returns {string} Formatted file size
 */
export const formatFileSize = (bytes, options = {}) => {
  const {
    decimals = 2,
    binary = false
  } = options;

  if (bytes === 0) return '0 Bytes';

  const k = binary ? 1024 : 1000;
  const sizes = binary 
    ? ['Bytes', 'KiB', 'MiB', 'GiB', 'TiB', 'PiB']
    : ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB'];

  const i = Math.floor(Math.log(bytes) / Math.log(k));
  const value = bytes / Math.pow(k, i);

  return `${value.toFixed(decimals)} ${sizes[i]}`;
};

/**
 * Format addresses with ellipsis for display
 * @param {string} address - Address to format
 * @param {Object} options - Formatting options
 * @returns {string} Formatted address
 */
export const formatAddress = (address, options = {}) => {
  const {
    startChars = 6,
    endChars = 4,
    separator = '...'
  } = options;

  if (!address || typeof address !== 'string') {
    return '';
  }

  if (address.length <= startChars + endChars) {
    return address;
  }

  const start = address.substring(0, startChars);
  const end = address.substring(address.length - endChars);
  
  return `${start}${separator}${end}`;
};

/**
 * Format phone numbers
 * @param {string} phoneNumber - Phone number to format
 * @param {string} format - Format pattern
 * @returns {string} Formatted phone number
 */
export const formatPhoneNumber = (phoneNumber, format = 'US') => {
  if (!phoneNumber) return '';

  // Remove all non-digit characters
  const cleaned = phoneNumber.replace(/\D/g, '');

  switch (format) {
    case 'US':
      if (cleaned.length === 10) {
        return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
      } else if (cleaned.length === 11 && cleaned[0] === '1') {
        return `+1 (${cleaned.slice(1, 4)}) ${cleaned.slice(4, 7)}-${cleaned.slice(7)}`;
      }
      break;
    case 'INTERNATIONAL':
      return `+${cleaned}`;
    default:
      return cleaned;
  }

  return phoneNumber;
};

/**
 * Format social security or identification numbers
 * @param {string} ssn - SSN to format
 * @param {boolean} masked - Whether to mask digits
 * @returns {string} Formatted SSN
 */
export const formatSSN = (ssn, masked = false) => {
  if (!ssn) return '';

  const cleaned = ssn.replace(/\D/g, '');
  
  if (cleaned.length === 9) {
    if (masked) {
      return `XXX-XX-${cleaned.slice(5)}`;
    }
    return `${cleaned.slice(0, 3)}-${cleaned.slice(3, 5)}-${cleaned.slice(5)}`;
  }

  return ssn;
};

/**
 * Format lottery ticket numbers
 * @param {string} ticketNumber - Ticket number to format
 * @param {string} format - Format pattern
 * @returns {string} Formatted ticket number
 */
export const formatTicketNumber = (ticketNumber, format = 'default') => {
  if (!ticketNumber) return '';

  switch (format) {
    case 'lottery':
      // Format as XXXX-XXXX-XXXX
      const cleaned = ticketNumber.replace(/\D/g, '');
      if (cleaned.length === 12) {
        return `${cleaned.slice(0, 4)}-${cleaned.slice(4, 8)}-${cleaned.slice(8)}`;
      }
      break;
    case 'short':
      // Show only last 4 digits
      return ticketNumber.slice(-4);
    default:
      return ticketNumber;
  }

  return ticketNumber;
};

/**
 * Format win/loss ratios
 * @param {number} wins - Number of wins
 * @param {number} losses - Number of losses
 * @param {Object} options - Formatting options
 * @returns {string} Formatted ratio
 */
export const formatRatio = (wins, losses, options = {}) => {
  const {
    separator = ':',
    simplify = true
  } = options;

  if (!wins && !losses) return `0${separator}0`;

  if (simplify) {
    const gcd = (a, b) => b === 0 ? a : gcd(b, a % b);
    const divisor = gcd(wins, losses);
    return `${wins / divisor}${separator}${losses / divisor}`;
  }

  return `${wins}${separator}${losses}`;
};

/**
 * Format odds (e.g., "1 in 1000")
 * @param {number} probability - Probability value (0-1)
 * @param {Object} options - Formatting options
 * @returns {string} Formatted odds
 */
export const formatOdds = (probability, options = {}) => {
  const {
    format = 'fractional', // 'fractional', 'decimal', 'percentage'
    precision = 0
  } = options;

  if (!probability || probability <= 0 || probability > 1) {
    return 'N/A';
  }

  switch (format) {
    case 'fractional':
      const odds = Math.round(1 / probability);
      return `1 in ${formatNumber(odds)}`;
    
    case 'decimal':
      return (1 / probability).toFixed(precision);
    
    case 'percentage':
      return formatPercentage(probability * 100, { decimals: precision });
    
    default:
      return `1 in ${Math.round(1 / probability)}`;
  }
};

/**
 * Format lottery draw schedule
 * @param {string} schedule - Schedule string
 * @param {Object} options - Formatting options
 * @returns {string} Formatted schedule
 */
export const formatSchedule = (schedule, options = {}) => {
  const { verbose = false } = options;

  if (!schedule) return 'Not scheduled';

  // Handle different schedule formats
  if (schedule.includes('daily')) {
    return verbose ? 'Every day' : 'Daily';
  }
  
  if (schedule.includes('weekly')) {
    return verbose ? 'Once per week' : 'Weekly';
  }
  
  if (schedule.includes('monthly')) {
    return verbose ? 'Once per month' : 'Monthly';
  }

  // Handle time-based schedules
  if (schedule.includes('_')) {
    const [day, time] = schedule.split('_');
    const dayFormatted = day.charAt(0).toUpperCase() + day.slice(1);
    const timeFormatted = formatTime(time);
    return verbose ? `Every ${dayFormatted} at ${timeFormatted}` : `${dayFormatted} ${timeFormatted}`;
  }

  return schedule;
};

/**
 * Format time (24-hour to 12-hour format)
 * @param {string} time - Time in HH:MM format
 * @returns {string} Formatted time
 */
export const formatTime = (time) => {
  if (!time || !time.includes(':')) return time;

  const [hours, minutes] = time.split(':').map(Number);
  const period = hours >= 12 ? 'PM' : 'AM';
  const displayHours = hours % 12 || 12;

  return `${displayHours}:${minutes.toString().padStart(2, '0')} ${period}`;
};

/**
 * Format status badges
 * @param {string} status - Status value
 * @param {Object} options - Formatting options
 * @returns {Object} Status formatting information
 */
export const formatStatus = (status, options = {}) => {
  const { capitalize = true } = options;
  
  const statusMap = {
    active: { color: 'green', text: 'Active' },
    inactive: { color: 'gray', text: 'Inactive' },
    pending: { color: 'yellow', text: 'Pending' },
    completed: { color: 'blue', text: 'Completed' },
    failed: { color: 'red', text: 'Failed' },
    cancelled: { color: 'red', text: 'Cancelled' },
    processing: { color: 'blue', text: 'Processing' },
    confirmed: { color: 'green', text: 'Confirmed' },
    transferred: { color: 'green', text: 'Transferred' }
  };

  const statusInfo = statusMap[status?.toLowerCase()] || { 
    color: 'gray', 
    text: status || 'Unknown' 
  };

  return {
    ...statusInfo,
    text: capitalize ? statusInfo.text : statusInfo.text.toLowerCase()
  };
};

/**
 * Format validation messages
 * @param {string} field - Field name
 * @param {string} rule - Validation rule that failed
 * @param {Object} params - Rule parameters
 * @returns {string} Formatted validation message
 */
export const formatValidationMessage = (field, rule, params = {}) => {
  const fieldName = field.replace(/([A-Z])/g, ' $1').toLowerCase().replace(/^./, str => str.toUpperCase());
  
  const messages = {
    required: `${fieldName} is required`,
    minLength: `${fieldName} must be at least ${params.min} characters`,
    maxLength: `${fieldName} must not exceed ${params.max} characters`,
    min: `${fieldName} must be at least ${params.min}`,
    max: `${fieldName} must not exceed ${params.max}`,
    email: `${fieldName} must be a valid email address`,
    url: `${fieldName} must be a valid URL`,
    pattern: `${fieldName} format is invalid`,
    numeric: `${fieldName} must be a number`,
    integer: `${fieldName} must be a whole number`,
    positive: `${fieldName} must be a positive number`,
    unique: `${fieldName} must be unique`,
    match: `${fieldName} must match ${params.field}`
  };

  return messages[rule] || `${fieldName} is invalid`;
};

export default {
  formatPiAmount,
  formatCurrency,
  formatCompactNumber,
  formatPercentage,
  formatNumber,
  formatDuration,
  formatFileSize,
  formatAddress,
  formatPhoneNumber,
  formatSSN,
  formatTicketNumber,
  formatRatio,
  formatOdds,
  formatSchedule,
  formatTime,
  formatStatus,
  formatValidationMessage
};
