// ============================================
// Lottery Calculations Utility
// ============================================

/**
 * Calculate prize distribution based on participants and lottery type
 * @param {number} participants - Number of participants
 * @param {string} lotteryTypeId - Lottery type identifier
 * @param {Object} lotteryConfig - Lottery configuration
 * @returns {Object} Prize distribution object
 */
export const calculatePrizeDistribution = (participants, lotteryTypeId, lotteryConfig = {}) => {
  const { entryFee = 1.0, platformFee = 0.1, adValue = 0.001 } = lotteryConfig;
  
  let prizePool;
  if (lotteryTypeId === 'daily_ads') {
    prizePool = participants * adValue;
  } else {
    prizePool = participants * (entryFee - platformFee);
  }

  if (participants <= 50) {
    return {
      first: prizePool * 0.6,
      second: prizePool * 0.25,
      third: prizePool * 0.15
    };
  } else if (participants <= 200) {
    return {
      first: prizePool * 0.5,
      second: prizePool * 0.25,
      third: prizePool * 0.15,
      fourth: prizePool * 0.06,
      fifth: prizePool * 0.04
    };
  } else {
    return {
      first: prizePool * 0.4,
      second: prizePool * 0.2,
      third: prizePool * 0.15,
      fourth: prizePool * 0.08,
      fifth: prizePool * 0.08,
      sixth: prizePool * 0.08,
      seventh: prizePool * 0.0225,
      eighth: prizePool * 0.0225,
      ninth: prizePool * 0.0225,
      tenth: prizePool * 0.0225
    };
  }
};

/**
 * Calculate total prize pool for a lottery
 * @param {number} participants - Number of participants
 * @param {Object} lotteryConfig - Lottery configuration
 * @returns {number} Total prize pool amount
 */
export const calculateTotalPrizePool = (participants, lotteryConfig) => {
  const { entryFee = 1.0, platformFee = 0.1, adValue = 0.001, lotteryTypeId } = lotteryConfig;
  
  if (lotteryTypeId === 'daily_ads') {
    return participants * adValue;
  }
  
  return participants * (entryFee - platformFee);
};

/**
 * Calculate platform revenue from a lottery
 * @param {number} participants - Number of participants
 * @param {Object} lotteryConfig - Lottery configuration
 * @returns {number} Platform revenue amount
 */
export const calculatePlatformRevenue = (participants, lotteryConfig) => {
  const { platformFee = 0.1, lotteryTypeId } = lotteryConfig;
  
  if (lotteryTypeId === 'daily_ads') {
    return 0; // No direct revenue from ad lotteries
  }
  
  return participants * platformFee;
};

/**
 * Calculate user's expected value for lottery entry
 * @param {number} participants - Number of participants
 * @param {Object} lotteryConfig - Lottery configuration
 * @param {number} userTickets - Number of user's tickets
 * @returns {number} Expected value
 */
export const calculateExpectedValue = (participants, lotteryConfig, userTickets = 1) => {
  const prizePool = calculateTotalPrizePool(participants, lotteryConfig);
  if (participants === 0) return 0;
  
  return (prizePool / participants) * userTickets;
};

/**
 * Calculate house edge percentage
 * @param {Object} lotteryConfig - Lottery configuration
 * @returns {number} House edge as percentage
 */
export const calculateHouseEdge = (lotteryConfig) => {
  const { entryFee = 1.0, platformFee = 0.1, lotteryTypeId } = lotteryConfig;
  
  if (lotteryTypeId === 'daily_ads') {
    return 0; // No house edge for ad lotteries
  }
  
  return (platformFee / entryFee) * 100;
};

/**
 * Calculate net prize after Pi Network transaction fees
 * @param {number} grossPrize - Gross prize amount
 * @param {number} transactionFee - Pi Network transaction fee (default 0.01)
 * @returns {number} Net prize amount
 */
export const calculateNetPrize = (grossPrize, transactionFee = 0.01) => {
  return Math.max(0, grossPrize - transactionFee);
};

/**
 * Calculate win probability for different positions
 * @param {number} participants - Number of participants
 * @param {number} userTickets - Number of user's tickets
 * @param {number} position - Prize position (1st, 2nd, etc.)
 * @returns {Object} Probability information
 */
