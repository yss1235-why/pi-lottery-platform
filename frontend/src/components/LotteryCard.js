import React, { useState, useEffect } from 'react';
import { Trophy, Users, Clock, Coins, Star, Play, AlertCircle, CheckCircle, Eye } from 'lucide-react';
import PrizeDistribution from './PrizeDistribution';

const LotteryCard = ({ 
  lotteryTypeId, 
  lotteryType, 
  instance, 
  onEnterLottery, 
  isAuthenticated, 
  isEntering, 
  userEntries = 0,
  userTicketLimits = {},
  className = ''
}) => {
  const [showPrizeDistribution, setShowPrizeDistribution] = useState(false);
  const [timeLeft, setTimeLeft] = useState('');
  const [participationStatus, setParticipationStatus] = useState('eligible');
  const [adCooldown, setAdCooldown] = useState(0);

  const isAdLottery = lotteryTypeId === 'daily_ads';
  const maxTickets = lotteryType.maxTicketsPerUser;
  const usedTickets = userTicketLimits[`${lotteryTypeId}_used`] || 0;
  const remainingTickets = Math.max(0, maxTickets - usedTickets);

  useEffect(() => {
    if (instance?.scheduledDrawTime) {
      const timer = setInterval(() => {
        const timeRemaining = calculateTimeLeft(instance.scheduledDrawTime);
        setTimeLeft(timeRemaining);
      }, 1000);

      return () => clearInterval(timer);
    }
  }, [instance?.scheduledDrawTime]);

  useEffect(() => {
    if (adCooldown > 0) {
      const timer = setTimeout(() => setAdCooldown(adCooldown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [adCooldown]);

  useEffect(() => {
    updateParticipationStatus();
  }, [isAuthenticated, remainingTickets, adCooldown]);

  const calculateTimeLeft = (drawTime) => {
    if (!drawTime) return 'TBD';
    
    const now = new Date();
    const draw = drawTime.toDate ? drawTime.toDate() : new Date(drawTime);
    const diff = draw - now;
    
    if (diff <= 0) return 'Drawing soon';
    
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    
    if (days > 0) return `${days}d ${hours}h ${minutes}m`;
    return `${hours}h ${minutes}m`;
  };

  const updateParticipationStatus = () => {
    if (!isAuthenticated) {
      setParticipationStatus('not_authenticated');
    } else if (remainingTickets <= 0) {
      setParticipationStatus('limit_reached');
    } else if (isAdLottery && adCooldown > 0) {
      setParticipationStatus('cooldown');
    } else if (instance?.participants >= (instance?.maxParticipants || Infinity)) {
      setParticipationStatus('full');
    } else {
      setParticipationStatus('eligible');
    }
  };

  const calculatePrizes = () => {
    const participants = instance?.participants || 0;
    let prizePool;
    
    if (isAdLottery) {
      prizePool = participants * (lotteryType.adValue || 0.001);
    } else {
      prizePool = participants * (lotteryType.entryFee - lotteryType.platformFee);
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
        sixth: prizePool * 0.08
      };
    }
  };

  const getEntryButtonText = () => {
    if (isEntering) return 'Processing Entry...';
    
    switch (participationStatus) {
      case 'not_authenticated':
        return 'Connect Wallet to Enter';
      case 'limit_reached':
        return `Daily Limit Reached (${maxTickets}/${maxTickets})`;
      case 'cooldown':
        return `Cooldown: ${Math.floor(adCooldown / 60)}:${(adCooldown % 60).toString().padStart(2, '0')}`;
      case 'full':
        return 'Lottery Full';
      default:
        return isAdLottery ? 'Watch Ad for Free Entry' : `Enter Lottery (${lotteryType.entryFee} π)`;
    }
  };

  const getEntryButtonStyle = () => {
    if (participationStatus === 'eligible') {
      return isEntering
        ? 'bg-yellow-600 text-white cursor-wait'
        : 'bg-gradient-to-r from-yellow-500 to-orange-500 text-white hover:from-yellow-600 hover:to-orange-600 transform hover:scale-105';
    }
    return 'bg-gray-600 text-gray-400 cursor-not-allowed';
  };

  const getLotteryTypeColor = () => {
    switch (lotteryTypeId) {
      case 'daily_pi':
        return 'from-yellow-500 to-orange-500';
      case 'daily_ads':
        return 'from-green-500 to-emerald-500';
      case 'weekly_pi':
        return 'from-blue-500 to-indigo-500';
      case 'monthly_pi':
        return 'from-purple-500 to-pink-500';
      default:
        return 'from-gray-500 to-slate-500';
    }
  };

  const handleEntryClick = () => {
    if (participationStatus === 'eligible') {
      const entryMethod = isAdLottery ? 'watch_ads' : 'pi_payment';
      onEnterLottery(lotteryTypeId, entryMethod);
    }
  };

  const prizes = calculatePrizes();

  return (
    <div className={`bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-lg rounded-3xl p-6 border border-white/10 transition-all duration-300 hover:border-white/20 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-3">
          <div className={`w-12 h-12 bg-gradient-to-r ${getLotteryTypeColor()} rounded-full flex items-center justify-center`}>
            <Trophy className="w-7 h-7 text-white" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-white">{lotteryType.name}</h2>
            <p className="text-gray-400 text-sm">#{instance?.id || 'Preparing...'}</p>
          </div>
        </div>
        
        <div className="flex items-center space-x-2">
          <div className={`px-3 py-1 rounded-full text-xs font-medium ${
            isAdLottery 
              ? 'bg-green-500/20 text-green-400 border border-green-500/30' 
              : 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
          }`}>
            {isAdLottery ? 'Free Entry' : 'Pi Payment'}
          </div>
          
          {lotteryTypeId.includes('daily') && (
            <div className="px-3 py-1 rounded-full text-xs font-medium bg-orange-500/20 text-orange-400 border border-orange-500/30">
              Daily
            </div>
          )}
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="text-center p-4 bg-white/5 rounded-2xl border border-white/10">
          <Users className="w-8 h-8 text-blue-400 mx-auto mb-2" />
          <p className="text-2xl font-bold text-white">{instance?.participants || 0}</p>
          <p className="text-gray-400 text-sm">Participants</p>
          {instance?.minParticipants && (
            <p className="text-xs text-gray-500">Min: {instance.minParticipants}</p>
          )}
        </div>
        
        <div className="text-center p-4 bg-white/5 rounded-2xl border border-white/10">
          <Coins className="w-8 h-8 text-yellow-400 mx-auto mb-2" />
          <p className="text-2xl font-bold text-yellow-400">{(instance?.prizePool || 0).toFixed(4)} π</p>
          <p className="text-gray-400 text-sm">Prize Pool</p>
        </div>
        
        <div className="text-center p-4 bg-white/5 rounded-2xl border border-white/10">
          <Clock className="w-8 h-8 text-orange-400 mx-auto mb-2" />
          <p className="text-lg font-bold text-orange-400">{timeLeft}</p>
          <p className="text-gray-400 text-sm">Time Left</p>
        </div>
        
        <div className="text-center p-4 bg-white/5 rounded-2xl border border-white/10">
          <Star className="w-8 h-8 text-purple-400 mx-auto mb-2" />
          <p className="text-lg font-bold text-purple-400">{remainingTickets}/{maxTickets}</p>
          <p className="text-gray-400 text-sm">Your Tickets</p>
        </div>
      </div>

      {/* Drawing Status */}
      <div className="flex items-center justify-between p-4 bg-gradient-to-r from-red-500/20 to-orange-500/20 rounded-2xl mb-6 border border-orange-500/30">
        <div className="flex items-center space-x-2">
          <Clock className="w-5 h-5 text-orange-400" />
          <span className="font-medium text-orange-200">
            {timeLeft === 'Drawing soon' ? 'Drawing in progress...' : `Drawing in: ${timeLeft}`}
          </span>
        </div>
        
        {isAuthenticated && (
          <div className="flex items-center space-x-2">
            {usedTickets > 0 && (
              <div className="flex items-center space-x-1">
                <CheckCircle className="w-4 h-4 text-green-400" />
                <span className="text-sm text-green-400">{usedTickets} entered</span>
              </div>
            )}
            
            {remainingTickets > 0 && (
              <div className="text-sm text-gray-300">
                {remainingTickets} left
              </div>
            )}
          </div>
        )}
      </div>

      {/* Ad Lottery Specific Status */}
      {isAdLottery && adCooldown > 0 && (
        <div className="p-4 bg-orange-500/20 rounded-2xl mb-6 border border-orange-500/30">
          <div className="flex items-center space-x-2">
            <AlertCircle className="w-5 h-5 text-orange-400" />
            <span className="text-orange-300">
              Ad Cooldown: {Math.floor(adCooldown / 60)}:{(adCooldown % 60).toString().padStart(2, '0')}
            </span>
          </div>
          <p className="text-sm text-gray-400 mt-1">Wait before watching another advertisement</p>
        </div>
      )}

      {/* Entry Button */}
      <button
        onClick={handleEntryClick}
        disabled={participationStatus !== 'eligible' || isEntering}
        className={`w-full py-4 rounded-2xl font-bold text-lg transition-all duration-300 mb-6 ${getEntryButtonStyle()}`}
      >
        <div className="flex items-center justify-center space-x-2">
          {isEntering ? (
            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
          ) : (
            <Play className="w-5 h-5" />
          )}
          <span>{getEntryButtonText()}</span>
        </div>
      </button>
      
      {/* Help Text */}
      {!isAuthenticated && (
        <p className="text-center text-gray-400 text-sm mb-6">
          Connect your Pi wallet to participate in this lottery
        </p>
      )}
      
      {participationStatus === 'limit_reached' && (
        <p className="text-center text-orange-400 text-sm mb-6">
          You've reached the daily ticket limit for this lottery. Try again tomorrow!
        </p>
      )}

      {/* Prize Distribution Toggle */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-bold flex items-center">
          <Star className="w-5 h-5 text-yellow-400 mr-2" />
          Prize Distribution
        </h3>
        <button
          onClick={() => setShowPrizeDistribution(!showPrizeDistribution)}
          className="flex items-center space-x-1 px-3 py-1 bg-white/5 hover:bg-white/10 rounded-lg transition-all duration-300"
        >
          <Eye className="w-4 h-4" />
          <span className="text-sm">{showPrizeDistribution ? 'Hide' : 'Show'}</span>
        </button>
      </div>

      {/* Prize Distribution */}
      {showPrizeDistribution && (
        <PrizeDistribution 
          prizes={prizes} 
          participants={instance?.participants || 0}
          lotteryTypeId={lotteryTypeId}
        />
      )}

      {/* Lottery Details */}
      <div className="mt-6 pt-4 border-t border-white/10">
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-gray-400">Entry Fee</p>
            <p className="font-semibold text-white">
              {isAdLottery ? 'Watch 30s Ad' : `${lotteryType.entryFee} π`}
            </p>
          </div>
          <div>
            <p className="text-gray-400">Max Tickets/User</p>
            <p className="font-semibold text-white">{maxTickets}</p>
          </div>
          <div>
            <p className="text-gray-400">Min Participants</p>
            <p className="font-semibold text-white">{lotteryType.minParticipants}</p>
          </div>
          <div>
            <p className="text-gray-400">Draw Frequency</p>
            <p className="font-semibold text-white">
              {lotteryTypeId.includes('daily') ? 'Daily' : 
               lotteryTypeId.includes('weekly') ? 'Weekly' : 'Monthly'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LotteryCard;
