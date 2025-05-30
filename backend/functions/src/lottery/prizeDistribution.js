const { logger } = require('../utils/logger');

/**
 * Prize distribution calculation and management
 */
class PrizeDistribution {
  constructor() {
    this.prizeStructures = {
      // Small lotteries (≤50 participants)
      small: {
        maxParticipants: 50,
        distribution: {
          position_1: 0.6,   // 60% to 1st place
          position_2: 0.25,  // 25% to 2nd place
          position_3: 0.15   // 15% to 3rd place
        }
      },
      
      // Medium lotteries (51-200 participants)
      medium: {
        maxParticipants: 200,
        distribution: {
          position_1: 0.5,   // 50% to 1st place
          position_2: 0.25,  // 25% to 2nd place
          position_3: 0.15,  // 15% to 3rd place
          position_4: 0.06,  // 6% to 4th place
          position_5: 0.04   // 4% to 5th place
        }
      },
      
      // Large lotteries (200+ participants)
      large: {
        maxParticipants: Infinity,
        distribution: {
          position_1: 0.4,     // 40% to 1st place
          position_2: 0.2,     // 20% to 2nd place
          position_3: 0.15,    // 15% to 3rd place
          position_4: 0.08,    // 8% to 4th place
          position_5: 0.08,    // 8% to 5th place
          position_6: 0.08,    // 8% to 6th place
          position_7: 0.0225,  // 2.25% to 7th place
          position_8: 0.0225,  // 2.25% to 8th place
          position_9: 0.0225,  // 2.25% to 9th place
          position_10: 0.0225  // 2.25% to 10th place
        }
      },

      // Micro lotteries for ad-based lotteries
      micro: {
        maxParticipants: 30,
        distribution: {
          position_1: 0.5,   // 50% to 1st place
          position_2: 0.3,   // 30% to 2nd place
          position_3: 0.2    // 20% to 3rd place
        }
      }
    };

    // Special event prize structures
    this.eventStructures = {
      // Holiday events with more winners
      holiday: {
        maxParticipants: Infinity,
        distribution: {
          position_1: 0.3,     // 30% to 1st place
          position_2: 0.15,    // 15% to 2nd place
          position_3: 0.12,    // 12% to 3rd place
          position_4: 0.1,     // 10% to 4th place
          position_5: 0.08,    // 8% to 5th place
          position_6: 0.07,    // 7% to 6th place
          position_7: 0.06,    // 6% to 7th place
          position_8: 0.05,    // 5% to 8th place
          position_9: 0.04,    // 4% to 9th place
          position_10: 0.03    // 3% to 10th place
        }
      },

      // Bonus round with top-heavy distribution
      bonus: {
        maxParticipants: Infinity,
        distribution: {
          position_1: 0.7,   // 70% to 1st place
          position_2: 0.2,   // 20% to 2nd place
          position_3: 0.1    // 10% to 3rd place
        }
      }
    };
  }

  /**
   * Get appropriate prize structure based on participant count
   */
  getPrizeStructure(participantCount, lotteryType = null, eventType = null) {
    try {
      // Check for special event structures
      if (eventType && this.eventStructures[eventType]) {
        return this.eventStructures[eventType].distribution;
      }

      // Special handling for ad lotteries
      if (lotteryType === 'daily_ads') {
        return this.prizeStructures.micro.distribution;
      }

      // Regular prize structures based on participant count
      if (participantCount <= this.prizeStructures.small.maxParticipants) {
        return this.prizeStructures.small.distribution;
      } else if (participantCount <= this.prizeStructures.medium.maxParticipants) {
        return this.prizeStructures.medium.distribution;
      } else {
        return this.prizeStructures.large.distribution;
      }
    } catch (error) {
      logger.error('Failed to get prize structure:', error);
      // Return default small structure
      return this.prizeStructures.small.distribution;
    }
  }

  /**
   * Calculate individual prize amounts
   */
  calculatePrizeAmounts(totalPrizePool, participantCount, lotteryType = null, eventType = null) {
    try {
      const prizeStructure = this.getPrizeStructure(participantCount, lotteryType, eventType);
      const prizeAmounts = {};

      for (const [position, percentage] of Object.entries(prizeStructure)) {
        const amount = totalPrizePool * percentage;
        prizeAmounts[position] = {
          percentage,
          grossAmount: parseFloat(amount.toFixed(6)),
          netAmount: this.calculateNetAmount(amount),
          position: parseInt(position.split('_')[1])
        };
      }

      return {
        prizes: prizeAmounts,
        totalDistributed: Object.values(prizeAmounts).reduce((sum, prize) => sum + prize.grossAmount, 0),
        structure: this.getStructureName(participantCount, lotteryType, eventType)
      };
    } catch (error) {
      logger.error('Failed to calculate prize amounts:', error);
      throw error;
    }
  }

