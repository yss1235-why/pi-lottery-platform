import React, { useState, useEffect } from 'react';
import { 
  AlertTriangle, CheckCircle, X, Info, AlertCircle,
  Trash2, Save, Send, DollarSign, Settings, Shield,
  Clock, Zap, Eye, EyeOff, Copy, ExternalLink
} from 'lucide-react';

const ConfirmationModal = ({
  isOpen = true,
  title = 'Confirm Action',
  message = 'Are you sure you want to proceed?',
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  onConfirm,
  onCancel,
  type = 'default', // default, danger, warning, success, info
  showInput = false,
  inputPlaceholder = '',
  inputValue = '',
  onInputChange = null,
  showDetails = false,
  details = {},
  autoConfirmDelay = 0,
  preventClose = false,
  customIcon = null,
  className = ''
}) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [inputVal, setInputVal] = useState(inputValue);
  const [showDetailsExpanded, setShowDetailsExpanded] = useState(false);
  const [countdown, setCountdown] = useState(autoConfirmDelay);
  const [error, setError] = useState('');

  useEffect(() => {
    setInputVal(inputValue);
  }, [inputValue]);

  useEffect(() => {
    if (autoConfirmDelay > 0) {
      const timer = setInterval(() => {
        setCountdown(prev => {
          if (prev <= 1) {
            handleConfirm();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      return () => clearInterval(timer);
    }
  }, [autoConfirmDelay]);

  const getModalStyles = () => {
    const baseStyles = 'bg-slate-800 border border-white/20 rounded-3xl p-6 max-w-md w-full shadow-2xl';
    
    switch (type) {
      case 'danger':
        return `${baseStyles} border-red-500/30`;
      case 'warning':
        return `${baseStyles} border-yellow-500/30`;
      case 'success':
        return `${baseStyles} border-green-500/30`;
      case 'info':
        return `${baseStyles} border-blue-500/30`;
      default:
        return baseStyles;
    }
  };

  const getIcon = () => {
    if (customIcon) return customIcon;

    const iconSize = 'w-8 h-8';
    
    switch (type) {
      case 'danger':
        return <AlertTriangle className={`${iconSize} text-red-400`} />;
      case 'warning':
        return <AlertCircle className={`${iconSize} text-yellow-400`} />;
      case 'success':
        return <CheckCircle className={`${iconSize} text-green-400`} />;
      case 'info':
        return <Info className={`${iconSize} text-blue-400`} />;
      default:
        return <AlertCircle className={`${iconSize} text-gray-400`} />;
    }
  };

  const getIconBackground = () => {
    switch (type) {
      case 'danger':
        return 'bg-red-500/20';
      case 'warning':
        return 'bg-yellow-500/20';
      case 'success':
        return 'bg-green-500/20';
      case 'info':
        return 'bg-blue-500/20';
      default:
        return 'bg-gray-500/20';
    }
  };

  const getConfirmButtonStyles = () => {
    const baseStyles = 'flex-1 py-3 px-4 rounded-xl font-medium transition-all duration-300 flex items-center justify-center space-x-2';
    
    if (isProcessing) {
      return `${baseStyles} bg-gray-600 text-gray-400 cursor-not-allowed`;
    }

    switch (type) {
      case 'danger':
        return `${baseStyles} bg-gradient-to-r from-red-500 to-red-600 text-white hover:from-red-600 hover:to-red-700`;
      case 'warning':
        return `${baseStyles} bg-gradient-to-r from-yellow-500 to-yellow-600 text-white hover:from-yellow-600 hover:to-yellow-700`;
      case 'success':
        return `${baseStyles} bg-gradient-to-r from-green-500 to-green-600 text-white hover:from-green-600 hover:to-green-700`;
      case 'info':
        return `${baseStyles} bg-gradient-to-r from-blue-500 to-blue-600 text-white hover:from-blue-600 hover:to-blue-700`;
      default:
        return `${baseStyles} bg-gradient-to-r from-gray-600 to-gray-700 text-white hover:from-gray-700 hover:to-gray-800`;
    }
  };

  const handleConfirm = async () => {
    if (isProcessing) return;

    // Validate input if required
    if (showInput && !inputVal.trim()) {
      setError('This field is required');
      return;
    }

    setIsProcessing(true);
    setError('');

    try {
      if (onConfirm) {
        await onConfirm(showInput ? inputVal : undefined);
      }
    } catch (error) {
      setError(error.message || 'An error occurred');
      setIsProcessing(false);
    }
  };

  const handleCancel = () => {
    if (isProcessing && preventClose) return;
    if (onCancel) onCancel();
  };

  const handleInputChange = (e) => {
    const value = e.target.value;
    setInputVal(value);
    setError('');
    if (onInputChange) onInputChange(value);
  };

  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget && !(isProcessing && preventClose)) {
      handleCancel();
    }
  };

  if (!isOpen) return null;

  return (
    <div 
      className={`fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 ${className}`}
      onClick={handleBackdropClick}
    >
      <div className={getModalStyles()}>
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-3">
            <div className={`w-12 h-12 ${getIconBackground()} rounded-full flex items-center justify-center`}>
              {getIcon()}
            </div>
            <h3 className="text-xl font-bold text-white">{title}</h3>
          </div>
          
          {!(isProcessing && preventClose) && (
            <button
              onClick={handleCancel}
              className="p-2 hover:bg-white/10 rounded-lg transition-all duration-300"
            >
              <X className="w-5 h-5 text-gray-400" />
            </button>
          )}
        </div>

        {/* Message */}
        <div className="mb-6">
          <p className="text-gray-300 leading-relaxed">{message}</p>
        </div>

        {/* Input Field */}
        {showInput && (
          <div className="mb-6">
            <input
              type="text"
              value={inputVal}
              onChange={handleInputChange}
              placeholder={inputPlaceholder}
              className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:border-blue-400 transition-all duration-300"
              disabled={isProcessing}
              autoFocus
            />
            {error && (
              <p className="text-red-400 text-sm mt-2 flex items-center space-x-2">
                <AlertCircle className="w-4 h-4" />
                <span>{error}</span>
              </p>
            )}
          </div>
        )}

        {/* Details Section */}
        {showDetails && Object.keys(details).length > 0 && (
          <div className="mb-6 bg-white/5 rounded-xl border border-white/10">
            <button
              onClick={() => setShowDetailsExpanded(!showDetailsExpanded)}
              className="w-full p-4 flex items-center justify-between hover:bg-white/5 transition-all duration-300"
            >
              <span className="font-medium text-white">Details</span>
              {showDetailsExpanded ? (
                <EyeOff className="w-4 h-4 text-gray-400" />
              ) : (
                <Eye className="w-4 h-4 text-gray-400" />
              )}
            </button>
            
            {showDetailsExpanded && (
              <div className="px-4 pb-4 space-y-2 border-t border-white/10 pt-4">
                {Object.entries(details).map(([key, value]) => (
                  <div key={key} className="flex items-center justify-between text-sm">
                    <span className="text-gray-400 capitalize">{key.replace(/([A-Z])/g, ' $1').trim()}:</span>
                    <span className="text-white font-medium">
                      {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Auto-confirm countdown */}
        {autoConfirmDelay > 0 && countdown > 0 && (
          <div className="mb-6 p-3 bg-blue-500/10 border border-blue-500/20 rounded-xl">
            <div className="flex items-center space-x-2">
              <Clock className="w-4 h-4 text-blue-400" />
              <span className="text-blue-300 text-sm">
                Auto-confirming in {countdown} seconds...
              </span>
            </div>
          </div>
        )}

        {/* Processing indicator */}
        {isProcessing && (
          <div className="mb-6 p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-xl">
            <div className="flex items-center space-x-2">
              <div className="w-4 h-4 border-2 border-yellow-400 border-t-transparent rounded-full animate-spin"></div>
              <span className="text-yellow-300 text-sm">Processing your request...</span>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex space-x-3">
          <button
            onClick={handleCancel}
            disabled={isProcessing && preventClose}
            className={`flex-1 py-3 px-4 rounded-xl font-medium transition-all duration-300 ${
              isProcessing && preventClose
                ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                : 'bg-white/10 hover:bg-white/20 border border-white/20 text-white'
            }`}
          >
            {cancelText}
          </button>
          
          <button
            onClick={handleConfirm}
            disabled={isProcessing || (showInput && !inputVal.trim())}
            className={getConfirmButtonStyles()}
          >
            {isProcessing ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                <span>Processing...</span>
              </>
            ) : (
              <>
                {type === 'danger' && <Trash2 className="w-4 h-4" />}
                {type === 'success' && <CheckCircle className="w-4 h-4" />}
                {type === 'warning' && <AlertTriangle className="w-4 h-4" />}
                {type === 'info' && <Info className="w-4 h-4" />}
                {type === 'default' && <Zap className="w-4 h-4" />}
                <span>
                  {confirmText}
                  {countdown > 0 && ` (${countdown})`}
                </span>
              </>
            )}
          </button>
        </div>

        {/* Additional Info */}
        {type === 'danger' && (
          <div className="mt-4 p-3 bg-red-500/10 border border-red-500/20 rounded-xl">
            <p className="text-red-300 text-sm flex items-start space-x-2">
              <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <span>This action cannot be undone. Please confirm you want to proceed.</span>
            </p>
          </div>
        )}

        {showInput && inputPlaceholder.includes('password') && (
          <div className="mt-4 p-3 bg-blue-500/10 border border-blue-500/20 rounded-xl">
            <p className="text-blue-300 text-sm flex items-start space-x-2">
              <Shield className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <span>Your information is encrypted and secure. We never store sensitive data.</span>
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

// Preset confirmation modals for common use cases
export const DeleteConfirmationModal = (props) => (
  <ConfirmationModal
    type="danger"
    title="Delete Item"
    message="Are you sure you want to delete this item? This action cannot be undone."
    confirmText="Delete"
    {...props}
  />
);

export const SaveConfirmationModal = (props) => (
  <ConfirmationModal
    type="success"
    title="Save Changes"
    message="Do you want to save your changes?"
    confirmText="Save"
    {...props}
  />
);

export const PaymentConfirmationModal = (props) => (
  <ConfirmationModal
    type="warning"
    title="Confirm Payment"
    message="Please review your payment details before proceeding."
    confirmText="Pay Now"
    customIcon={<DollarSign className="w-8 h-8 text-yellow-400" />}
    showDetails={true}
    {...props}
  />
);

export const AdminActionConfirmationModal = (props) => (
  <ConfirmationModal
    type="warning"
    title="Administrative Action"
    message="This action will affect system operations. Please confirm."
    confirmText="Execute"
    customIcon={<Settings className="w-8 h-8 text-orange-400" />}
    preventClose={true}
    {...props}
  />
);

export default ConfirmationModal;
