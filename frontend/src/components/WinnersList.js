import React, { useState, useEffect } from 'react';
import { TrendingUp, Trophy, Calendar, Eye, ExternalLink, Star, Award, Crown } from 'lucide-react';

const WinnersList = ({ 
  winners = [], 
  maxDisplay = 5, 
  showPagination = false,
  className = '',
  title = 'Recent Winners'
}) => {
  const [displayedWinners, setDisplayedWinners] = useState([]);
  const [currentPage, setCurrentPage] = useState(0);
  const [expandedWinner, setExpandedWinner] = useState(null);
  const [animationIndex, setAnimationIndex] = useState(0);

  useEffect(() => {
    if (winners.length > 0) {
      updateDisplayedWinners();
      startWinnerAnimation();
    }
  }, [winners, currentPage, maxDisplay]);

  const updateDisplayedWinners = () => {
    const startIndex = currentPage * maxDisplay;
    const endIndex = startIndex + maxDisplay;
    setDisplayedWinners(winners.slice(startIndex, endIndex));
  };

  const startWinnerAnimation = () => {
    const interval = setInterval(() => {
      setAnimationIndex(prev => (prev + 1) % displayedWinners.length);
    }, 3000);

    return () => clearInterval(interval);
  };

  const getPositionIcon = (position) => {
    switch (position) {
      case 1:
        return <Crown className="w-5 h-5 text-yellow-400" />;
      case 2:
        return <Award className="w-5 h-5 text-gray-400" />;
      case 3:
        return <Trophy className="w-5 h-5 text-orange-600" />;
      default:
        return <Star className="w-5 h-5 text-blue-400" />;
    }
  };

  const getPositionColor = (position) => {
    switch (position) {
      case 1:
        return 'from-yellow-500 to-yellow-600';
      case 2:
        return 'from-gray-400 to-gray-500';
      case 3:
        return 'from-orange-500 to-orange-600';
      default:
        return 'from-blue-500 to-blue-600';
    }
  };

  const getPositionText = (position) => {
    const suffixes = ['st', 'nd', 'rd'];
    const suffix = position <= 3 ? suffixes[position - 1] : 'th';
    return `${position}${suffix}`;
  };

  const formatTimeAgo = (timestamp) => {
    if (!timestamp) return 'Recently';
    
    const now = new Date();
    const winTime = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    const diffMs = now - winTime;
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffHours / 24);

    if (diffDays > 0) {
      return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
    } else if (diffHours > 0) {
      return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    } else {
      return 'Recently';
    }
  };

  const formatPrizeAmount = (amount) => {
    if (amount >= 1000) {
      return `${(amount / 1000).toFixed(1)}K π`;
    }
    return `${parseFloat(amount).toFixed(3)} π`;
  };

  const getLotteryTypeDisplay = (lotteryInstanceId) => {
    if (!lotteryInstanceId) return 'Unknown';
    
    if (lotteryInstanceId.includes('daily_pi')) return 'Daily Pi';
    if (lotteryInstanceId.includes('daily_ads')) return 'Daily Ads';
    if (lotteryInstanceId.includes('weekly_pi')) return 'Weekly Pi';
    if (lotteryInstanceId.includes('monthly_pi')) return 'Monthly Pi';
    
    return 'Lottery';
  };

  const handleWinnerClick = (winnerId) => {
    setExpandedWinner(expandedWinner === winnerId ? null : winnerId);
  };

  if (!winners || winners.length === 0) {
    return (
      <div className={`bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-lg rounded-3xl p-6 border border-white/10 ${className}`}>
        <h3 className="text-xl font-bold mb-4 flex items-center">
          <TrendingUp className="w-6 h-6 text-green-400 mr-2" />
          {title}
        </h3>
        <div className="text-center py-8">
          <Trophy className="w-16 h-16 text-gray-600 mx-auto mb-4 opacity-50" />
          <p className="text-gray-400">No winners yet</p>
          <p className="text-sm text-gray-500 mt-1">Be the first to win a lottery!</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-lg rounded-3xl p-6 border border-white/10 ${className}`}>
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-xl font-bold flex items-center">
          <TrendingUp className="w-6 h-6 text-green-400 mr-2" />
          {title}
        </h3>
        
        {winners.length > maxDisplay && (
          <div className="flex items-center space-x-2">
            <span className="text-sm text-gray-400">
              {currentPage * maxDisplay + 1}-{Math.min((currentPage + 1) * maxDisplay, winners.length)} of {winners.length}
            </span>
            {showPagination && (
              <div className="flex space-x-1">
                <button
                  onClick={() => setCurrentPage(Math.max(0, currentPage - 1))}
                  disabled={currentPage === 0}
                  className="p-1 bg-white/10 hover:bg-white/20 rounded disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300"
                >
                  ←
                </button>
                <button
                  onClick={() => setCurrentPage(Math.min(Math.ceil(winners.length / maxDisplay) - 1, currentPage + 1))}
                  disabled={(currentPage + 1) * maxDisplay >= winners.length}
                  className="p-1 bg-white/10 hover:bg-white/20 rounded disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300"
                >
                  →
                </button>
              </div>
            )}
          </div>
        )}
      </div>
      
      <div className="space-y-3">
        {displayedWinners.map((winner, index) => (
          <div 
            key={winner.id || index}
            className={`relative overflow-hidden transition-all duration-500 ${
              animationIndex === index ? 'ring-2 ring-yellow-400/50' : ''
            }`}
          >
            <div 
              onClick={() => handleWinnerClick(winner.id)}
              className="flex items-center justify-between p-4 bg-white/5 hover:bg-white/10 rounded-xl border border-white/10 hover:border-white/20 cursor-pointer transition-all duration-300"
            >
              <div className="flex items-center space-x-4">
                <div className={`relative w-12 h-12 bg-gradient-to-r ${getPositionColor(winner.position)} rounded-full flex items-center justify-center shadow-lg`}>
                  {getPositionIcon(winner.position)}
                  <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-slate-800 rounded-full flex items-center justify-center border-2 border-white/20">
                    <span className="text-xs font-bold text-white">
                      {winner.position}
                    </span>
                  </div>
                </div>
                
                <div className="flex-1">
                  <div className="flex items-center space-x-2">
                    <p className="font-medium text-white">@{winner.username}</p>
                    <div className="px-2 py-1 bg-blue-500/20 text-blue-400 rounded text-xs font-medium">
                      {getLotteryTypeDisplay(winner.lotteryInstanceId)}
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-4 mt-1">
                    <p className="text-sm text-gray-400">
                      #{winner.lotteryInstanceId?.split('_').pop() || 'N/A'}
                    </p>
                    <div className="flex items-center space-x-1">
                      <Calendar className="w-3 h-3 text-gray-500" />
                      <p className="text-sm text-gray-500">
                        {formatTimeAgo(winner.createdAt)}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="text-right">
                <p className="font-bold text-yellow-400 text-lg">
                  {formatPrizeAmount(winner.prizeAmount)}
                </p>
                <p className="text-xs text-gray-400">
                  {getPositionText(winner.position)} Place
                </p>
                {winner.status === 'transferred' && (
                  <div className="flex items-center space-x-1 mt-1">
                    <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                    <span className="text-xs text-green-400">Transferred</span>
                  </div>
                )}
              </div>
              
              <div className="ml-4">
                <Eye className="w-4 h-4 text-gray-400" />
              </div>
            </div>

            {/* Expanded Details */}
            {expandedWinner === winner.id && (
              <div className="mt-2 p-4 bg-white/5 rounded-xl border border-white/10 animate-fadeIn">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-gray-400 mb-1">Lottery Details</p>
                    <p className="text-white font-medium">
                      {getLotteryTypeDisplay(winner.lotteryInstanceId)}
                    </p>
                    <p className="text-gray-500 text-xs">
                      Instance: {winner.lotteryInstanceId}
                    </p>
                  </div>
                  
                  <div>
                    <p className="text-gray-400 mb-1">Prize Breakdown</p>
                    <p className="text-yellow-400 font-medium">
                      {winner.prizeAmount.toFixed(4)} π gross
                    </p>
                    {winner.netPrizeAmount && (
                      <p className="text-green-400 text-xs">
                        {winner.netPrizeAmount.toFixed(4)} π net
                      </p>
                    )}
                  </div>
                  
                  <div>
                    <p className="text-gray-400 mb-1">Win Date</p>
                    <p className="text-white">
                      {winner.createdAt ? new Date(winner.createdAt.toDate()).toLocaleDateString() : 'N/A'}
                    </p>
                  </div>
                  
                  <div>
                    <p className="text-gray-400 mb-1">Status</p>
                    <div className="flex items-center space-x-2">
                      <div className={`w-2 h-2 rounded-full ${
                        winner.status === 'transferred' ? 'bg-green-400' : 
                        winner.status === 'pending' ? 'bg-yellow-400' : 'bg-gray-400'
                      }`}></div>
                      <span className={`text-xs capitalize ${
                        winner.status === 'transferred' ? 'text-green-400' : 
                        winner.status === 'pending' ? 'text-yellow-400' : 'text-gray-400'
                      }`}>
                        {winner.status || 'Unknown'}
                      </span>
                    </div>
                  </div>
                </div>

                {winner.transactionId && (
                  <div className="mt-3 pt-3 border-t border-white/10">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-gray-400">Transaction ID:</span>
                      <div className="flex items-center space-x-2">
                        <span className="text-xs text-gray-300 font-mono">
                          {winner.transactionId.substring(0, 16)}...
                        </span>
                        <button className="p-1 hover:bg-white/10 rounded transition-all duration-300">
                          <ExternalLink className="w-3 h-3 text-gray-400" />
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Celebration Effect for Recent Winners */}
            {animationIndex === index && winner.isRecent && (
              <div className="absolute top-0 left-0 w-full h-full pointer-events-none">
                <div className="absolute top-2 right-2 text-yellow-400 animate-bounce">
                  🎉
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Summary Stats */}
      <div className="mt-6 pt-4 border-t border-white/10">
        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <p className="text-2xl font-bold text-green-400">
              {winners.reduce((sum, winner) => sum + winner.prizeAmount, 0).toFixed(2)}
            </p>
            <p className="text-xs text-gray-400">Total Prizes</p>
          </div>
          
          <div>
            <p className="text-2xl font-bold text-blue-400">
              {new Set(winners.map(w => w.username)).size}
            </p>
            <p className="text-xs text-gray-400">Unique Winners</p>
          </div>
          
          <div>
            <p className="text-2xl font-bold text-purple-400">
              {new Set(winners.map(w => getLotteryTypeDisplay(w.lotteryInstanceId))).size}
            </p>
            <p className="text-xs text-gray-400">Lottery Types</p>
          </div>
        </div>
      </div>

      {/* View All Winners Link */}
      {winners.length > maxDisplay && !showPagination && (
        <div className="mt-4 text-center">
          <button className="text-sm text-blue-400 hover:text-blue-300 transition-colors duration-300">
            View All Winners →
          </button>
        </div>
      )}
    </div>
  );
};

export default WinnersList;