  /**
   * Calculate net amount after Pi Network transaction fee
   */
  calculateNetAmount(grossAmount) {
    const piNetworkFee = 0.01; // Pi Network transaction fee
    return Math.max(0, parseFloat((grossAmount - piNetworkFee).toFixed(6)));
  }

  /**
   * Get structure name for logging/display
   */
  getStructureName(participantCount, lotteryType = null, eventType = null) {
    if (eventType) return eventType;
    if (lotteryType === 'daily_ads') return 'micro';
    if (participantCount <= 50) return 'small';
    if (participantCount <= 200) return 'medium';
    return 'large';
  }

  /**
   * Validate prize distribution totals to 100%
   */
  validatePrizeStructure(prizeStructure) {
    try {
      const total = Object.values(prizeStructure).reduce((sum, percentage) => sum + percentage, 0);
      const tolerance = 0.0001; // Allow small floating point differences
      
      if (Math.abs(total - 1.0) > tolerance) {
        return {
          isValid: false,
          total,
          difference: total - 1.0,
          reason: `Prize structure totals ${total}, not 1.0`
        };
      }

      return {
        isValid: true,
        total,
        positionCount: Object.keys(prizeStructure).length
      };
    } catch (error) {
      logger.error('Failed to validate prize structure:', error);
      return { isValid: false, reason: 'Validation error' };
    }
  }

  /**
   * Get optimal prize structure recommendation
   */
  getOptimalStructure(participantCount, totalPrizePool, lotteryType = null) {
    try {
      const recommendations = [];

      // Current structure
      const currentStructure = this.getPrizeStructure(participantCount, lotteryType);
      const currentPrizes = this.calculatePrizeAmounts(totalPrizePool, participantCount, lotteryType);
      
      recommendations.push({
        type: 'current',
        name: this.getStructureName(participantCount, lotteryType),
        structure: currentStructure,
        prizes: currentPrizes,
        winnerCount: Object.keys(currentStructure).length,
        topPrize: Math.max(...Object.values(currentPrizes.prizes).map(p => p.grossAmount))
      });

      // Alternative structures for comparison
      if (participantCount > 50) {
        const smallStructurePrizes = this.calculatePrizeAmounts(totalPrizePool, 30, lotteryType);
        recommendations.push({
          type: 'alternative',
          name: 'fewer_winners',
          structure: this.prizeStructures.small.distribution,
          prizes: smallStructurePrizes,
          winnerCount: 3,
          topPrize: Math.max(...Object.values(smallStructurePrizes.prizes).map(p => p.grossAmount))
        });
      }

      if (participantCount > 100) {
        const holidayPrizes = this.calculatePrizeAmounts(totalPrizePool, participantCount, null, 'holiday');
        recommendations.push({
          type: 'alternative',
          name: 'more_winners',
          structure: this.eventStructures.holiday.distribution,
          prizes: holidayPrizes,
          winnerCount: 10,
          topPrize: Math.max(...Object.values(holidayPrizes.prizes).map(p => p.grossAmount))
        });
      }

      return {
        participantCount,
        totalPrizePool,
        recommendations,
        defaultRecommendation: 'current'
      };
    } catch (error) {
      logger.error('Failed to get optimal structure:', error);
      throw error;
    }
  }

  /**
   * Calculate prize impact of participant changes
   */
  calculateParticipantImpact(currentParticipants, newParticipants, currentPrizePool, newPrizePool) {
    try {
      const currentPrizes = this.calculatePrizeAmounts(currentPrizePool, currentParticipants);
      const newPrizes = this.calculatePrizeAmounts(newPrizePool, newParticipants);

      const impact = {
        participantChange: newParticipants - currentParticipants,
        prizePoolChange: newPrizePool - currentPrizePool,
        structureChange: currentPrizes.structure !== newPrizes.structure,
        prizeChanges: {}
      };

      // Calculate changes for each position
      Object.keys(currentPrizes.prizes).forEach(position => {
        const currentPrize = currentPrizes.prizes[position];
        const newPrize = newPrizes.prizes[position];
        
        if (newPrize) {
          impact.prizeChanges[position] = {
            oldAmount: currentPrize.grossAmount,
            newAmount: newPrize.grossAmount,
            change: newPrize.grossAmount - currentPrize.grossAmount,
            percentageChange: ((newPrize.grossAmount - currentPrize.grossAmount) / currentPrize.grossAmount) * 100
          };
        }
      });

      // Check for new positions
      Object.keys(newPrizes.prizes).forEach(position => {
        if (!currentPrizes.prizes[position]) {
          impact.prizeChanges[position] = {
            oldAmount: 0,
            newAmount: newPrizes.prizes[position].grossAmount,
            change: newPrizes.prizes[position].grossAmount,
            percentageChange: 100,
            isNew: true
          };
        }
      });

      return impact;
    } catch (error) {
      logger.error('Failed to calculate participant impact:', error);
      throw error;
    }
  }

