import React, { useState, useEffect } from 'react';
import { 
  Star, Trophy, Award, Crown, Medal, Target,
  TrendingUp, Users, Coins, Calculator, 
  BarChart3, PieChart, Eye, EyeOff 
} from 'lucide-react';

const PrizeDistribution = ({ 
  prizes = {}, 
  participants = 0, 
  lotteryTypeId = '',
  showPercentages = true,
  showCalculations = false,
  interactive = true,
  className = ''
}) => {
  const [expandedTier, setExpandedTier] = useState(null);
  const [showDetailedView, setShowDetailedView] = useState(false);
  const [animateValues, setAnimateValues] = useState(false);

  useEffect(() => {
    // Trigger value animations when component mounts or prizes change
    setAnimateValues(true);
    const timer = setTimeout(() => setAnimateValues(false), 1000);
    return () => clearTimeout(timer);
  }, [prizes, participants]);

  const getPositionIcon = (position, size = 'w-5 h-5') => {
    switch (position) {
      case 1:
        return <Crown className={`${size} text-yellow-400`} />;
      case 2:
        return <Award className={`${size} text-gray-300`} />;
      case 3:
        return <Medal className={`${size} text-orange-600`} />;
      case 4:
      case 5:
      case 6:
        return <Trophy className={`${size} text-blue-400`} />;
      default:
        return <Star className={`${size} text-purple-400`} />;
    }
  };

  const getPositionGradient = (position) => {
    switch (position) {
      case 1:
        return 'from-yellow-500 to-yellow-600';
      case 2:
        return 'from-gray-400 to-gray-500';
      case 3:
        return 'from-orange-500 to-orange-600';
      case 4:
      case 5:
      case 6:
        return 'from-blue-500 to-blue-600';
      default:
        return 'from-purple-500 to-purple-600';
    }
  };

  const getPositionText = (position) => {
    const suffixes = ['st', 'nd', 'rd'];
    const suffix = position <= 3 ? suffixes[position - 1] : 'th';
    return `${position}${suffix}`;
  };

  const calculatePercentage = (amount, totalPool) => {
    if (totalPool === 0) return 0;
    return (amount / totalPool) * 100;
  };

  const getTotalPrizePool = () => {
    return Object.values(prizes).reduce((sum, amount) => sum + amount, 0);
  };

  const formatPrizeAmount = (amount) => {
    if (amount >= 1000) {
      return `${(amount / 1000).toFixed(2)}K π`;
    }
    return `${parseFloat(amount).toFixed(4)} π`;
  };

  const getLotteryTypeInfo = () => {
    const info = {
      daily_pi: {
        name: 'Daily Pi Lottery',
        description: 'High-frequency lottery with Pi payments',
        color: 'yellow'
      },
      daily_ads: {
        name: 'Daily Ads Lottery',
        description: 'Free entry through ad viewing',
        color: 'green'
      },
      weekly_pi: {
        name: 'Weekly Pi Lottery',
        description: 'Weekly draws with larger prizes',
        color: 'blue'
      },
      monthly_pi: {
        name: 'Monthly Pi Lottery',
        description: 'Monthly mega lottery with biggest rewards',
        color: 'purple'
      }
    };
    return info[lotteryTypeId] || { name: 'Lottery', description: '', color: 'gray' };
  };

  const getPrizeTierInfo = (participants) => {
    if (participants <= 50) {
      return { tier: 'Small', description: 'Basic prize structure', maxWinners: 3 };
    } else if (participants <= 200) {
      return { tier: 'Medium', description: 'Enhanced prize structure', maxWinners: 5 };
    } else {
      return { tier: 'Large', description: 'Premium prize structure', maxWinners: 10 };
    }
  };

  const handleTierClick = (position) => {
    if (!interactive) return;
    setExpandedTier(expandedTier === position ? null : position);
  };

  const totalPool = getTotalPrizePool();
  const lotteryInfo = getLotteryTypeInfo();
  const tierInfo = getPrizeTierInfo(participants);

  if (Object.keys(prizes).length === 0) {
    return (
      <div className={`bg-white/5 rounded-xl p-4 border border-white/10 ${className}`}>
        <div className="text-center py-8">
          <PieChart className="w-12 h-12 text-gray-600 mx-auto mb-4 opacity-50" />
          <p className="text-gray-400">No prize data available</p>
          <p className="text-sm text-gray-500 mt-1">Prize distribution will appear once participants join</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-white/5 rounded-xl border border-white/10 ${className}`}>
      {/* Header */}
      <div className="p-4 border-b border-white/10">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className={`w-8 h-8 bg-gradient-to-r from-${lotteryInfo.color}-500 to-${lotteryInfo.color}-600 rounded-full flex items-center justify-center`}>
              <Trophy className="w-5 h-5 text-white" />
            </div>
            <div>
              <h4 className="font-semibold text-white">Prize Distribution</h4>
              <p className="text-sm text-gray-400">{tierInfo.tier} Tier • {Object.keys(prizes).length} Winners</p>
            </div>
          </div>
          
          {interactive && (
            <div className="flex items-center space-x-2">
              <button
                onClick={() => setShowDetailedView(!showDetailedView)}
                className="p-2 bg-white/5 hover:bg-white/10 rounded-lg transition-all duration-300"
                title={showDetailedView ? 'Hide details' : 'Show details'}
              >
                {showDetailedView ? (
                  <EyeOff className="w-4 h-4 text-gray-400" />
                ) : (
                  <Eye className="w-4 h-4 text-gray-400" />
                )}
              </button>
              <button
                onClick={() => setShowCalculations(!showCalculations)}
                className="p-2 bg-white/5 hover:bg-white/10 rounded-lg transition-all duration-300"
                title="Toggle calculations"
              >
                <Calculator className="w-4 h-4 text-gray-400" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Prize Pool Summary */}
      <div className="p-4 bg-gradient-to-r from-white/5 to-transparent">
        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <div className="flex items-center justify-center space-x-1 mb-1">
              <Coins className="w-4 h-4 text-yellow-400" />
              <span className="text-xs text-gray-400">Total Pool</span>
            </div>
            <p className={`font-bold text-yellow-400 ${animateValues ? 'animate-pulse' : ''}`}>
              {formatPrizeAmount(totalPool)}
            </p>
          </div>
          
          <div>
            <div className="flex items-center justify-center space-x-1 mb-1">
              <Users className="w-4 h-4 text-blue-400" />
              <span className="text-xs text-gray-400">Participants</span>
            </div>
            <p className={`font-bold text-blue-400 ${animateValues ? 'animate-pulse' : ''}`}>
              {participants}
            </p>
          </div>
          
          <div>
            <div className="flex items-center justify-center space-x-1 mb-1">
              <Target className="w-4 h-4 text-green-400" />
              <span className="text-xs text-gray-400">Avg Prize</span>
            </div>
            <p className={`font-bold text-green-400 ${animateValues ? 'animate-pulse' : ''}`}>
              {formatPrizeAmount(totalPool / Object.keys(prizes).length)}
            </p>
          </div>
        </div>
      </div>

      {/* Prize List */}
      <div className="p-4">
        <div className="space-y-2">
          {Object.entries(prizes).map(([position, amount], index) => {
            const positionNum = parseInt(position.replace('position_', '')) || (index + 1);
            const percentage = calculatePercentage(amount, totalPool);
            const isExpanded = expandedTier === positionNum;
            
            return (
              <div key={position} className="group">
                <div 
                  onClick={() => handleTierClick(positionNum)}
                  className={`flex items-center justify-between p-3 rounded-lg border transition-all duration-300 ${
                    interactive ? 'cursor-pointer hover:bg-white/5 hover:border-white/20' : ''
                  } ${
                    isExpanded ? 'bg-white/10 border-white/20' : 'bg-white/5 border-white/10'
                  }`}
                >
                  <div className="flex items-center space-x-3">
                    <div className={`relative w-10 h-10 bg-gradient-to-r ${getPositionGradient(positionNum)} rounded-full flex items-center justify-center shadow-lg`}>
                      {getPositionIcon(positionNum)}
                      <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-slate-800 rounded-full flex items-center justify-center border-2 border-white/20">
                        <span className="text-xs font-bold text-white">
                          {positionNum}
                        </span>
                      </div>
                    </div>
                    
                    <div>
                      <p className="font-medium text-white">
                        {getPositionText(positionNum)} Prize
                      </p>
                      {showPercentages && (
                        <p className="text-sm text-gray-400">
                          {percentage.toFixed(1)}% of pool
                        </p>
                      )}
                    </div>
                  </div>
                  
                  <div className="text-right">
                    <p className={`font-bold text-lg ${
                      positionNum === 1 ? 'text-yellow-400' :
                      positionNum === 2 ? 'text-gray-300' :
                      positionNum === 3 ? 'text-orange-400' :
                      'text-blue-400'
                    } ${animateValues ? 'animate-pulse' : ''}`}>
                      {formatPrizeAmount(amount)}
                    </p>
                    {showCalculations && participants > 0 && (
                      <p className="text-xs text-gray-500">
                        {(amount / participants).toFixed(4)} π per participant
                      </p>
                    )}
                  </div>
                </div>

                {/* Expanded Details */}
                {isExpanded && showDetailedView && (
                  <div className="mt-2 ml-13 p-3 bg-white/5 rounded-lg border border-white/10 animate-fadeIn">
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <p className="text-gray-400 mb-1">Prize Details</p>
                        <div className="space-y-1">
                          <div className="flex justify-between">
                            <span className="text-gray-500">Gross Amount:</span>
                            <span className="text-white">{formatPrizeAmount(amount)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-500">Network Fee:</span>
                            <span className="text-red-300">-0.01 π</span>
                          </div>
                          <div className="flex justify-between border-t border-white/10 pt-1">
                            <span className="text-gray-400">Net Amount:</span>
                            <span className="text-green-400 font-medium">
                              {formatPrizeAmount(Math.max(0, amount - 0.01))}
                            </span>
                          </div>
                        </div>
                      </div>
                      
                      <div>
                        <p className="text-gray-400 mb-1">Win Probability</p>
                        <div className="space-y-1">
                          <div className="flex justify-between">
                            <span className="text-gray-500">Base Odds:</span>
                            <span className="text-white">
                              1 in {participants || 1}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-500">Percentage:</span>
                            <span className="text-blue-400">
                              {participants > 0 ? (100 / participants).toFixed(2) : 0}%
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Prize Distribution Chart */}
      {showDetailedView && (
        <div className="p-4 border-t border-white/10">
          <h5 className="font-medium text-white mb-3 flex items-center">
            <BarChart3 className="w-4 h-4 text-purple-400 mr-2" />
            Distribution Visualization
          </h5>
          
          <div className="space-y-2">
            {Object.entries(prizes).map(([position, amount], index) => {
              const positionNum = parseInt(position.replace('position_', '')) || (index + 1);
              const percentage = calculatePercentage(amount, totalPool);
              
              return (
                <div key={position} className="flex items-center space-x-3">
                  <div className="w-8 text-xs text-gray-400">
                    {getPositionText(positionNum)}
                  </div>
                  <div className="flex-1 bg-white/10 rounded-full h-2">
                    <div 
                      className={`h-2 rounded-full bg-gradient-to-r ${getPositionGradient(positionNum)} transition-all duration-1000`}
                      style={{ width: `${percentage}%` }}
                    ></div>
                  </div>
                  <div className="w-12 text-xs text-gray-400 text-right">
                    {percentage.toFixed(1)}%
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Additional Information */}
      {showCalculations && (
        <div className="p-4 border-t border-white/10 bg-gradient-to-r from-blue-500/5 to-purple-500/5">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-gray-400 mb-2">Pool Statistics</p>
              <div className="space-y-1">
                <div className="flex justify-between">
                  <span className="text-gray-500">Prize Pool:</span>
                  <span className="text-yellow-400">{formatPrizeAmount(totalPool)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Platform Fee:</span>
                  <span className="text-red-300">{formatPrizeAmount(participants * 0.1)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Total Entry:</span>
                  <span className="text-white">{formatPrizeAmount(totalPool + (participants * 0.1))}</span>
                </div>
              </div>
            </div>
            
            <div>
              <p className="text-gray-400 mb-2">Expected Values</p>
              <div className="space-y-1">
                <div className="flex justify-between">
                  <span className="text-gray-500">Expected Win:</span>
                  <span className="text-green-400">
                    {participants > 0 ? formatPrizeAmount(totalPool / participants) : '0 π'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">House Edge:</span>
                  <span className="text-orange-400">
                    {participants > 0 ? ((participants * 0.1) / (totalPool + participants * 0.1) * 100).toFixed(1) : 0}%
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Lottery Tier:</span>
                  <span className="text-purple-400">{tierInfo.tier}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PrizeDistribution;
