import React, { useState, useEffect } from 'react';
import { 
  Loader2, Coins, Trophy, Zap, Shield, Cloud, 
  Smartphone, Wifi, RefreshCw, Clock, CheckCircle,
  AlertCircle, Stars, Sparkles
} from 'lucide-react';

const LoadingSpinner = ({ 
  size = 'medium', 
  variant = 'default',
  message = '',
  submessage = '',
  progress = null,
  showIcon = true,
  fullScreen = false,
  overlay = false,
  className = '',
  animated = true,
  timeout = null,
  onTimeout = null
}) => {
  const [dots, setDots] = useState('');
  const [currentStep, setCurrentStep] = useState(0);
  const [timeoutReached, setTimeoutReached] = useState(false);

  const loadingSteps = [
    'Initializing connection...',
    'Authenticating with Pi Network...',
    'Loading lottery data...',
    'Syncing with blockchain...',
    'Almost ready...'
  ];

  useEffect(() => {
    if (animated) {
      const interval = setInterval(() => {
        setDots(prev => prev.length >= 3 ? '' : prev + '.');
      }, 500);
      return () => clearInterval(interval);
    }
  }, [animated]);

  useEffect(() => {
    if (message && loadingSteps.includes(message)) {
      const interval = setInterval(() => {
        setCurrentStep(prev => (prev + 1) % loadingSteps.length);
      }, 2000);
      return () => clearInterval(interval);
    }
  }, [message]);

  useEffect(() => {
    if (timeout) {
      const timer = setTimeout(() => {
        setTimeoutReached(true);
        if (onTimeout) onTimeout();
      }, timeout);
      return () => clearTimeout(timer);
    }
  }, [timeout, onTimeout]);

  const getSizeClasses = () => {
    switch (size) {
      case 'small':
        return {
          spinner: 'w-4 h-4',
          container: 'p-2',
          text: 'text-sm',
          icon: 'w-5 h-5'
        };
      case 'large':
        return {
          spinner: 'w-12 h-12',
          container: 'p-8',
          text: 'text-xl',
          icon: 'w-16 h-16'
        };
      case 'xlarge':
        return {
          spinner: 'w-16 h-16',
          container: 'p-12',
          text: 'text-2xl',
          icon: 'w-20 h-20'
        };
      default: // medium
        return {
          spinner: 'w-8 h-8',
          container: 'p-6',
          text: 'text-lg',
          icon: 'w-12 h-12'
        };
    }
  };

  const getVariantStyles = () => {
    switch (variant) {
      case 'pi':
        return {
          primary: 'text-yellow-400',
          secondary: 'text-orange-400',
          bg: 'bg-gradient-to-br from-yellow-500/10 to-orange-500/10',
          border: 'border-yellow-500/20',
          icon: Coins
        };
      case 'success':
        return {
          primary: 'text-green-400',
          secondary: 'text-emerald-400',
          bg: 'bg-gradient-to-br from-green-500/10 to-emerald-500/10',
          border: 'border-green-500/20',
          icon: CheckCircle
        };
      case 'warning':
        return {
          primary: 'text-yellow-400',
          secondary: 'text-orange-400',
          bg: 'bg-gradient-to-br from-yellow-500/10 to-orange-500/10',
          border: 'border-yellow-500/20',
          icon: AlertCircle
        };
      case 'lottery':
        return {
          primary: 'text-purple-400',
          secondary: 'text-pink-400',
          bg: 'bg-gradient-to-br from-purple-500/10 to-pink-500/10',
          border: 'border-purple-500/20',
          icon: Trophy
        };
      case 'network':
        return {
          primary: 'text-blue-400',
          secondary: 'text-cyan-400',
          bg: 'bg-gradient-to-br from-blue-500/10 to-cyan-500/10',
          border: 'border-blue-500/20',
          icon: Wifi
        };
      case 'auth':
        return {
          primary: 'text-indigo-400',
          secondary: 'text-purple-400',
          bg: 'bg-gradient-to-br from-indigo-500/10 to-purple-500/10',
          border: 'border-indigo-500/20',
          icon: Shield
        };
      case 'sync':
        return {
          primary: 'text-cyan-400',
          secondary: 'text-blue-400',
          bg: 'bg-gradient-to-br from-cyan-500/10 to-blue-500/10',
          border: 'border-cyan-500/20',
          icon: RefreshCw
        };
      default:
        return {
          primary: 'text-white',
          secondary: 'text-gray-300',
          bg: 'bg-gradient-to-br from-white/5 to-white/10',
          border: 'border-white/10',
          icon: Loader2
        };
    }
  };

  const renderSpinner = () => {
    const sizes = getSizeClasses();
    const styles = getVariantStyles();
    const SpinnerIcon = styles.icon;

    if (variant === 'pi') {
      return (
        <div className="relative">
          <div className={`${sizes.spinner} ${styles.primary} animate-spin`}>
            <Coins className="w-full h-full" />
          </div>
          <div className="absolute inset-0 animate-ping">
            <Coins className={`${sizes.spinner} ${styles.secondary} opacity-20`} />
          </div>
        </div>
      );
    }

    if (variant === 'lottery') {
      return (
        <div className="relative">
          <Trophy className={`${sizes.spinner} ${styles.primary} animate-bounce`} />
          <div className="absolute -inset-2 animate-pulse">
            <Stars className={`${sizes.icon} ${styles.secondary} opacity-30`} />
          </div>
        </div>
      );
    }

    if (variant === 'sync') {
      return (
        <RefreshCw className={`${sizes.spinner} ${styles.primary} animate-spin`} />
      );
    }

    return (
      <SpinnerIcon className={`${sizes.spinner} ${styles.primary} animate-spin`} />
    );
  };

  const renderProgressBar = () => {
    if (progress === null) return null;

    const styles = getVariantStyles();
    
    return (
      <div className="w-full mt-4">
        <div className="flex justify-between text-sm mb-2">
          <span className="text-gray-400">Progress</span>
          <span className={styles.primary}>{Math.round(progress)}%</span>
        </div>
        <div className="w-full bg-white/10 rounded-full h-2">
          <div 
            className={`h-2 rounded-full bg-gradient-to-r from-${styles.primary.replace('text-', '')} to-${styles.secondary.replace('text-', '')} transition-all duration-500`}
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
    );
  };

  const renderContent = () => {
    const sizes = getSizeClasses();
    const styles = getVariantStyles();

    return (
      <div className={`text-center ${sizes.container}`}>
        {showIcon && (
          <div className="flex justify-center mb-4">
            {renderSpinner()}
          </div>
        )}
        
        {message && (
          <h3 className={`font-semibold ${styles.primary} ${sizes.text} mb-2`}>
            {message}{animated && dots}
          </h3>
        )}
        
        {submessage && (
          <p className={`${styles.secondary} text-sm opacity-80`}>
            {submessage}
          </p>
        )}

        {renderProgressBar()}

        {timeoutReached && (
          <div className="mt-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
            <div className="flex items-center space-x-2">
              <Clock className="w-4 h-4 text-red-400" />
              <span className="text-red-300 text-sm">Loading is taking longer than expected...</span>
            </div>
          </div>
        )}
      </div>
    );
  };

  if (fullScreen) {
    const styles = getVariantStyles();
    
    return (
      <div className={`fixed inset-0 ${styles.bg} backdrop-blur-lg flex items-center justify-center z-50 ${className}`}>
        <div className={`${styles.bg} border ${styles.border} rounded-3xl shadow-2xl max-w-md w-full mx-4`}>
          {renderContent()}
        </div>
      </div>
    );
  }

  if (overlay) {
    const styles = getVariantStyles();
    
    return (
      <div className={`absolute inset-0 ${styles.bg} backdrop-blur-sm flex items-center justify-center z-40 rounded-xl ${className}`}>
        <div className={`${styles.bg} border ${styles.border} rounded-2xl shadow-xl`}>
          {renderContent()}
        </div>
      </div>
    );
  }

  const styles = getVariantStyles();
  
  return (
    <div className={`${styles.bg} border ${styles.border} rounded-xl ${className}`}>
      {renderContent()}
    </div>
  );
};

