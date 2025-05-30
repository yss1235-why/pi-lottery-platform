// ============================================
// Updated PiLotteryApp.js with Legal Consent Integration
// frontend/src/components/PiLotteryApp.js
// ============================================

import React, { useState, useEffect } from 'react';
import { Wallet, Trophy, Users, Clock, Coins, Star, History, Settings, TrendingUp, Play, AlertCircle, Shield } from 'lucide-react';
import { Link } from 'react-router-dom';
import { usePiAuth } from '../hooks/useAuth';
import { useLottery } from '../hooks/useLottery';
import { useLegalConsent } from '../hooks/useLegalConsent';
import LegalConsentModal from './LegalConsentModal';

const PiLotteryApp = () => {
  const { user, loading: authLoading, signIn, signOut, isAuthenticated, createPayment } = usePiAuth();
  const { lotteryTypes, lotteryInstances, recentWinners, loading: lotteryLoading, enterLottery, getUserStats } = useLottery();
  const { hasConsented, showConsentModal, acceptConsent, declineConsent } = useLegalConsent();
  
  const [userStats, setUserStats] = useState({
    totalEntries: 0,
    totalWinnings: 0,
    lotteriesWon: 0,
    winRate: 0
  });
  const [userBalance] = useState(45.7);
  const [isEntering, setIsEntering] = useState(false);
  const [watchingAd, setWatchingAd] = useState(false);
  const [adCooldown, setAdCooldown] = useState(0);
  const [userEntries, setUserEntries] = useState(0);

  useEffect(() => {
    if (isAuthenticated && user?.firebaseUser && hasConsented) {
      loadUserStats();
      loadUserEntries();
    }
  }, [isAuthenticated, user, hasConsented]);

  useEffect(() => {
    if (adCooldown > 0) {
      const timer = setTimeout(() => setAdCooldown(adCooldown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [adCooldown]);

  const loadUserStats = async () => {
    try {
      const stats = await getUserStats(user.firebaseUser.uid);
      setUserStats(stats);
    } catch (error) {
      console.error('Failed to load user stats:', error);
    }
  };

  const loadUserEntries = async () => {
    try {
      setUserEntries(2);
    } catch (error) {
      console.error('Failed to load user entries:', error);
    }
  };

  const handleConnect = async () => {
    if (!hasConsented) return;
    
    if (isAuthenticated) {
      await signOut();
    } else {
      try {
        await signIn();
      } catch (error) {
        console.error('Authentication failed:', error);
      }
    }
  };

  const handleLotteryEntry = async (lotteryTypeId) => {
    if (!isAuthenticated || !hasConsented) return;
    
    setIsEntering(true);
    try {
      const lotteryType = lotteryTypes[lotteryTypeId];
      
      if (lotteryTypeId === 'daily_ads') {
        await handleAdEntry(lotteryTypeId);
      } else {
        await handlePiPaymentEntry(lotteryTypeId, lotteryType);
      }
      
      await loadUserStats();
      await loadUserEntries();
    } catch (error) {
      console.error('Lottery entry failed:', error);
    } finally {
      setIsEntering(false);
    }
  };

  const handleAdEntry = async (lotteryTypeId) => {
    setWatchingAd(true);
    await new Promise(resolve => setTimeout(resolve, 30000));
    
    await enterLottery(lotteryTypeId, user.firebaseUser.uid, 'watch_ads', 1, {
      adCompletionId: `ad_${Date.now()}`
    });
    
    setAdCooldown(300);
    setWatchingAd(false);
  };

  const handlePiPaymentEntry = async (lotteryTypeId, lotteryType) => {
    const payment = await createPayment(
      lotteryType.entryFee,
      `Lottery entry: ${lotteryType.name}`,
      { lotteryTypeId, entryType: 'pi_payment' }
    );
    
    await enterLottery(lotteryTypeId, user.firebaseUser.uid, 'pi_payment', 1, {
      paymentId: payment.identifier
    });
  };

  const calculatePrizes = (participants, lotteryTypeId) => {
    const lotteryType = lotteryTypes[lotteryTypeId];
    if (!lotteryType) return {};

    let prizePool;
    if (lotteryTypeId === 'daily_ads') {
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

  const formatTimeLeft = (drawTime) => {
    if (!drawTime) return 'TBD';
    
    const now = new Date();
    const draw = drawTime.toDate ? drawTime.toDate() : new Date(drawTime);
    const diff = draw - now;
    
    if (diff <= 0) return 'Drawing soon';
    
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    
    return `${hours}h ${minutes}m`;
  };

  const formatAdCooldown = (seconds) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  // Show loading screen
  if (authLoading || lotteryLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 text-white flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-yellow-400 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-xl">Loading Pi Lottery Platform...</p>
        </div>
      </div>
    );
  }

  // Show consent requirement screen if not consented
  if (!hasConsented && !showConsentModal) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 text-white flex items-center justify-center">
        <div className="text-center max-w-md mx-4">
          <Shield className="w-16 h-16 text-blue-400 mx-auto mb-4" />
          <h2 className="text-2xl font-bold mb-4">Legal Agreement Required</h2>
          <p className="text-gray-400 mb-6">
            You must accept our Terms of Service and Privacy Policy to use the Pi Lottery platform.
          </p>
          <button
            onClick={() => window.location.reload()}
            className="bg-gradient-to-r from-blue-500 to-purple-600 text-white px-6 py-3 rounded-xl hover:from-blue-600 hover:to-purple-700 transition-all duration-300"
          >
            Review Legal Documents
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Legal Consent Modal */}
      <LegalConsentModal 
        isOpen={showConsentModal}
        onAccept={acceptConsent}
        onDecline={declineConsent}
      />

      {/* Main Application */}
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 text-white">
        <div className="container mx-auto px-4 py-6 max-w-6xl">
          
          {/* Header */}
          <header className="flex items-center justify-between mb-8 p-4 bg-white/5 backdrop-blur-lg rounded-2xl border border-white/10">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-gradient-to-r from-yellow-400 to-orange-500 rounded-full flex items-center justify-center">
                <Coins className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold">Pi Lottery</h1>
                <p className="text-sm text-gray-400">Decentralized • Transparent • Fair</p>
              </div>
            </div>
            
            <div className="flex items-center space-x-4">
              {isAuthenticated && (
                <div className="text-right">
                  <p className="text-sm text-gray-400">Welcome</p>
                  <p className="font-bold text-yellow-400">@{user?.piUser?.username}</p>
                </div>
              )}
              <button
                onClick={handleConnect}
                disabled={!hasConsented}
                className={`flex items-center space-x-2 px-4 py-2 rounded-xl font-medium transition-all duration-300 ${
                  !hasConsented
                    ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                    : isAuthenticated 
                    ? 'bg-green-500/20 text-green-400 border border-green-500/30' 
                    : 'bg-gradient-to-r from-yellow-500 to-orange-500 text-white hover:from-yellow-600 hover:to-orange-600'
                }`}
              >
                <Wallet className="w-5 h-5" />
                <span>{isAuthenticated ? 'Connected' : 'Connect Pi Wallet'}</span>
              </button>
            </div>
          </header>

          {/* Legal Compliance Notice */}
          {hasConsented && (
            <div className="mb-6 p-3 bg-blue-500/10 border border-blue-500/30 rounded-xl">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2 text-sm text-blue-300">
                  <Shield className="w-4 h-4" />
                  <span>You have accepted our legal terms</span>
                </div>
                <div className="flex items-center space-x-4 text-xs text-gray-400">
                  <Link to="/terms-of-service" className="hover:text-white transition-colors">
                    Terms of Service
                  </Link>
                  <Link to="/privacy-policy" className="hover:text-white transition-colors">
                    Privacy Policy
                  </Link>
                </div>
              </div>
            </div>
          )}

          <div className="grid lg:grid-cols-3 gap-8">
            
            {/* Main Lottery Section */}
            <div className="lg:col-span-2 space-y-6">
              
              {/* Active Lotteries */}
              {Object.entries(lotteryTypes).map(([typeId, lotteryType]) => {
                if (!lotteryType.isEnabled) return null;
                
                const instance = lotteryInstances[typeId];
                const prizes = calculatePrizes(instance?.participants || 0, typeId);
                const isAdLottery = typeId === 'daily_ads';
                
                return (
                  <div key={typeId} className="bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-lg rounded-3xl p-6 border border-white/10">
                    <div className="flex items-center justify-between mb-6">
                      <div className="flex items-center space-x-3">
                        <Trophy className="w-8 h-8 text-yellow-400" />
                        <div>
                          <h2 className="text-2xl font-bold">{lotteryType.name}</h2>
                          <p className="text-gray-400">#{instance?.id || 'TBD'}</p>
                        </div>
                      </div>
                      <div className={`px-3 py-1 rounded-full text-sm font-medium ${
                        isAdLottery ? 'bg-green-500/10 text-green-400' : 'bg-blue-500/10 text-blue-400'
                      }`}>
                        {isAdLottery ? 'Free Entry' : 'Pi Payment'}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-6 mb-6">
                      <div className="text-center p-4 bg-white/5 rounded-2xl">
                        <Users className="w-8 h-8 text-blue-400 mx-auto mb-2" />
                        <p className="text-2xl font-bold">{instance?.participants || 0}</p>
                        <p className="text-gray-400 text-sm">Participants</p>
                      </div>
                      <div className="text-center p-4 bg-white/5 rounded-2xl">
                        <Coins className="w-8 h-8 text-yellow-400 mx-auto mb-2" />
                        <p className="text-2xl font-bold">{(instance?.prizePool || 0).toFixed(4)} π</p>
                        <p className="text-gray-400 text-sm">Prize Pool</p>
                      </div>
                    </div>

                    <div className="flex items-center justify-between p-4 bg-gradient-to-r from-red-500/20 to-orange-500/20 rounded-2xl mb-6">
                      <div className="flex items-center space-x-2">
                        <Clock className="w-5 h-5 text-orange-400" />
                        <span className="font-medium">Drawing in: {formatTimeLeft(instance?.scheduledDrawTime)}</span>
                      </div>
                      {isAuthenticated && (
                        <div className="text-sm text-gray-300">
                          Your entries: <span className="font-bold text-yellow-400">{userEntries}</span>
                        </div>
                      )}
                    </div>

                    {/* Ad Lottery Specific UI */}
                    {isAdLottery && (
                      <div className="mb-6">
                        {watchingAd ? (
                          <div className="p-4 bg-blue-500/20 rounded-2xl text-center">
                            <div className="w-8 h-8 border-4 border-blue-400 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
                            <p className="text-blue-300">Watching Advertisement...</p>
                            <p className="text-sm text-gray-400">Please keep this window active</p>
                          </div>
                        ) : adCooldown > 0 ? (
                          <div className="p-4 bg-orange-500/20 rounded-2xl text-center">
                            <AlertCircle className="w-8 h-8 text-orange-400 mx-auto mb-2" />
                            <p className="text-orange-300">Ad Cooldown: {formatAdCooldown(adCooldown)}</p>
                            <p className="text-sm text-gray-400">Wait before watching another ad</p>
                          </div>
                        ) : null}
                      </div>
                    )}

                    <button
                      onClick={() => handleLotteryEntry(typeId)}
                      disabled={!isAuthenticated || !hasConsented || isEntering || (isAdLottery && (watchingAd || adCooldown > 0))}
                      className={`w-full py-4 rounded-2xl font-bold text-lg transition-all duration-300 ${
                        !isAuthenticated || !hasConsented || (isAdLottery && (watchingAd || adCooldown > 0))
                          ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                          : isEntering
                          ? 'bg-yellow-600 text-white'
                          : 'bg-gradient-to-r from-yellow-500 to-orange-500 text-white hover:from-yellow-600 hover:to-orange-600 transform hover:scale-105'
                      }`}
                    >
                      {!hasConsented ? 'Accept Terms Required' :
                       isEntering ? 'Processing Entry...' : 
                       isAdLottery ? (
                         watchingAd ? 'Watching Ad...' :
                         adCooldown > 0 ? `Cooldown ${formatAdCooldown(adCooldown)}` :
                         'Watch Ad for Free Entry'
                       ) : 
                       `Enter Lottery (${lotteryType.entryFee} π)`}
                    </button>
                    
                    {!isAuthenticated && (
                      <p className="text-center text-gray-400 text-sm mt-2">Connect your Pi wallet to participate</p>
                    )}
                    
                    {!hasConsented && (
                      <p className="text-center text-orange-400 text-sm mt-2">
                        Please accept our <Link to="/terms-of-service" className="underline">Terms</Link> and <Link to="/privacy-policy" className="underline">Privacy Policy</Link> first
                      </p>
                    )}

                    {/* Prize Distribution */}
                    <div className="mt-6">
                      <h3 className="text-lg font-bold mb-3 flex items-center">
                        <Star className="w-5 h-5 text-yellow-400 mr-2" />
                        Prize Distribution
                      </h3>
                      <div className="grid gap-2">
                        {Object.entries(prizes).map(([position, amount], index) => (
                          <div key={position} className="flex items-center justify-between p-2 bg-white/5 rounded-lg">
                            <div className="flex items-center space-x-2">
                              <div className={`w-6 h-6 rounded-full flex items-center justify-center font-bold text-xs ${
                                index === 0 ? 'bg-yellow-500 text-white' :
                                index === 1 ? 'bg-gray-400 text-white' :
                                index === 2 ? 'bg-orange-600 text-white' :
                                'bg-blue-500 text-white'
                              }`}>
                                {index + 1}
                              </div>
                              <span className="text-sm capitalize">{position} Prize</span>
                            </div>
                            <span className="font-bold text-yellow-400 text-sm">{amount.toFixed(4)} π</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Sidebar */}
            <div className="space-y-6">
              
              {/* Recent Winners */}
              <div className="bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-lg rounded-3xl p-6 border border-white/10">
                <h3 className="text-xl font-bold mb-4 flex items-center">
                  <TrendingUp className="w-6 h-6 text-green-400 mr-2" />
                  Recent Winners
                </h3>
                <div className="space-y-3">
                  {recentWinners.slice(0, 3).map((winner, index) => (
                    <div key={index} className="flex items-center justify-between p-3 bg-white/5 rounded-xl">
                      <div>
                        <p className="font-medium">@{winner.username}</p>
                        <p className="text-sm text-gray-400">#{winner.lotteryInstanceId?.split('_').pop()}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-yellow-400">{winner.prizeAmount} π</p>
                        <p className="text-xs text-gray-400">{winner.position === 1 ? '1st' : winner.position === 2 ? '2nd' : '3rd'} Place</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* User Statistics */}
              {isAuthenticated && hasConsented && (
                <div className="bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-lg rounded-3xl p-6 border border-white/10">
                  <h3 className="text-xl font-bold mb-4 flex items-center">
                    <History className="w-6 h-6 text-purple-400 mr-2" />
                    Your Stats
                  </h3>
                  <div className="space-y-4">
                    <div className="flex justify-between">
                      <span className="text-gray-400">Total Entries</span>
                      <span className="font-bold">{userStats.totalEntries}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Lotteries Won</span>
                      <span className="font-bold text-green-400">{userStats.lotteriesWon}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Total Winnings</span>
                      <span className="font-bold text-yellow-400">{userStats.totalWinnings.toFixed(3)} π</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Win Rate</span>
                      <span className="font-bold">{(userStats.winRate * 100).toFixed(1)}%</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default PiLotteryApp;
