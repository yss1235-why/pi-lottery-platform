import React, { useState, useEffect } from 'react';
import { 
  Wifi, WifiOff, AlertTriangle, CheckCircle, 
  Clock, Zap, Shield, Cloud, Smartphone 
} from 'lucide-react';

const ConnectionStatus = ({ 
  status = 'connected', 
  showDetails = false,
  className = '',
  onStatusClick = null
}) => {
  const [expanded, setExpanded] = useState(false);
  const [lastUpdate, setLastUpdate] = useState(new Date());
  const [connectionDetails, setConnectionDetails] = useState({
    piNetwork: 'connected',
    firebase: 'connected',
    internet: 'connected',
    latency: 45,
    region: 'US-East',
    lastSync: new Date()
  });

  useEffect(() => {
    const interval = setInterval(() => {
      setLastUpdate(new Date());
      // Simulate connection monitoring
      updateConnectionDetails();
    }, 30000); // Update every 30 seconds

    return () => clearInterval(interval);
  }, []);

  const updateConnectionDetails = () => {
    // Simulate connection status updates
    setConnectionDetails(prev => ({
      ...prev,
      latency: Math.floor(Math.random() * 50) + 30,
      lastSync: new Date()
    }));
  };

  const getStatusIcon = (statusType = status) => {
    switch (statusType) {
      case 'connected':
        return <CheckCircle className="w-4 h-4 text-green-400" />;
      case 'connecting':
        return <Clock className="w-4 h-4 text-yellow-400 animate-pulse" />;
      case 'disconnected':
        return <WifiOff className="w-4 h-4 text-red-400" />;
      case 'unstable':
        return <AlertTriangle className="w-4 h-4 text-orange-400" />;
      default:
        return <Wifi className="w-4 h-4 text-gray-400" />;
    }
  };

  const getStatusColor = (statusType = status) => {
    switch (statusType) {
      case 'connected':
        return 'text-green-400 border-green-500/30 bg-green-500/10';
      case 'connecting':
        return 'text-yellow-400 border-yellow-500/30 bg-yellow-500/10';
      case 'disconnected':
        return 'text-red-400 border-red-500/30 bg-red-500/10';
      case 'unstable':
        return 'text-orange-400 border-orange-500/30 bg-orange-500/10';
      default:
        return 'text-gray-400 border-gray-500/30 bg-gray-500/10';
    }
  };

  const getStatusText = (statusType = status) => {
    switch (statusType) {
      case 'connected':
        return 'Connected';
      case 'connecting':
        return 'Connecting...';
      case 'disconnected':
        return 'Disconnected';
      case 'unstable':
        return 'Unstable';
      default:
        return 'Unknown';
    }
  };

  const getLatencyColor = (latency) => {
    if (latency < 50) return 'text-green-400';
    if (latency < 100) return 'text-yellow-400';
    if (latency < 200) return 'text-orange-400';
    return 'text-red-400';
  };

  const formatTimeAgo = (date) => {
    const now = new Date();
    const diffMs = now - date;
    const diffSecs = Math.floor(diffMs / 1000);
    const diffMins = Math.floor(diffSecs / 60);

    if (diffSecs < 60) return `${diffSecs}s ago`;
    if (diffMins < 60) return `${diffMins}m ago`;
    return date.toLocaleTimeString();
  };

  const handleStatusClick = () => {
    if (onStatusClick) {
      onStatusClick(status);
    } else if (showDetails) {
      setExpanded(!expanded);
    }
  };

  const renderBasicStatus = () => (
    <button
      onClick={handleStatusClick}
      className={`flex items-center space-x-2 px-3 py-1.5 rounded-lg border transition-all duration-300 hover:bg-white/5 ${getStatusColor()}`}
      title={`Connection Status: ${getStatusText()}`}
    >
      {getStatusIcon()}
      <span className="text-sm font-medium">{getStatusText()}</span>
      {status === 'connecting' && (
        <div className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin opacity-60"></div>
      )}
    </button>
  );

  const renderDetailedStatus = () => (
    <div className={`${className}`}>
      <button
        onClick={handleStatusClick}
        className={`flex items-center space-x-2 px-3 py-2 rounded-lg border transition-all duration-300 hover:bg-white/5 ${getStatusColor()}`}
      >
        {getStatusIcon()}
        <div className="flex-1 text-left">
          <div className="text-sm font-medium">{getStatusText()}</div>
          <div className="text-xs opacity-75">
            {connectionDetails.latency}ms • {formatTimeAgo(lastUpdate)}
          </div>
        </div>
      </button>

      {expanded && (
        <div className="mt-2 p-4 bg-white/5 border border-white/10 rounded-xl">
          <h4 className="font-semibold text-white mb-3">Connection Details</h4>
          
          <div className="space-y-3">
            {/* Pi Network Status */}
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Smartphone className="w-4 h-4 text-yellow-400" />
                <span className="text-sm text-gray-300">Pi Network</span>
              </div>
              <div className="flex items-center space-x-2">
                {getStatusIcon(connectionDetails.piNetwork)}
                <span className={`text-sm ${getStatusColor(connectionDetails.piNetwork).split(' ')[0]}`}>
                  {getStatusText(connectionDetails.piNetwork)}
                </span>
              </div>
            </div>

            {/* Firebase Status */}
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Cloud className="w-4 h-4 text-blue-400" />
                <span className="text-sm text-gray-300">Firebase</span>
              </div>
              <div className="flex items-center space-x-2">
                {getStatusIcon(connectionDetails.firebase)}
                <span className={`text-sm ${getStatusColor(connectionDetails.firebase).split(' ')[0]}`}>
                  {getStatusText(connectionDetails.firebase)}
                </span>
              </div>
            </div>

            {/* Internet Connection */}
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Wifi className="w-4 h-4 text-green-400" />
                <span className="text-sm text-gray-300">Internet</span>
              </div>
              <div className="flex items-center space-x-2">
                {getStatusIcon(connectionDetails.internet)}
                <span className={`text-sm ${getStatusColor(connectionDetails.internet).split(' ')[0]}`}>
                  {getStatusText(connectionDetails.internet)}
                </span>
              </div>
            </div>

            {/* Performance Metrics */}
            <div className="border-t border-white/10 pt-3 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Zap className="w-4 h-4 text-purple-400" />
                  <span className="text-sm text-gray-300">Latency</span>
                </div>
                <span className={`text-sm font-medium ${getLatencyColor(connectionDetails.latency)}`}>
                  {connectionDetails.latency}ms
                </span>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Shield className="w-4 h-4 text-blue-400" />
                  <span className="text-sm text-gray-300">Region</span>
                </div>
                <span className="text-sm text-white font-medium">
                  {connectionDetails.region}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Clock className="w-4 h-4 text-gray-400" />
                  <span className="text-sm text-gray-300">Last Sync</span>
                </div>
                <span className="text-sm text-gray-400">
                  {formatTimeAgo(connectionDetails.lastSync)}
                </span>
              </div>
            </div>

            {/* Status Messages */}
            {status === 'disconnected' && (
              <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 mt-3">
                <div className="flex items-start space-x-2">
                  <AlertTriangle className="w-4 h-4 text-red-400 mt-0.5" />
                  <div>
                    <p className="text-sm text-red-300 font-medium">Connection Lost</p>
                    <p className="text-xs text-red-200 mt-1">
                      Attempting to reconnect... Please check your internet connection.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {status === 'unstable' && (
              <div className="bg-orange-500/10 border border-orange-500/20 rounded-lg p-3 mt-3">
                <div className="flex items-start space-x-2">
                  <AlertTriangle className="w-4 h-4 text-orange-400 mt-0.5" />
                  <div>
                    <p className="text-sm text-orange-300 font-medium">Unstable Connection</p>
                    <p className="text-xs text-orange-200 mt-1">
                      Connection quality is poor. Some features may be limited.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {status === 'connected' && connectionDetails.latency < 50 && (
              <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-3 mt-3">
                <div className="flex items-start space-x-2">
                  <CheckCircle className="w-4 h-4 text-green-400 mt-0.5" />
                  <div>
                    <p className="text-sm text-green-300 font-medium">Excellent Connection</p>
                    <p className="text-xs text-green-200 mt-1">
                      All systems operating optimally with low latency.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );

  const renderPulsingStatus = () => (
    <div className={`flex items-center space-x-2 px-2 py-1 rounded-full ${getStatusColor()}`}>
      <div className="relative">
        {getStatusIcon()}
        {status === 'connected' && (
          <div className="absolute -inset-1">
            <div className="w-6 h-6 border border-green-400/50 rounded-full animate-ping"></div>
          </div>
        )}
      </div>
      {showDetails && (
        <span className="text-xs font-medium">{getStatusText()}</span>
      )}
    </div>
  );

  // Render different variants based on props
  if (showDetails) {
    return renderDetailedStatus();
  }

  if (status === 'connecting') {
    return renderPulsingStatus();
  }

  return renderBasicStatus();
};

// Connection Status Hook for easy integration
export const useConnectionStatus = () => {
  const [status, setStatus] = useState('connected');
  const [details, setDetails] = useState({
    piNetwork: 'connected',
    firebase: 'connected',
    internet: 'connected',
    latency: 45
  });

  useEffect(() => {
    const checkConnection = async () => {
      try {
        // Check internet connectivity
        const response = await fetch('/api/health', { 
          method: 'HEAD',
          cache: 'no-cache'
        });
        
        if (response.ok) {
          setStatus('connected');
          setDetails(prev => ({ ...prev, internet: 'connected' }));
        } else {
          setStatus('unstable');
          setDetails(prev => ({ ...prev, internet: 'unstable' }));
        }
      } catch (error) {
        setStatus('disconnected');
        setDetails(prev => ({ ...prev, internet: 'disconnected' }));
      }
    };

    // Check connection immediately and then every 30 seconds
    checkConnection();
    const interval = setInterval(checkConnection, 30000);

    // Listen for online/offline events
    const handleOnline = () => setStatus('connected');
    const handleOffline = () => setStatus('disconnected');

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      clearInterval(interval);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return { status, details };
};

export default ConnectionStatus;