// Preset loading components for common scenarios
export const PiNetworkLoading = (props) => (
  <LoadingSpinner
    variant="pi"
    message="Connecting to Pi Network"
    submessage="Please wait while we establish a secure connection..."
    {...props}
  />
);

export const LotteryLoading = (props) => (
  <LoadingSpinner
    variant="lottery"
    message="Loading Lottery Data"
    submessage="Fetching the latest lottery information and prizes..."
    {...props}
  />
);

export const AuthLoading = (props) => (
  <LoadingSpinner
    variant="auth"
    message="Authenticating"
    submessage="Verifying your Pi wallet credentials..."
    {...props}
  />
);

export const PaymentLoading = (props) => (
  <LoadingSpinner
    variant="pi"
    message="Processing Payment"
    submessage="Your Pi transaction is being processed on the blockchain..."
    {...props}
  />
);

export const SyncLoading = (props) => (
  <LoadingSpinner
    variant="sync"
    message="Synchronizing"
    submessage="Updating data from the Pi Network..."
    {...props}
  />
);

export const NetworkLoading = (props) => (
  <LoadingSpinner
    variant="network"
    message="Connecting"
    submessage="Establishing network connection..."
    {...props}
  />
);

// Loading skeleton for content areas
export const LoadingSkeleton = ({ 
  lines = 3, 
  width = 'full', 
  height = 'h-4',
  className = '' 
}) => (
  <div className={`animate-pulse space-y-3 ${className}`}>
    {Array.from({ length: lines }).map((_, index) => (
      <div 
        key={index}
        className={`bg-white/10 rounded ${height} ${
          width === 'full' ? 'w-full' : 
          width === 'random' ? `w-${Math.floor(Math.random() * 4 + 6)}/12` :
          `w-${width}`
        }`}
      />
    ))}
  </div>
);

// Animated dots for inline loading
export const LoadingDots = ({ 
  size = 'medium',
  color = 'text-gray-400',
  className = '' 
}) => {
  const [activeDot, setActiveDot] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setActiveDot(prev => (prev + 1) % 3);
    }, 500);
    return () => clearInterval(interval);
  }, []);

  const getDotSize = () => {
    switch (size) {
      case 'small': return 'w-1 h-1';
      case 'large': return 'w-3 h-3';
      default: return 'w-2 h-2';
    }
  };

  return (
    <div className={`flex space-x-1 ${className}`}>
      {[0, 1, 2].map(index => (
        <div
          key={index}
          className={`${getDotSize()} ${color.replace('text-', 'bg-')} rounded-full transition-opacity duration-300 ${
            activeDot === index ? 'opacity-100' : 'opacity-30'
          }`}
        />
      ))}
    </div>
  );
};

export default LoadingSpinner;
