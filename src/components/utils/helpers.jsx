// Helper functions for common tasks

// Format a date as relative time (e.g., "5 minutes ago", "2 days ago")
export function getRelativeTimeString(dateInput, lang = 'en-US') {
  // Handle various date formats or null/undefined
  if (!dateInput) return '';
  
  let date;
  if (typeof dateInput === 'string') {
    // Try parsing the string date
    date = new Date(dateInput);
  } else if (dateInput instanceof Date) {
    date = dateInput;
  } else {
    return '';
  }
  
  // Check if the date is valid
  if (isNaN(date.getTime())) {
    return '';
  }
  
  // Time constants
  const SECOND = 1000;
  const MINUTE = 60 * SECOND;
  const HOUR = 60 * MINUTE;
  const DAY = 24 * HOUR;
  const WEEK = 7 * DAY;
  const MONTH = 30 * DAY;
  const YEAR = 365 * DAY;
  
  const now = new Date();
  const diff = now - date;
  
  // Use the Intl.RelativeTimeFormat API when available
  if (typeof Intl !== 'undefined' && Intl.RelativeTimeFormat) {
    try {
      const rtf = new Intl.RelativeTimeFormat(lang, { numeric: 'auto' });
      
      // Make sure values are finite and reasonable for the Intl API
      // Most browsers limit values to reasonable ranges (usually ±100,000)
      if (diff < MINUTE && diff >= 0) {
        const seconds = -Math.round(diff / SECOND);
        if (Math.abs(seconds) < 100000) return rtf.format(seconds, 'second');
      } else if (diff < HOUR && diff >= 0) {
        const minutes = -Math.round(diff / MINUTE);
        if (Math.abs(minutes) < 100000) return rtf.format(minutes, 'minute');
      } else if (diff < DAY && diff >= 0) {
        const hours = -Math.round(diff / HOUR);
        if (Math.abs(hours) < 10000) return rtf.format(hours, 'hour');
      } else if (diff < WEEK && diff >= 0) {
        const days = -Math.round(diff / DAY);
        if (Math.abs(days) < 1000) return rtf.format(days, 'day');
      } else if (diff < MONTH && diff >= 0) {
        const weeks = -Math.round(diff / WEEK);
        if (Math.abs(weeks) < 100) return rtf.format(weeks, 'week');
      } else if (diff < YEAR && diff >= 0) {
        const months = -Math.round(diff / MONTH);
        if (Math.abs(months) < 100) return rtf.format(months, 'month');
      } else if (diff >= 0) {
        const years = -Math.round(diff / YEAR);
        if (Math.abs(years) < 100) return rtf.format(years, 'year');
      }
    } catch (e) {
      console.error("Error formatting relative time:", e);
      // Fall through to the backup implementation
    }
  }
  
  // Fallback for browsers that don't support Intl.RelativeTimeFormat or for errors
  try {
    if (diff < 0) {
      return date.toLocaleDateString(lang);
    } else if (diff < MINUTE) {
      return 'just now';
    } else if (diff < HOUR) {
      const minutes = Math.floor(diff / MINUTE);
      return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
    } else if (diff < DAY) {
      const hours = Math.floor(diff / HOUR);
      return `${hours} hour${hours > 1 ? 's' : ''} ago`;
    } else if (diff < WEEK) {
      const days = Math.floor(diff / DAY);
      return `${days} day${days > 1 ? 's' : ''} ago`;
    } else if (diff < MONTH) {
      const weeks = Math.floor(diff / WEEK);
      return `${weeks} week${weeks > 1 ? 's' : ''} ago`;
    } else if (diff < YEAR) {
      const months = Math.floor(diff / MONTH);
      return `${months} month${months > 1 ? 's' : ''} ago`;
    } else {
      const years = Math.floor(diff / YEAR);
      return `${years} year${years > 1 ? 's' : ''} ago`;
    }
  } catch (e) {
    console.error("Error in fallback time formatting:", e);
    // If all else fails, just return a formatted date string
    try {
      return date.toLocaleDateString(lang);
    } catch (e) {
      return '';
    }
  }
}