export const calculateWinProbability = (participants, userTickets = 1, position = 1) => {
  if (participants === 0) {
    return { probability: 0, odds: 'N/A', percentage: 0 };
  }
  
  // Simple probability calculation (actual lottery might use more complex algorithms)
  const baseProbability = userTickets / participants;
  const percentage = baseProbability * 100;
  const odds = participants / userTickets;
  
  return {
    probability: baseProbability,
    percentage: percentage,
    odds: `1 in ${Math.round(odds)}`,
    exactOdds: odds
  };
};

/**
 * Calculate lottery statistics
 * @param {Array} lotteryHistory - Array of historical lottery data
 * @returns {Object} Statistical summary
 */
export const calculateLotteryStats = (lotteryHistory = []) => {
  if (lotteryHistory.length === 0) {
    return {
      totalLotteries: 0,
      totalParticipants: 0,
      totalPrizesAwarded: 0,
      averageParticipants: 0,
      averagePrizePool: 0,
      winDistribution: {}
    };
  }
  
  const totalLotteries = lotteryHistory.length;
  const totalParticipants = lotteryHistory.reduce((sum, lottery) => sum + lottery.participants, 0);
  const totalPrizesAwarded = lotteryHistory.reduce((sum, lottery) => sum + lottery.prizePool, 0);
  
  const averageParticipants = totalParticipants / totalLotteries;
  const averagePrizePool = totalPrizesAwarded / totalLotteries;
  
  // Calculate win distribution by position
  const winDistribution = {};
  lotteryHistory.forEach(lottery => {
    if (lottery.winners) {
      lottery.winners.forEach(winner => {
        const position = winner.position;
        winDistribution[position] = (winDistribution[position] || 0) + 1;
      });
    }
  });
  
  return {
    totalLotteries,
    totalParticipants,
    totalPrizesAwarded,
    averageParticipants: Math.round(averageParticipants * 100) / 100,
    averagePrizePool: Math.round(averagePrizePool * 10000) / 10000,
    winDistribution
  };
};

/**
 * Calculate user performance metrics
 * @param {Array} userEntries - User's lottery entry history
 * @param {Array} userWins - User's winning history
 * @returns {Object} User performance metrics
 */
export const calculateUserPerformance = (userEntries = [], userWins = []) => {
  const totalEntries = userEntries.length;
  const totalWins = userWins.length;
  const totalSpent = userEntries.reduce((sum, entry) => sum + (entry.amount || 0), 0);
  const totalWinnings = userWins.reduce((sum, win) => sum + (win.amount || 0), 0);
  
  const winRate = totalEntries > 0 ? totalWins / totalEntries : 0;
  const netProfit = totalWinnings - totalSpent;
  const roi = totalSpent > 0 ? ((totalWinnings - totalSpent) / totalSpent) * 100 : 0;
  const averageWin = totalWins > 0 ? totalWinnings / totalWins : 0;
  
  // Calculate longest winning/losing streaks
  let currentStreak = 0;
  let longestWinStreak = 0;
  let longestLoseStreak = 0;
  let currentWinStreak = 0;
  let currentLoseStreak = 0;
  
  userEntries.forEach(entry => {
    const won = userWins.some(win => win.entryId === entry.id);
    if (won) {
      currentWinStreak++;
      currentLoseStreak = 0;
      longestWinStreak = Math.max(longestWinStreak, currentWinStreak);
    } else {
      currentLoseStreak++;
      currentWinStreak = 0;
      longestLoseStreak = Math.max(longestLoseStreak, currentLoseStreak);
    }
  });
  
  return {
    totalEntries,
    totalWins,
    totalSpent: Math.round(totalSpent * 10000) / 10000,
    totalWinnings: Math.round(totalWinnings * 10000) / 10000,
    netProfit: Math.round(netProfit * 10000) / 10000,
    winRate: Math.round(winRate * 1000) / 10, // Percentage with 1 decimal
    roi: Math.round(roi * 100) / 100,
    averageWin: Math.round(averageWin * 10000) / 10000,
    longestWinStreak,
    longestLoseStreak
  };
};

/**
 * Calculate optimal entry strategy
 * @param {Object} lotteryData - Current lottery data
 * @param {Object} userProfile - User's profile and preferences
 * @returns {Object} Strategy recommendations
 */
