import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Wallet, Coins, Settings, History, Bell } from 'lucide-react';
import { usePiAuth } from '../hooks/useAuth';
import { useLottery } from '../hooks/useLottery';
import { useRealTimeUpdates } from '../hooks/useRealTimeUpdates';
import AdminPanel from './AdminPanel';
import LotteryCard from './LotteryCard';
import WinnersList from './WinnersList';
import UserStats from './UserStats';
import ConnectionStatus from './ConnectionStatus';
import PaymentModal from './PaymentModal';
import AdWatchModal from './AdWatchModal';
import LoadingSpinner from './LoadingSpinner';
import ErrorBoundary from './ErrorBoundary';

const PiLotteryApp = () => {
  const { user, loading: authLoading, signIn, signOut, isAuthenticated, createPayment } = usePiAuth();
  const { lotteryTypes, lotteryInstances, recentWinners, loading: lotteryLoading, enterLottery, getUserStats } = useLottery();
  const { connectionStatus, notifications } = useRealTimeUpdates();
  
  const [userStats, setUserStats] = useState({
    totalEntries: 0,
    totalWinnings: 0,
    lotteriesWon: 0,
    winRate: 0
  });
  
  const [isEntering, setIsEntering] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showAdModal, setShowAdModal] = useState(false);
  const [selectedLottery, setSelectedLottery] = useState(null);
  const [userBalance] = useState(45.7);
  const [showNotifications, setShowNotifications] = useState(false);

  useEffect(() => {
    if (isAuthenticated && user?.firebaseUser) {
      loadUserStats();
    }
  }, [isAuthenticated, user]);

  const loadUserStats = async () => {
    try {
      const stats = await getUserStats(user.firebaseUser.uid);
      setUserStats(stats);
    } catch (error) {
      console.error('Failed to load user stats:', error);
    }
  };

  const handleConnect = async () => {
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

  const handleLotteryEntry = async (lotteryTypeId, entryMethod = 'pi_payment') => {
    if (!isAuthenticated) return;
    
    const lotteryType = lotteryTypes[lotteryTypeId];
    setSelectedLottery({ typeId: lotteryTypeId, type: lotteryType });
    
    if (entryMethod === 'watch_ads') {
      setShowAdModal(true);
    } else {
      setShowPaymentModal(true);
    }
  };

  const handlePaymentConfirm = async (paymentData) => {
    setIsEntering(true);
    try {
      await enterLottery(
        selectedLottery.typeId, 
        user.firebaseUser.uid, 
        'pi_payment', 
        1, 
        paymentData
      );
      
      await loadUserStats();
      setShowPaymentModal(false);
    } catch (error) {
      console.error('Payment entry failed:', error);
    } finally {
      setIsEntering(false);
    }
  };

  const handleAdComplete = async (adData) => {
    setIsEntering(true);
    try {
      await enterLottery(
        selectedLottery.typeId,
        user.firebaseUser.uid,
        'watch_ads',
        1,
        { adCompletionId: adData.completionId }
      );
      
      await loadUserStats();
      setShowAdModal(false);
    } catch (error) {
      console.error('Ad entry failed:', error);
    } finally {
      setIsEntering(false);
    }
  };

  const MainLotteryInterface = () => {
    if (authLoading || lotteryLoading) {
      return <LoadingSpinner message="Loading Pi Lottery Platform..." />;
    }

    return (
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
              <ConnectionStatus status={connectionStatus} />
              
              {isAuthenticated && (
                <>
                  <div className="relative">
                    <button
                      onClick={() => setShowNotifications(!showNotifications)}
                      className="p-2 bg-white/5 hover:bg-white/10 rounded-xl transition-all duration-300 relative"
                    >
                      <Bell className="w-5 h-5" />
                      {notifications.length > 0 && (
                        <div className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full"></div>
                      )}
                    </button>
                    
                    {showNotifications && (
                      <div className="absolute right-0 top-12 w-80 bg-slate-800 border border-white/20 rounded-xl p-4 shadow-xl z-50">
                        <h3 className="font-bold mb-3">Notifications</h3>
                        {notifications.length === 0 ? (
                          <p className="text-gray-400 text-sm">No new notifications</p>
                        ) : (
                          <div className="space-y-2">
                            {notifications.slice(0, 5).map((notification, index) => (
                              <div key={index} className="p-2 bg-white/5 rounded-lg text-sm">
                                {notification.message}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  
                  <div className="text-right">
                    <p className="text-sm text-gray-400">Welcome</p>
                    <p className="font-bold text-yellow-400">@{user?.piUser?.username}</p>
                    <p className="text-xs text-gray-500">{userBalance.toFixed(2)} π</p>
                  </div>
                </>
              )}
              
              <button
                onClick={handleConnect}
                className={`flex items-center space-x-2 px-4 py-2 rounded-xl font-medium transition-all duration-300 ${
                  isAuthenticated 
                    ? 'bg-green-500/20 text-green-400 border border-green-500/30' 
                    : 'bg-gradient-to-r from-yellow-500 to-orange-500 text-white hover:from-yellow-600 hover:to-orange-600'
                }`}
              >
                <Wallet className="w-5 h-5" />
                <span>{isAuthenticated ? 'Connected' : 'Connect Pi Wallet'}</span>
              </button>
            </div>
          </header>

          <div className="grid lg:grid-cols-3 gap-8">
            
            {/* Main Lottery Section */}
            <div className="lg:col-span-2 space-y-6">
              {Object.entries(lotteryTypes).map(([typeId, lotteryType]) => {
                if (!lotteryType.isEnabled) return null;
                
                const instance = lotteryInstances[typeId];
                
                return (
                  <LotteryCard
                    key={typeId}
                    lotteryTypeId={typeId}
                    lotteryType={lotteryType}
                    instance={instance}
                    onEnterLottery={handleLotteryEntry}
                    isAuthenticated={isAuthenticated}
                    isEntering={isEntering}
                    userEntries={userStats.totalEntries}
                  />
                );
              })}
            </div>

            {/* Sidebar */}
            <div className="space-y-6">
              <WinnersList winners={recentWinners} />
              
              {isAuthenticated && (
                <UserStats stats={userStats} />
              )}

              {/* Quick Actions */}
              <div className="bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-lg rounded-3xl p-6 border border-white/10">
                <h3 className="text-xl font-bold mb-4">Quick Actions</h3>
                <div className="space-y-3">
                  <button className="w-full p-3 bg-white/5 hover:bg-white/10 rounded-xl text-left transition-all duration-300 flex items-center space-x-3">
                    <History className="w-5 h-5 text-gray-400" />
                    <span>Lottery History</span>
                  </button>
                  <button className="w-full p-3 bg-white/5 hover:bg-white/10 rounded-xl text-left transition-all duration-300 flex items-center space-x-3">
                    <Settings className="w-5 h-5 text-gray-400" />
                    <span>Settings</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Modals */}
        {showPaymentModal && selectedLottery && (
          <PaymentModal
            lotteryType={selectedLottery.type}
            onConfirm={handlePaymentConfirm}
            onCancel={() => setShowPaymentModal(false)}
            createPayment={createPayment}
            isProcessing={isEntering}
          />
        )}

        {showAdModal && selectedLottery && (
          <AdWatchModal
            lotteryType={selectedLottery.type}
            onComplete={handleAdComplete}
            onCancel={() => setShowAdModal(false)}
            isProcessing={isEntering}
          />
        )}
      </div>
    );
  };

  return (
    <ErrorBoundary>
      <Router>
        <Routes>
          <Route path="/" element={<MainLotteryInterface />} />
          <Route path="/admin" element={<AdminPanel />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Router>
    </ErrorBoundary>
  );
};

export default PiLotteryApp;
