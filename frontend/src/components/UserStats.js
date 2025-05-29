
import React, { useState, useEffect } from 'react';
import { 
  History, Trophy, TrendingUp, Target, Calendar, 
  Award, Coins, BarChart3, Eye, EyeOff, RefreshCw,
  ArrowUp, ArrowDown, Minus 
} from 'lucide-react';

const UserStats = ({ 
  stats = {}, 
  loading = false, 
  className = '',
  showDetailed = true,
  onRefresh = null
}) => {
  const [showPrivateStats, setShowPrivateStats] = useState(false);
  const [previousStats, setPreviousStats] = useState({});
  const [statChanges, setStatChanges] = useState({});
  const [refreshing, setRefreshing] = useState(false);

  const defaultStats = {
    totalEntries: 0,
    totalWinnings: 0,
    lotteriesWon: 0,
    winRate: 0,
    averageWinAmount: 0,
    totalSpent: 0,
    netProfit: 0,
    favoriteGame: 'None',
    longestStreak: 0,
    lastWin: null,
    dailyEntriesThisMonth: 0,
    weeklyEntriesThisMonth: 0,
    monthlyEntriesThisMonth: 0,
    adEntriesThisMonth: 0,
    rank: 'Newcomer',
    experience: 0
  };

  const mergedStats = { ...defaultStats, ...stats };

  useEffect(() => {
    if (Object.keys(stats).length > 0) {
      calculateStatChanges();
      setPreviousStats(stats);
    }
  }, [stats]);

  const calculateStatChanges = () => {
    if (Object.keys(previousStats).length === 0) return;

    const changes = {};
    Object.keys(mergedStats).forEach(key => {
      if (typeof mergedStats[key] === 'number' && typeof previousStats[key] === 'number') {
        const change = mergedStats[key] - previousStats[key];
        if (change !== 0) {
          changes[key] = change;
        }
      }
    });
    setStatChanges(changes);
  };

  const handleRefresh = async () => {
    if (!onRefresh) return;
    
    setRefreshing(true);
    try {
      await onRefresh();
    } catch (error) {
      console.error('Failed to refresh stats:', error);
    } finally {
      setTimeout(() => setRefreshing(false), 1000);
    }
  };

  const formatCurrency = (amount) => {
    return `${parseFloat(amount || 0).toFixed(3)} π`;
  };

  const formatPercentage = (value) => {
    return `${(parseFloat(value || 0) * 100).toFixed(1)}%`;
  };

  const getChangeIcon = (change) => {
    if (change > 0) return <ArrowUp className="w-3 h-3 text-green-400" />;
    if (change < 0) return <ArrowDown className="w-3 h-3 text-red-400" />;
    return <Minus className="w-3 h-3 text-gray-400" />;
  };

  const getChangeColor = (change) => {
    if (change > 0) return 'text-green-400';
    if (change < 0) return 'text-red-400';
    return 'text-gray-400';
  };

  const getRankColor = (rank) => {
    const rankColors = {
      'Newcomer': 'text-gray-400',
      'Bronze': 'text-orange-600',
      'Silver': 'text-gray-300',
      'Gold': 'text-yellow-400',
      'Platinum': 'text-blue-400',
      'Legend': 'text-purple-400'
    };
    return rankColors[rank] || 'text-gray-400';
  };

  const getWinRateColor = (winRate) => {
    if (winRate >= 0.3) return 'text-green-400';
    if (winRate >= 0.15) return 'text-yellow-400';
    if (winRate >= 0.05) return 'text-orange-400';
    return 'text-red-400';
  };

  const calculateROI = () => {
    if (mergedStats.totalSpent === 0) return 0;
    return ((mergedStats.totalWinnings - mergedStats.totalSpent) / mergedStats.totalSpent) * 100;
  };

  const getStreakEmoji = (streak) => {
    if (streak >= 10) return '🔥';
    if (streak >= 5) return '⚡';
    if (streak >= 3) return '✨';
    return '🎯';
  };

  if (loading) {
    return (
      <div className={`bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-lg rounded-3xl p-6 border border-white/10 ${className}`}>
        <div className="animate-pulse">
          <div className="h-6 bg-white/10 rounded mb-4"></div>
          <div className="space-y-3">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="flex justify-between">
                <div className="h-4 bg-white/10 rounded w-1/2"></div>
                <div className="h-4 bg-white/10 rounded w-1/4"></div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-lg rounded-3xl p-6 border border-white/10 ${className}`}>
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-xl font-bold flex items-center">
          <History className="w-6 h-6 text-purple-400 mr-2" />
          Your Statistics
        </h3>
        
        <div className="flex items-center space-x-2">
          <button
            onClick={() => setShowPrivateStats(!showPrivateStats)}
            className="p-2 bg-white/5 hover:bg-white/10 rounded-lg transition-all duration-300"
            title={showPrivateStats ? 'Hide sensitive data' : 'Show all statistics'}
          >
            {showPrivateStats ? (
              <EyeOff className="w-4 h-4 text-gray-400" />
            ) : (
              <Eye className="w-4 h-4 text-gray-400" />
            )}
          </button>
          
          {onRefresh && (
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="p-2 bg-white/5 hover:bg-white/10 rounded-lg transition-all duration-300"
              title="Refresh statistics"
            >
              <RefreshCw className={`w-4 h-4 text-gray-400 ${refreshing ? 'animate-spin' : ''}`} />
            </button>
          )}
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="p-4 bg-white/5 rounded-xl border border-white/10">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center space-x-2">
              <Trophy className="w-5 h-5 text-yellow-400" />
              <span className="text-sm text-gray-400">Lotteries Won</span>
            </div>
            {statChanges.lotteriesWon && (
              <div className={`flex items-center space-x-1 ${getChangeColor(statChanges.lotteriesWon)}`}>
                {getChangeIcon(statChanges.lotteriesWon)}
                <span className="text-xs">+{statChanges.lotteriesWon}</span>
              </div>
            )}
          </div>
          <p className="text-2xl font-bold text-yellow-400">{mergedStats.lotteriesWon}</p>
        </div>

        <div className="p-4 bg-white/5 rounded-xl border border-white/10">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center space-x-2">
              <Target className="w-5 h-5 text-blue-400" />
              <span className="text-sm text-gray-400">Win Rate</span>
            </div>
          </div>
          <p className={`text-2xl font-bold ${getWinRateColor(mergedStats.winRate)}`}>
            {formatPercentage(mergedStats.winRate)}
          </p>
        </div>

        <div className="p-4 bg-white/5 rounded-xl border border-white/10">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center space-x-2">
              <Coins className="w-5 h-5 text-green-400" />
              <span className="text-sm text-gray-400">Total Winnings</span>
            </div>
            {statChanges.totalWinnings && (
              <div className={`flex items-center space-x-1 ${getChangeColor(statChanges.totalWinnings)}`}>
                {getChangeIcon(statChanges.totalWinnings)}
                <span className="text-xs">+{statChanges.totalWinnings.toFixed(3)}</span>
              </div>
            )}
          </div>
          <p className="text-2xl font-bold text-green-400">
            {showPrivateStats ? formatCurrency(mergedStats.totalWinnings) : '***.**'}
          </p>
        </div>

        <div className="p-4 bg-white/5 rounded-xl border border-white/10">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center space-x-2">
              <BarChart3 className="w-5 h-5 text-purple-400" />
              <span className="text-sm text-gray-400">Total Entries</span>
            </div>
            {statChanges.totalEntries && (
              <div className={`flex items-center space-x-1 ${getChangeColor(statChanges.totalEntries)}`}>
                {getChangeIcon(statChanges.totalEntries)}
                <span className="text-xs">+{statChanges.totalEntries}</span>
              </div>
            )}
          </div>
          <p className="text-2xl font-bold text-purple-400">{mergedStats.totalEntries}</p>
        </div>
      </div>

      {/* Detailed Statistics */}
      {showDetailed && (
        <>
          <div className="space-y-3 mb-6">
            <div className="flex justify-between items-center py-2">
              <span className="text-gray-400">Average Win Amount</span>
              <span className="font-bold text-white">
                {showPrivateStats ? formatCurrency(mergedStats.averageWinAmount) : '***.**'}
              </span>
            </div>

            <div className="flex justify-between items-center py-2">
              <span className="text-gray-400">Total Spent</span>
              <span className="font-bold text-white">
                {showPrivateStats ? formatCurrency(mergedStats.totalSpent) : '***.**'}
              </span>
            </div>

            <div className="flex justify-between items-center py-2">
              <span className="text-gray-400">Net Profit/Loss</span>
              <span className={`font-bold ${
                mergedStats.netProfit >= 0 ? 'text-green-400' : 'text-red-400'
              }`}>
                {showPrivateStats ? (
                  `${mergedStats.netProfit >= 0 ? '+' : ''}${formatCurrency(mergedStats.netProfit)}`
                ) : '***.**'}
              </span>
            </div>

            <div className="flex justify-between items-center py-2">
              <span className="text-gray-400">ROI</span>
              <span className={`font-bold ${
                calculateROI() >= 0 ? 'text-green-400' : 'text-red-400'
              }`}>
                {showPrivateStats ? `${calculateROI().toFixed(1)}%` : '***%'}
              </span>
            </div>

            <div className="flex justify-between items-center py-2">
              <div className="flex items-center space-x-2">
                <span className="text-gray-400">Longest Streak</span>
                <span>{getStreakEmoji(mergedStats.longestStreak)}</span>
              </div>
              <span className="font-bold text-orange-400">{mergedStats.longestStreak}</span>
            </div>

            <div className="flex justify-between items-center py-2">
              <span className="text-gray-400">Player Rank</span>
              <div className="flex items-center space-x-2">
                <Award className={`w-4 h-4 ${getRankColor(mergedStats.rank)}`} />
                <span className={`font-bold ${getRankColor(mergedStats.rank)}`}>
                  {mergedStats.rank}
                </span>
              </div>
            </div>
          </div>

          {/* Monthly Activity Breakdown */}
          <div className="border-t border-white/10 pt-4">
            <h4 className="font-semibold mb-3 flex items-center">
              <Calendar className="w-5 h-5 text-blue-400 mr-2" />
              This Month's Activity
            </h4>
            
            <div className="grid grid-cols-2 gap-3">
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Daily Pi Entries</span>
                <span className="font-medium text-yellow-400">{mergedStats.dailyEntriesThisMonth}</span>
              </div>
              
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Ad Entries</span>
                <span className="font-medium text-green-400">{mergedStats.adEntriesThisMonth}</span>
              </div>
              
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Weekly Entries</span>
                <span className="font-medium text-blue-400">{mergedStats.weeklyEntriesThisMonth}</span>
              </div>
              
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Monthly Entries</span>
                <span className="font-medium text-purple-400">{mergedStats.monthlyEntriesThisMonth}</span>
              </div>
            </div>
          </div>

          {/* Last Win Information */}
          {mergedStats.lastWin && (
            <div className="border-t border-white/10 pt-4 mt-4">
              <h4 className="font-semibold mb-2 text-green-400">Last Win</h4>
              <div className="text-sm text-gray-300">
                <p>{formatCurrency(mergedStats.lastWin.amount)} • {mergedStats.lastWin.lottery}</p>
                <p className="text-gray-500 text-xs mt-1">
                  {new Date(mergedStats.lastWin.date).toLocaleDateString()}
                </p>
              </div>
            </div>
          )}

          {/* Performance Insights */}
          <div className="border-t border-white/10 pt-4 mt-4">
            <h4 className="font-semibold mb-3 flex items-center">
              <TrendingUp className="w-5 h-5 text-green-400 mr-2" />
              Insights
            </h4>
            
            <div className="space-y-2 text-sm">
              {mergedStats.winRate > 0.2 && (
                <div className="p-2 bg-green-500/10 border border-green-500/20 rounded-lg">
                  <p className="text-green-400">🎯 Excellent win rate! You're performing above average.</p>
                </div>
              )}
              
              {mergedStats.longestStreak >= 5 && (
                <div className="p-2 bg-orange-500/10 border border-orange-500/20 rounded-lg">
                  <p className="text-orange-400">🔥 Impressive streak! Keep the momentum going.</p>
                </div>
              )}
              
              {mergedStats.totalEntries >= 50 && mergedStats.winRate < 0.05 && (
                <div className="p-2 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                  <p className="text-blue-400">💡 Consider trying different lottery types for better odds.</p>
                </div>
              )}
              
              {mergedStats.netProfit > 0 && (
                <div className="p-2 bg-purple-500/10 border border-purple-500/20 rounded-lg">
                  <p className="text-purple-400">💰 You're in profit! Great job managing your entries.</p>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default UserStats;