export const calculateOptimalStrategy = (lotteryData, userProfile = {}) => {
  const { budget = 10, riskTolerance = 'medium', preferredLotteries = [] } = userProfile;
  const recommendations = [];
  
  Object.entries(lotteryData).forEach(([lotteryId, lottery]) => {
    const expectedValue = calculateExpectedValue(lottery.participants, {
      ...lottery,
      lotteryTypeId: lotteryId
    });
    
    const entryFee = lottery.entryFee || 0;
    const roi = entryFee > 0 ? (expectedValue / entryFee) * 100 : Infinity;
    
    recommendations.push({
      lotteryId,
      expectedValue,
      roi,
      entryFee,
      participants: lottery.participants,
      recommendation: roi > 90 ? 'highly_recommended' : roi > 70 ? 'recommended' : 'not_recommended'
    });
  });
  
  // Sort by ROI
  recommendations.sort((a, b) => b.roi - a.roi);
  
  const budgetAllocation = {};
  let remainingBudget = budget;
  
  recommendations.forEach(rec => {
    if (remainingBudget > 0 && rec.recommendation !== 'not_recommended') {
      const allocation = Math.min(remainingBudget, rec.entryFee * 3); // Max 3 tickets per lottery
      budgetAllocation[rec.lotteryId] = allocation;
      remainingBudget -= allocation;
    }
  });
  
  return {
    recommendations: recommendations.slice(0, 5), // Top 5 recommendations
    budgetAllocation,
    totalAllocated: budget - remainingBudget,
    efficiency: ((budget - remainingBudget) / budget) * 100
  };
};

/**
 * Calculate time until next drawing
 * @param {Date|string} drawTime - Scheduled draw time
 * @returns {Object} Time remaining information
 */
export const calculateTimeUntilDraw = (drawTime) => {
  if (!drawTime) return null;
  
  const now = new Date();
  const draw = drawTime instanceof Date ? drawTime : new Date(drawTime);
  const diff = draw - now;
  
  if (diff <= 0) {
    return {
      expired: true,
      message: 'Drawing in progress',
      totalSeconds: 0
    };
  }
  
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((diff % (1000 * 60)) / 1000);
  
  let message = '';
  if (days > 0) message += `${days}d `;
  if (hours > 0) message += `${hours}h `;
  if (minutes > 0) message += `${minutes}m`;
  if (days === 0 && hours === 0 && minutes === 0) message = `${seconds}s`;
  
  return {
    expired: false,
    days,
    hours,
    minutes,
    seconds,
    totalSeconds: Math.floor(diff / 1000),
    message: message.trim()
  };
};

/**
 * Validate lottery configuration
 * @param {Object} config - Lottery configuration to validate
 * @returns {Object} Validation result
 */
export const validateLotteryConfig = (config) => {
  const errors = [];
  const warnings = [];
  
  // Required fields
  if (!config.entryFee && config.lotteryTypeId !== 'daily_ads') {
    errors.push('Entry fee is required for paid lotteries');
  }
  
  if (!config.maxTicketsPerUser || config.maxTicketsPerUser < 1) {
    errors.push('Maximum tickets per user must be at least 1');
  }
  
  if (!config.minParticipants || config.minParticipants < 2) {
    errors.push('Minimum participants must be at least 2');
  }
  
  // Validation checks
  if (config.platformFee && config.entryFee && config.platformFee >= config.entryFee) {
    errors.push('Platform fee cannot be greater than or equal to entry fee');
  }
  
  if (config.platformFee && config.entryFee) {
    const houseEdge = calculateHouseEdge(config);
    if (houseEdge > 20) {
      warnings.push(`House edge is ${houseEdge.toFixed(1)}%, which may be too high`);
    }
  }
  
  if (config.maxTicketsPerUser > 100) {
    warnings.push('Very high ticket limit may affect fairness');
  }
  
  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    suggestions: [
      ...warnings.map(w => ({ type: 'warning', message: w })),
      ...(config.platformFee && config.entryFee && calculateHouseEdge(config) < 5 ? 
        [{ type: 'info', message: 'Low house edge may affect platform sustainability' }] : [])
    ]
  };
};

export default {
  calculatePrizeDistribution,
  calculateTotalPrizePool,
  calculatePlatformRevenue,
  calculateExpectedValue,
  calculateHouseEdge,
  calculateNetPrize,
  calculateWinProbability,
  calculateLotteryStats,
  calculateUserPerformance,
  calculateOptimalStrategy,
  calculateTimeUntilDraw,
  validateLotteryConfig
};
