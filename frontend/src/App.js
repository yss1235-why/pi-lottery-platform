import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Wallet, Trophy, Users, Clock, Coins, Star, History, Settings, TrendingUp, Play, AlertCircle, Shield } from 'lucide-react';
import { usePiAuth } from './hooks/useAuth';
import { useLottery } from './hooks/useLottery';
import AdminPanel from './components/AdminPanel';
import { checkFirebaseConnection } from './config/firebase';
import { performanceMonitor } from './utils/monitoring';

// Error Boundary Component
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    this.setState({
      error: error,
      errorInfo: errorInfo
    });
    
    // Log error to monitoring service
    performanceMonitor.logError(error, { 
      component: 'ErrorBoundary',
      errorInfo: errorInfo 
    });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-red-900 to-slate-900 text-white flex items-center justify-center">
          <div className="text-center max-w-md mx-4">
            <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <AlertCircle className="w-8 h-8 text-red-400" />
            </div>
            <h2 className="text-2xl font-bold mb-4">Something went wrong</h2>
            <p className="text-gray-400 mb-6">
              We're sorry, but something unexpected happened. Please refresh the page and try again.
            </p>
            <button
              onClick={() => window.location.reload()}
              className="px-6 py-3 bg-gradient-to-r from-red-500 to-red-600 text-white rounded-xl hover:from-red-600 hover:to-red-700 transition-all duration-300"
            >
              Refresh Page
            </button>
            {process.env.NODE_ENV === 'development' && (
              <details className="mt-6 text-left">
                <summary className="cursor-pointer text-gray-400 hover:text-white">
                  Error Details (Development)
                </summary>
                <pre className="mt-2 p-4 bg-black/50 rounded-lg text-xs overflow-auto">
                  {this.state.error && this.state.error.toString()}
                  <br />
                  {this.state.errorInfo.componentStack}
                </pre>
              </details>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

// Main Lottery Interface Component
const MainLotteryInterface = () => {
  const { user, loading: authLoading, signIn, signOut, isAuthenticated, createPayment } = usePiAuth();
  const { lotteryTypes, lotteryInstances, recentWinners, loading: lotteryLoading, enterLottery, getUserStats } = useLottery();
  
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
  const [connectionStatus, setConnectionStatus] = useState('checking');

  useEffect(() => {
    // Check Firebase connection on app start
    checkConnection();
    
    if (isAuthenticated && user?.firebaseUser) {
      loadUserStats();
      loadUserEntries();
    }
  }, [isAuthenticated, user]);

  useEffect(() => {
    if (adCooldown > 0) {
      const timer = setTimeout(() => setAdCooldown(adCooldown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [adCooldown]);

  const checkConnection = async () => {
    try {
      const status = await checkFirebaseConnection();
      setConnectionStatus(status.status);
    } catch (error) {
      setConnectionStatus('error');
      performanceMonitor.logError(error, { component: 'MainLotteryInterface', action: 'checkConnection' });
    }
  };

  const loadUserStats = async () => {
    const measureLoad = performanceMonitor.measureLoadTime('UserStats');
    try {
      const stats = await getUserStats(user.firebaseUser.uid);
      setUserStats(stats);
      measureLoad();
    } catch (error) {
      console.error('Failed to load user stats:', error);
      performanceMonitor.logError(error, { component: 'MainLotteryInterface', action: 'loadUserStats' });
      measureLoad();
    }
  };

  const loadUserEntries = async () => {
    try {
      // Implementation for loading current user entries
      setUserEntries(2); // Placeholder
    } catch (error) {
      console.error('Failed to load user entries:', error);
      performanceMonitor.logError(error, { component: 'MainLotteryInterface', action: 'loadUserEntries' });
    }
  };

  const handleConnect = async () => {
    const measureAPI = performanceMonitor.measureAPICall('Authentication');
    
    if (isAuthenticated) {
      try {
        await signOut();
        performanceMonitor.logUserAction('user_signout');
        measureAPI(true);
      } catch (error) {
        console.error('Sign out failed:', error);
        measureAPI(false, error);
      }
    } else {
      try {
        await signIn();
        performanceMonitor.logUserAction('user_signin');
        measureAPI(true);
      } catch (error) {
        console.error('Authentication failed:', error);
        performanceMonitor.logError(error, { component: 'MainLotteryInterface', action: 'handleConnect' });
        measureAPI(false, error);
      }
    }
  };

  const handleLotteryEntry = async (lotteryTypeId) => {
    if (!isAuthenticated) return;
    
    const measureAPI = performanceMonitor.measureAPICall('LotteryEntry');
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
      
      performanceMonitor.logUserAction('lottery_entry', { lotteryType: lotteryTypeId });
      measureAPI(true);
    } catch (error) {
      console.error('Lottery entry failed:', error);
      performanceMonitor.logError(error, { component: 'MainLotteryInterface', action: 'handleLotteryEntry', lotteryType: lotteryTypeId });
      measureAPI(false, error);
    } finally {
      setIsEntering(false);
    }
  };

  const handleAdEntry = async (lotteryTypeId) => {
    setWatchingAd(true);
    
    // Simulate ad watching process
    await new Promise(resolve => setTimeout(resolve, 30000)); // 30 second ad
    
    await enterLottery(lotteryTypeId, user.firebaseUser.uid, 'watch_ads', 1, {
      adCompletionId: `ad_${Date.now()}`
    });
    
    setAdCooldown(300); // 5 minute cooldown
    setWatchingAd(false);
    
    performanceMonitor.logUserAction('ad_watched', { lotteryType: lotteryTypeId });
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

  // Connection error state
  if (connectionStatus === 'error') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-red-900 to-slate-900 text-white flex items-center justify-center">
        <div className="text-center max-w-md mx-4">
          <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="w-8 h-8 text-red-400" />
          </div>
          <h2 className="text-2xl font-bold mb-4">Connection Error</h2>
          <p className="text-gray-400 mb-6">
            Unable to connect to Pi Lottery services. Please check your internet connection and try again.
          </p>
          <button
            onClick={checkConnection}
            className="px-6 py-3 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-xl hover:from-blue-600 hover:to-blue-700 transition-all duration-300"
          >
            Retry Connection
          </button>
        </div>
      </div>
    );
  }

  // Loading state
  if (authLoading || lotteryLoading || connectionStatus === 'checking') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 text-white flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-yellow-400 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-xl">Loading Pi Lottery Platform...</p>
          <p className="text-sm text-gray-400 mt-2">Connecting to services...</p>
        </div>
      </div>
    );
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
            {isAuthenticated && (
              <div className="text-right">
                <p className="text-sm text-gray-400">Welcome</p>
                <p className="font-bold text-yellow-400">@{user?.piUser?.username}</p>
              </div>
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
            
            {/* Active Lotteries */}
            {Object.entries(lotteryTypes).map(([typeId, lotteryType]) => {
              if (!lotteryType.isEnabled) return null;
              
              const instance = lotteryInstances[typeId];
              const prizes = calculatePrizes(instance?.participants || 0, typeId);
              const isAdLottery = typeId === 'daily_ads';
              
              return (
                <div key={typeId} className="lottery-card">
                  <div className="lottery-card-header">
                    <div className="lottery-card-title">
                      <Trophy className="w-8 h-8 text-yellow-400" />
                      <div>
                        <h2 className="text-2xl font-bold">{lotteryType.name}</h2>
                        <p className="text-gray-400">#{instance?.id || 'TBD'}</p>
                      </div>
                    </div>
                    <div className={`lottery-card-badge ${isAdLottery ? 'lottery-card-badge--ads' : 'lottery-card-badge--pi'}`}>
                      {isAdLottery ? 'Free Entry' : 'Pi Payment'}
                    </div>
                  </div>

                  <div className="lottery-card-stats">
                    <div className="lottery-stat-card">
                      <Users className="w-8 h-8 text-blue-400 mx-auto mb-2" />
                      <p className="text-2xl font-bold">{instance?.participants || 0}</p>
                      <p className="text-gray-400 text-sm">Participants</p>
                    </div>
                    <div className="lottery-stat-card">
                      <Coins className="w-8 h-8 text-yellow-400 mx-auto mb-2" />
                      <p className="text-2xl font-bold">{(instance?.prizePool || 0).toFixed(4)} π</p>
                      <p className="text-gray-400 text-sm">Prize Pool</p>
                    </div>
                  </div>

                  <div className="lottery-countdown">
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
                        <div className="ad-watch-container">
                          <div className="ad-watch-spinner"></div>
                          <p className="ad-watch-text">Watching Advertisement...</p>
                          <p className="ad-watch-subtitle">Please keep this window active</p>
                        </div>
                      ) : adCooldown > 0 ? (
                        <div className="ad-cooldown-container">
                          <AlertCircle className="ad-cooldown-icon" />
                          <p className="ad-cooldown-text">Ad Cooldown: {formatAdCooldown(adCooldown)}</p>
                          <p className="text-sm text-gray-400">Wait before watching another ad</p>
                        </div>
                      ) : null}
                    </div>
                  )}

                  <button
                    onClick={() => handleLotteryEntry(typeId)}
                    disabled={!isAuthenticated || isEntering || (isAdLottery && (watchingAd || adCooldown > 0))}
                    className={`lottery-entry-button ${
                      !isAuthenticated || (isAdLottery && (watchingAd || adCooldown > 0))
                        ? 'lottery-entry-button--disabled'
                        : isEntering
                        ? 'lottery-entry-button--processing'
                        : 'lottery-entry-button--primary'
                    }`}
                  >
                    {isEntering ? 'Processing Entry...' : 
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

                  {/* Prize Distribution */}
                  <div className="prize-distribution">
                    <h3 className="prize-distribution-header">
                      <Star className="w-5 h-5 text-yellow-400 mr-2" />
                      Prize Distribution
                    </h3>
                    <div className="grid gap-2">
                      {Object.entries(prizes).map(([position, amount], index) => (
                        <div key={position} className="prize-row">
                          <div className="flex items-center space-x-2">
                            <div className={`prize-position ${
                              index === 0 ? 'prize-position--first' :
                              index === 1 ? 'prize-position--second' :
                              index === 2 ? 'prize-position--third' :
                              'prize-position--other'
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
            <div className="card">
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
            {isAuthenticated && (
              <div className="card">
                <h3 className="text-xl font-bold mb-4 flex items-center">
                  <History className="w-6 h-6 text-purple-400 mr-2" />
                  Your Stats
                </h3>
                <div className="stats-grid">
                  <div className="stats-row">
                    <span className="stats-label">Total Entries</span>
                    <span className="stats-value stats-value--normal">{userStats.totalEntries}</span>
                  </div>
                  <div className="stats-row">
                    <span className="stats-label">Lotteries Won</span>
                    <span className="stats-value stats-value--success">{userStats.lotteriesWon}</span>
                  </div>
                  <div className="stats-row">
                    <span className="stats-label">Total Winnings</span>
                    <span className="stats-value stats-value--primary">{userStats.totalWinnings.toFixed(3)} π</span>
                  </div>
                  <div className="stats-row">
                    <span className="stats-label">Win Rate</span>
                    <span className="stats-value stats-value--normal">{(userStats.winRate * 100).toFixed(1)}%</span>
                  </div>
                </div>
              </div>
            )}

            {/* Quick Actions */}
            <div className="card">
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
    </div>
  );
};

// Main App Component
function App() {
  useEffect(() => {
    // Log app initialization
    performanceMonitor.logUserAction('app_initialized', {
      timestamp: Date.now(),
      userAgent: navigator.userAgent,
      screenResolution: `${screen.width}x${screen.height}`
    });
  }, []);

  return (
    <ErrorBoundary>
      <Router>
        <div className="App">
          <Routes>
            <Route path="/" element={<MainLotteryInterface />} />
            <Route path="/admin" element={<AdminPanel />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </div>
      </Router>
    </ErrorBoundary>
  );
}

export default App;