  /**
   * Generate prize distribution report
   */
  generateDistributionReport(lotteryInstanceId, participantCount, totalPrizePool, lotteryType = null) {
    try {
      const prizeCalculation = this.calculatePrizeAmounts(totalPrizePool, participantCount, lotteryType);
      
      const report = {
        lotteryInstanceId,
        generatedAt: new Date().toISOString(),
        summary: {
          participantCount,
          totalPrizePool,
          lotteryType,
          structure: prizeCalculation.structure,
          winnerCount: Object.keys(prizeCalculation.prizes).length,
          totalDistributed: prizeCalculation.totalDistributed,
          distributionEfficiency: (prizeCalculation.totalDistributed / totalPrizePool) * 100
        },
        prizes: prizeCalculation.prizes,
        breakdown: {
          firstPrize: prizeCalculation.prizes.position_1?.grossAmount || 0,
          firstPrizePercentage: (prizeCalculation.prizes.position_1?.grossAmount || 0) / totalPrizePool,
          smallestPrize: Math.min(...Object.values(prizeCalculation.prizes).map(p => p.grossAmount)),
          largestPrize: Math.max(...Object.values(prizeCalculation.prizes).map(p => p.grossAmount)),
          averagePrize: prizeCalculation.totalDistributed / Object.keys(prizeCalculation.prizes).length
        }
      };

      return report;
    } catch (error) {
      logger.error('Failed to generate distribution report:', error);
      throw error;
    }
  }

  /**
   * Get historical prize distribution analytics
   */
  async getHistoricalDistributionAnalytics(timeRange = 30) {
    try {
      const admin = require('firebase-admin');
      const db = admin.firestore();
      
      const startDate = new Date(Date.now() - timeRange * 24 * 60 * 60 * 1000);
      
      const winnersSnapshot = await db.collection('lottery_winners')
        .where('createdAt', '>=', startDate)
        .get();

      const analytics = {
        totalPrizesPaid: 0,
        totalWinners: winnersSnapshot.size,
        averagePrize: 0,
        prizesByPosition: {},
        prizesByLotteryType: {},
        largestPrize: 0,
        smallestPrize: Infinity
      };

      winnersSnapshot.forEach(doc => {
        const winner = doc.data();
        const prizeAmount = winner.prizeAmount || 0;
        const position = winner.position || 1;
        const lotteryType = winner.lotteryInstanceId?.split('_')[0] || 'unknown';

        analytics.totalPrizesPaid += prizeAmount;
        
        if (prizeAmount > analytics.largestPrize) {
          analytics.largestPrize = prizeAmount;
        }
        
        if (prizeAmount < analytics.smallestPrize) {
          analytics.smallestPrize = prizeAmount;
        }

        // Count by position
        if (!analytics.prizesByPosition[position]) {
          analytics.prizesByPosition[position] = { count: 0, total: 0, average: 0 };
        }
        analytics.prizesByPosition[position].count++;
        analytics.prizesByPosition[position].total += prizeAmount;
        analytics.prizesByPosition[position].average = 
          analytics.prizesByPosition[position].total / analytics.prizesByPosition[position].count;

        // Count by lottery type
        if (!analytics.prizesByLotteryType[lotteryType]) {
          analytics.prizesByLotteryType[lotteryType] = { count: 0, total: 0, average: 0 };
        }
        analytics.prizesByLotteryType[lotteryType].count++;
        analytics.prizesByLotteryType[lotteryType].total += prizeAmount;
        analytics.prizesByLotteryType[lotteryType].average = 
          analytics.prizesByLotteryType[lotteryType].total / analytics.prizesByLotteryType[lotteryType].count;
      });

      if (analytics.totalWinners > 0) {
        analytics.averagePrize = analytics.totalPrizesPaid / analytics.totalWinners;
      }

      if (analytics.smallestPrize === Infinity) {
        analytics.smallestPrize = 0;
      }

      return analytics;
    } catch (error) {
      logger.error('Failed to get historical distribution analytics:', error);
      throw error;
    }
  }

  /**
   * Create custom prize structure
   */
  createCustomStructure(structureName, distribution, maxParticipants = Infinity) {
    try {
      const validation = this.validatePrizeStructure(distribution);
      
      if (!validation.isValid) {
        throw new Error(`Invalid prize structure: ${validation.reason}`);
      }

      this.prizeStructures[structureName] = {
        maxParticipants,
        distribution,
        isCustom: true,
        createdAt: new Date().toISOString()
      };

      logger.info(`Custom prize structure created: ${structureName}`);
      
      return {
        success: true,
        structureName,
        validation,
        distribution
      };
    } catch (error) {
      logger.error('Failed to create custom structure:', error);
      throw error;
    }
  }

  /**
   * Get all available prize structures
   */
  getAllStructures() {
    return {
      standard: this.prizeStructures,
      events: this.eventStructures,
      info: {
        totalStructures: Object.keys(this.prizeStructures).length + Object.keys(this.eventStructures).length,
        customStructures: Object.values(this.prizeStructures).filter(s => s.isCustom).length
      }
    };
  }
}

module.exports = new PrizeDistribution();
