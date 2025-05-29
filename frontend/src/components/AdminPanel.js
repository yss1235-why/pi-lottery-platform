import React, { useState, useEffect } from 'react';
import { 
  Settings, DollarSign, Users, Trophy, TrendingUp, AlertCircle, 
  Check, Save, History, Eye, Edit3, Shield, Clock, Bell, 
  BarChart3, Calendar, Download, Upload, Search 
} from 'lucide-react';
import { useAdminAuth } from '../hooks/useAdminAuth';
import { useAdmin } from '../hooks/useAdmin';
import LoadingSpinner from './LoadingSpinner';
import ConfirmationModal from './ConfirmationModal';
import ErrorBoundary from './ErrorBoundary';

const AdminPanel = () => {
  const { admin, loading, signIn, signOut, isAdmin, hasPermission } = useAdminAuth();
  const { 
    platformConfig, 
    systemStats, 
    pendingWinners, 
    revenueData,
    updatePlatformConfig,
    approvePrize,
    generateReport,
    getSystemLogs
  } = useAdmin();
  
  const [activeTab, setActiveTab] = useState('dashboard');
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [confirmAction, setConfirmAction] = useState(null);
  const [loginForm, setLoginForm] = useState({ email: '', password: '' });
  const [loginError, setLoginError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [reportType, setReportType] = useState('revenue');
  const [dateRange, setDateRange] = useState('30');

  // Configuration state management
  const [configChanges, setConfigChanges] = useState({});

  useEffect(() => {
    if (isAdmin) {
      loadAdminData();
    }
  }, [isAdmin]);

  const loadAdminData = async () => {
    try {
      // Load admin-specific data
      console.log('Loading admin data...');
    } catch (error) {
      console.error('Failed to load admin data:', error);
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoginError('');
    
    try {
      await signIn(loginForm.email, loginForm.password);
    } catch (error) {
      setLoginError(error.message);
    }
  };

  const handleLogout = async () => {
    await signOut();
  };

  const handleConfigChange = (section, key, value) => {
    setConfigChanges(prev => ({
      ...prev,
      [`${section}.${key}`]: value
    }));
    setHasUnsavedChanges(true);
  };

  const handleSaveConfiguration = () => {
    setConfirmAction({
      type: 'save_config',
      title: 'Confirm Configuration Changes',
      message: 'Are you sure you want to save these configuration changes? This will affect platform operations immediately.',
      onConfirm: async () => {
        try {
          await updatePlatformConfig(configChanges);
          setConfigChanges({});
          setHasUnsavedChanges(false);
          setShowConfirmModal(false);
        } catch (error) {
          console.error('Failed to save configuration:', error);
        }
      }
    });
    setShowConfirmModal(true);
  };

  const handlePrizeApproval = (winnerId, prizeAmount) => {
    setConfirmAction({
      type: 'approve_prize',
      title: 'Confirm Prize Transfer',
      message: `Transfer ${prizeAmount.toFixed(4)} π to winner? This action cannot be undone.`,
      onConfirm: async () => {
        try {
          await approvePrize(winnerId);
          setShowConfirmModal(false);
        } catch (error) {
          console.error('Prize approval failed:', error);
        }
      }
    });
    setShowConfirmModal(true);
  };

  const handleGenerateReport = async () => {
    try {
      const report = await generateReport(reportType, dateRange);
      // Trigger download
      const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${reportType}_report_${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Report generation failed:', error);
    }
  };

  if (loading) {
    return <LoadingSpinner message="Loading Admin Panel..." />;
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 text-white flex items-center justify-center">
        <div className="max-w-md w-full mx-4">
          <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-8 border border-white/10">
            <div className="text-center mb-6">
              <Shield className="w-16 h-16 text-blue-400 mx-auto mb-4" />
              <h1 className="text-2xl font-bold">Pi Lottery Admin</h1>
              <p className="text-gray-400">Secure administrative access</p>
            </div>
            
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Email</label>
                <input
                  type="email"
                  value={loginForm.email}
                  onChange={(e) => setLoginForm(prev => ({ ...prev, email: e.target.value }))}
                  className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:border-blue-400"
                  placeholder="admin@pilottery.app"
                  required
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Password</label>
                <input
                  type="password"
                  value={loginForm.password}
                  onChange={(e) => setLoginForm(prev => ({ ...prev, password: e.target.value }))}
                  className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:border-blue-400"
                  placeholder="Enter admin password"
                  required
                />
              </div>
              
              {loginError && (
                <div className="p-3 bg-red-500/20 border border-red-500/30 rounded-xl text-red-300 text-sm">
                  {loginError}
                </div>
              )}
              
              <button
                type="submit"
                className="w-full py-3 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-xl hover:from-blue-600 hover:to-blue-700 transition-all duration-300 font-medium"
              >
                Sign In
              </button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  const tabs = [
    { id: 'dashboard', label: 'Dashboard', icon: TrendingUp, permission: null },
    { id: 'lotteries', label: 'Lottery Management', icon: Trophy, permission: 'manage_lotteries' },
    { id: 'prizes', label: 'Prize Confirmations', icon: Check, permission: 'approve_prizes' },
    { id: 'settings', label: 'System Settings', icon: Settings, permission: 'system_config' },
    { id: 'users', label: 'User Management', icon: Users, permission: 'user_management' },
    { id: 'reports', label: 'Reports', icon: BarChart3, permission: 'view_analytics' }
  ].filter(tab => !tab.permission || hasPermission(tab.permission));

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 text-white">
        <div className="container mx-auto px-4 py-6 max-w-7xl">
          
          {/* Header */}
          <header className="flex items-center justify-between mb-8 p-4 bg-white/5 backdrop-blur-lg rounded-2xl border border-white/10">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
                <Shield className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold">Pi Lottery Admin Panel</h1>
                <p className="text-sm text-gray-400">Platform Management & Configuration</p>
              </div>
            </div>
            
            <div className="flex items-center space-x-4">
              {hasUnsavedChanges && (
                <div className="flex items-center space-x-2 px-3 py-1 bg-orange-500/20 rounded-lg border border-orange-500/30">
                  <AlertCircle className="w-4 h-4 text-orange-400" />
                  <span className="text-sm text-orange-400">Unsaved changes</span>
                </div>
              )}
              
              <div className="text-right">
                <p className="text-sm text-gray-400">Logged in as</p>
                <p className="font-bold text-blue-400">{admin?.email}</p>
              </div>
              
              <button
                onClick={handleLogout}
                className="px-4 py-2 bg-red-500/20 hover:bg-red-500/30 border border-red-500/30 rounded-xl transition-all duration-300"
              >
                Sign Out
              </button>
            </div>
          </header>

          {/* Navigation Tabs */}
          <div className="flex flex-wrap gap-1 mb-6 p-1 bg-white/5 rounded-xl backdrop-blur-lg border border-white/10">
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center space-x-2 px-4 py-2 rounded-lg transition-all duration-300 ${
                  activeTab === tab.id 
                    ? 'bg-blue-500/30 text-blue-300 border border-blue-500/50' 
                    : 'hover:bg-white/5 text-gray-400'
                }`}
              >
                <tab.icon className="w-4 h-4" />
                <span>{tab.label}</span>
              </button>
            ))}
          </div>

          {/* Dashboard Tab */}
          {activeTab === 'dashboard' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {[
                  { 
                    label: 'Total Revenue', 
                    value: `${systemStats?.totalRevenue || 0} π`, 
                    color: 'text-green-400', 
                    bg: 'bg-green-500/10', 
                    icon: DollarSign,
                    change: '+12.5%'
                  },
                  { 
                    label: 'Active Users', 
                    value: systemStats?.activeUsers || 0, 
                    color: 'text-blue-400', 
                    bg: 'bg-blue-500/10', 
                    icon: Users,
                    change: '+8.3%'
                  },
                  { 
                    label: 'Active Lotteries', 
                    value: systemStats?.activeLotteries || 0, 
                    color: 'text-purple-400', 
                    bg: 'bg-purple-500/10', 
                    icon: Trophy,
                    change: '0%'
                  },
                  { 
                    label: 'Pending Prizes', 
                    value: pendingWinners?.length || 0, 
                    color: 'text-yellow-400', 
                    bg: 'bg-yellow-500/10', 
                    icon: Clock,
                    change: '-2'
                  }
                ].map((stat, index) => (
                  <div key={index} className={`p-6 rounded-2xl ${stat.bg} border border-white/10`}>
                    <div className="flex items-center justify-between mb-2">
                      <stat.icon className={`w-6 h-6 ${stat.color}`} />
                      <span className={`text-xs px-2 py-1 rounded ${
                        stat.change.startsWith('+') ? 'bg-green-500/20 text-green-400' : 
                        stat.change.startsWith('-') ? 'bg-red-500/20 text-red-400' :
                        'bg-gray-500/20 text-gray-400'
                      }`}>
                        {stat.change}
                      </span>
                    </div>
                    <p className={`text-2xl font-bold ${stat.color} mb-1`}>{stat.value}</p>
                    <p className="text-sm text-gray-400">{stat.label}</p>
                  </div>
                ))}
              </div>
              
              <div className="grid lg:grid-cols-2 gap-6">
                <div className="bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-lg rounded-3xl p-6 border border-white/10">
                  <h3 className="text-xl font-bold mb-4">System Health</h3>
                  <div className="space-y-4">
                    {[
                      { metric: 'API Response Time', value: '45ms', status: 'good' },
                      { metric: 'Database Performance', value: '98%', status: 'good' },
                      { metric: 'Error Rate', value: '0.1%', status: 'good' },
                      { metric: 'Uptime', value: '99.9%', status: 'excellent' }
                    ].map(item => (
                      <div key={item.metric} className="flex items-center justify-between p-3 bg-white/5 rounded-xl">
                        <span className="text-gray-300">{item.metric}</span>
                        <div className="flex items-center space-x-2">
                          <span className="font-medium">{item.value}</span>
                          <div className={`w-2 h-2 rounded-full ${
                            item.status === 'excellent' ? 'bg-green-400' :
                            item.status === 'good' ? 'bg-blue-400' :
                            'bg-yellow-400'
                          }`}></div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                
                <div className="bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-lg rounded-3xl p-6 border border-white/10">
                  <h3 className="text-xl font-bold mb-4">Recent Activity</h3>
                  <div className="space-y-3">
                    {[
                      { action: 'Prize transferred', user: '@PiUser123', amount: '45.0 π', time: '2 min ago' },
                      { action: 'New lottery created', user: 'System', amount: 'Daily Pi', time: '1 hour ago' },
                      { action: 'Config updated', user: admin?.email, amount: 'Fee: 0.1π', time: '3 hours ago' }
                    ].map((activity, index) => (
                      <div key={index} className="flex items-center justify-between p-3 bg-white/5 rounded-xl">
                        <div>
                          <p className="font-medium text-sm">{activity.action}</p>
                          <p className="text-xs text-gray-400">{activity.user} • {activity.time}</p>
                        </div>
                        <span className="text-sm font-medium text-yellow-400">{activity.amount}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Prize Confirmations Tab */}
          {activeTab === 'prizes' && hasPermission('approve_prizes') && (
            <div className="space-y-6">
              <div className="bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-lg rounded-3xl p-6 border border-white/10">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-xl font-bold flex items-center">
                    <Check className="w-6 h-6 text-green-400 mr-2" />
                    Pending Prize Confirmations
                  </h3>
                  <div className="flex items-center space-x-2">
                    <input
                      type="text"
                      placeholder="Search winners..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-blue-400"
                    />
                    <Search className="w-5 h-5 text-gray-400" />
                  </div>
                </div>
                
                <div className="space-y-4">
                  {pendingWinners?.filter(winner => 
                    !searchTerm || winner.username.toLowerCase().includes(searchTerm.toLowerCase())
                  ).map(winner => {
                    const transactionFee = 0.01;
                    const netPrize = Math.max(0, winner.prizeAmount - transactionFee);
                    
                    return (
                      <div key={winner.id} className="flex items-center justify-between p-4 bg-white/5 rounded-xl border border-white/10">
                        <div className="flex items-center space-x-4">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${
                            winner.position === 1 ? 'bg-yellow-500 text-white' :
                            winner.position === 2 ? 'bg-gray-400 text-white' :
                            'bg-orange-600 text-white'
                          }`}>
                            {winner.position}
                          </div>
                          <div>
                            <p className="font-medium">@{winner.username}</p>
                            <p className="text-sm text-gray-400">Lottery #{winner.lotteryInstanceId}</p>
                            <p className="text-xs text-gray-500">{new Date(winner.createdAt).toLocaleString()}</p>
                          </div>
                        </div>
                        
                        <div className="flex items-center space-x-4">
                          <div className="text-right">
                            <div className="space-y-1">
                              <p className="font-bold text-yellow-400">{winner.prizeAmount.toFixed(4)} π</p>
                              <p className="text-xs text-red-300">- {transactionFee.toFixed(2)} π (tx fee)</p>
                              <div className="border-t border-gray-600 pt-1">
                                <p className="font-bold text-green-400">{netPrize.toFixed(4)} π net</p>
                              </div>
                            </div>
                          </div>
                          
                          <button
                            onClick={() => handlePrizeApproval(winner.id, netPrize)}
                            className="flex items-center space-x-2 px-4 py-2 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-xl hover:from-green-600 hover:to-emerald-700 transition-all duration-300"
                          >
                            <Check className="w-4 h-4" />
                            <span>Transfer {netPrize.toFixed(4)} π</span>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Reports Tab */}
          {activeTab === 'reports' && hasPermission('view_analytics') && (
            <div className="space-y-6">
              <div className="bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-lg rounded-3xl p-6 border border-white/10">
                <h3 className="text-xl font-bold mb-4 flex items-center">
                  <BarChart3 className="w-6 h-6 text-purple-400 mr-2" />
                  System Reports
                </h3>
                
                <div className="grid md:grid-cols-3 gap-4 mb-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Report Type</label>
                    <select
                      value={reportType}
                      onChange={(e) => setReportType(e.target.value)}
                      className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-xl text-white focus:outline-none focus:border-blue-400"
                    >
                      <option value="revenue">Revenue Report</option>
                      <option value="users">User Activity Report</option>
                      <option value="lotteries">Lottery Performance</option>
                      <option value="system">System Health Report</option>
                    </select>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Date Range</label>
                    <select
                      value={dateRange}
                      onChange={(e) => setDateRange(e.target.value)}
                      className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-xl text-white focus:outline-none focus:border-blue-400"
                    >
                      <option value="7">Last 7 days</option>
                      <option value="30">Last 30 days</option>
                      <option value="90">Last 90 days</option>
                      <option value="365">Last year</option>
                    </select>
                  </div>
                  
                  <div className="flex items-end">
                    <button
                      onClick={handleGenerateReport}
                      className="w-full flex items-center justify-center space-x-2 px-4 py-2 bg-gradient-to-r from-purple-500 to-indigo-600 text-white rounded-xl hover:from-purple-600 hover:to-indigo-700 transition-all duration-300"
                    >
                      <Download className="w-4 h-4" />
                      <span>Generate Report</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Settings Tab */}
          {activeTab === 'settings' && hasPermission('system_config') && (
            <div className="space-y-6">
              <div className="bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-lg rounded-3xl p-6 border border-white/10">
                <h3 className="text-xl font-bold mb-4 flex items-center">
                  <Settings className="w-6 h-6 text-blue-400 mr-2" />
                  Platform Configuration
                </h3>
                
                <div className="grid lg:grid-cols-2 gap-8">
                  <div>
                    <h4 className="font-semibold mb-4">Fee Configuration</h4>
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">
                          Platform Fee (π per ticket)
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          max="0.5"
                          defaultValue={platformConfig?.platformFee || 0.1}
                          onChange={(e) => handleConfigChange('fees', 'platformFee', parseFloat(e.target.value))}
                          className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-xl text-white focus:outline-none focus:border-blue-400"
                        />
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">
                          Ad Value (π per ticket)
                        </label>
                        <input
                          type="number"
                          step="0.001"
                          min="0"
                          max="0.1"
                          defaultValue={platformConfig?.adValue || 0.001}
                          onChange={(e) => handleConfigChange('fees', 'adValue', parseFloat(e.target.value))}
                          className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-xl text-white focus:outline-none focus:border-blue-400"
                        />
                      </div>
                    </div>
                  </div>
                  
                  <div>
                    <h4 className="font-semibold mb-4">Lottery Controls</h4>
                    <div className="space-y-3">
                      {['daily_pi', 'daily_ads', 'weekly_pi', 'monthly_pi'].map(lotteryType => (
                        <div key={lotteryType} className="flex items-center justify-between p-3 bg-white/5 rounded-xl">
                          <span className="font-medium">{lotteryType.replace('_', ' ').toUpperCase()}</span>
                          <button
                            onClick={() => handleConfigChange('lotteries', lotteryType, !platformConfig?.lotteries?.[lotteryType])}
                            className={`relative w-12 h-6 rounded-full transition-all duration-300 ${
                              platformConfig?.lotteries?.[lotteryType] ? 'bg-green-500' : 'bg-gray-600'
                            }`}
                          >
                            <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform duration-300 ${
                              platformConfig?.lotteries?.[lotteryType] ? 'translate-x-6' : 'translate-x-0.5'
                            }`}></div>
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
                
                <div className="flex space-x-4 mt-8">
                  <button
                    onClick={handleSaveConfiguration}
                    disabled={!hasUnsavedChanges}
                    className={`flex items-center space-x-2 px-6 py-3 rounded-xl font-medium transition-all duration-300 ${
                      hasUnsavedChanges
                        ? 'bg-gradient-to-r from-green-500 to-emerald-600 text-white hover:from-green-600 hover:to-emerald-700'
                        : 'bg-gray-600 text-gray-400 cursor-not-allowed'
                    }`}
                  >
                    <Save className="w-4 h-4" />
                    <span>Save Configuration</span>
                  </button>
                  
                  <button
                    onClick={() => {
                      setConfigChanges({});
                      setHasUnsavedChanges(false);
                    }}
                    disabled={!hasUnsavedChanges}
                    className={`px-6 py-3 rounded-xl font-medium transition-all duration-300 ${
                      hasUnsavedChanges
                        ? 'bg-white/10 hover:bg-white/20 border border-white/20'
                        : 'bg-gray-600 text-gray-400 cursor-not-allowed'
                    }`}
                  >
                    Reset Changes
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Confirmation Modal */}
        {showConfirmModal && confirmAction && (
          <ConfirmationModal
            title={confirmAction.title}
            message={confirmAction.message}
            onConfirm={confirmAction.onConfirm}
            onCancel={() => setShowConfirmModal(false)}
            confirmText="Confirm"
            cancelText="Cancel"
            type={confirmAction.type}
          />
        )}
      </div>
    </ErrorBoundary>
  );
};

export default AdminPanel;
