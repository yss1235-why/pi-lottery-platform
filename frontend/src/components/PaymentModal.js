import React, { useState, useEffect } from 'react';
import { 
  X, CreditCard, AlertCircle, CheckCircle, Clock, 
  Info, Wallet, ArrowRight, Shield, Zap 
} from 'lucide-react';

const PaymentModal = ({ 
  lotteryType, 
  onConfirm, 
  onCancel, 
  createPayment, 
  isProcessing = false,
  userBalance = 0,
  className = ''
}) => {
  const [paymentStep, setPaymentStep] = useState('review'); // review, processing, success, error
  const [paymentData, setPaymentData] = useState(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [paymentDetails, setPaymentDetails] = useState({
    amount: lotteryType?.entryFee || 1.0,
    platformFee: lotteryType?.platformFee || 0.1,
    netAmount: (lotteryType?.entryFee || 1.0) - (lotteryType?.platformFee || 0.1)
  });

  useEffect(() => {
    if (lotteryType) {
      setPaymentDetails({
        amount: lotteryType.entryFee,
        platformFee: lotteryType.platformFee,
        netAmount: lotteryType.entryFee - lotteryType.platformFee
      });
    }
  }, [lotteryType]);

  const handlePaymentStart = async () => {
    if (!agreedToTerms) {
      setErrorMessage('Please agree to the terms and conditions');
      return;
    }

    if (userBalance < paymentDetails.amount) {
      setErrorMessage('Insufficient Pi balance for this transaction');
      return;
    }

    setPaymentStep('processing');
    setErrorMessage('');

    try {
      const payment = await createPayment(
        paymentDetails.amount,
        `Pi Lottery Entry: ${lotteryType.name}`,
        {
          lotteryTypeId: lotteryType.id,
          entryType: 'pi_payment',
          platformFee: paymentDetails.platformFee,
          netAmount: paymentDetails.netAmount
        }
      );

      setPaymentData(payment);
      
      // Simulate payment processing time
      setTimeout(() => {
        setPaymentStep('success');
        setTimeout(() => {
          onConfirm(payment);
        }, 2000);
      }, 3000);

    } catch (error) {
      console.error('Payment failed:', error);
      setErrorMessage(error.message || 'Payment processing failed. Please try again.');
      setPaymentStep('error');
    }
  };

  const handleClose = () => {
    if (paymentStep === 'processing') return; // Don't allow closing during processing
    onCancel();
  };

  const renderReviewStep = () => (
    <div className="space-y-6">
      <div className="text-center">
        <div className="w-16 h-16 bg-gradient-to-r from-yellow-500 to-orange-500 rounded-full flex items-center justify-center mx-auto mb-4">
          <CreditCard className="w-8 h-8 text-white" />
        </div>
        <h3 className="text-2xl font-bold text-white mb-2">Confirm Payment</h3>
        <p className="text-gray-400">Review your lottery entry payment details</p>
      </div>

      {/* Lottery Details */}
      <div className="bg-white/5 rounded-xl p-4 border border-white/10">
        <h4 className="font-semibold text-white mb-3">Lottery Details</h4>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-400">Lottery Type</span>
            <span className="text-white font-medium">{lotteryType?.name}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400">Entry Fee</span>
            <span className="text-white font-medium">{paymentDetails.amount} π</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400">Platform Fee</span>
            <span className="text-yellow-400">{paymentDetails.platformFee} π</span>
          </div>
          <div className="border-t border-white/10 pt-2 mt-2">
            <div className="flex justify-between">
              <span className="text-gray-400">Prize Pool Contribution</span>
              <span className="text-green-400 font-medium">{paymentDetails.netAmount} π</span>
            </div>
          </div>
        </div>
      </div>

      {/* Balance Check */}
      <div className="bg-white/5 rounded-xl p-4 border border-white/10">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Wallet className="w-5 h-5 text-blue-400" />
            <span className="text-gray-400">Your Pi Balance</span>
          </div>
          <span className={`font-bold ${
            userBalance >= paymentDetails.amount ? 'text-green-400' : 'text-red-400'
          }`}>
            {userBalance.toFixed(3)} π
          </span>
        </div>
        
        {userBalance < paymentDetails.amount && (
          <div className="mt-3 p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
            <div className="flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 text-red-400" />
              <span className="text-red-300 text-sm">Insufficient balance for this transaction</span>
            </div>
          </div>
        )}
        
        {userBalance >= paymentDetails.amount && (
          <div className="mt-2 text-sm text-gray-500">
            Remaining after payment: {(userBalance - paymentDetails.amount).toFixed(3)} π
          </div>
        )}
      </div>

      {/* Terms Agreement */}
      <div className="bg-white/5 rounded-xl p-4 border border-white/10">
        <div className="flex items-start space-x-3">
          <input
            type="checkbox"
            id="terms"
            checked={agreedToTerms}
            onChange={(e) => setAgreedToTerms(e.target.checked)}
            className="mt-1 w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500"
          />
          <label htmlFor="terms" className="text-sm text-gray-300">
            I agree to the{' '}
            <span className="text-blue-400 hover:text-blue-300 cursor-pointer underline">
              Terms of Service
            </span>{' '}
            and understand that lottery entries are non-refundable. I confirm this payment will be processed on the Pi Network blockchain.
          </label>
        </div>
      </div>

      {/* Security Notice */}
      <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4">
        <div className="flex items-start space-x-3">
          <Shield className="w-5 h-5 text-blue-400 mt-0.5" />
          <div>
            <h5 className="font-medium text-blue-300 mb-1">Secure Payment</h5>
            <p className="text-sm text-blue-200">
              Your payment is processed securely through the Pi Network. We never store your private keys or personal financial information.
            </p>
          </div>
        </div>
      </div>

      {errorMessage && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4">
          <div className="flex items-center space-x-2">
            <AlertCircle className="w-5 h-5 text-red-400" />
            <span className="text-red-300 text-sm">{errorMessage}</span>
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex space-x-3">
        <button
          onClick={handleClose}
          className="flex-1 py-3 px-4 bg-white/10 hover:bg-white/20 border border-white/20 rounded-xl transition-all duration-300 font-medium"
        >
          Cancel
        </button>
        <button
          onClick={handlePaymentStart}
          disabled={!agreedToTerms || userBalance < paymentDetails.amount}
          className={`flex-1 py-3 px-4 rounded-xl font-medium transition-all duration-300 flex items-center justify-center space-x-2 ${
            agreedToTerms && userBalance >= paymentDetails.amount
              ? 'bg-gradient-to-r from-green-500 to-emerald-600 text-white hover:from-green-600 hover:to-emerald-700'
              : 'bg-gray-600 text-gray-400 cursor-not-allowed'
          }`}
        >
          <span>Confirm Payment</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );

  const renderProcessingStep = () => (
    <div className="text-center space-y-6">
      <div className="w-20 h-20 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-full flex items-center justify-center mx-auto">
        <div className="w-8 h-8 border-4 border-white border-t-transparent rounded-full animate-spin"></div>
      </div>
      
      <div>
        <h3 className="text-2xl font-bold text-white mb-2">Processing Payment</h3>
        <p className="text-gray-400 mb-4">Please wait while we process your Pi Network transaction</p>
        
        <div className="bg-white/5 rounded-xl p-4 border border-white/10">
          <div className="flex items-center justify-center space-x-2 mb-3">
            <Zap className="w-5 h-5 text-yellow-400" />
            <span className="font-medium text-white">Transaction Status</span>
          </div>
          
          <div className="space-y-2 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-gray-400">Creating payment request</span>
              <CheckCircle className="w-4 h-4 text-green-400" />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-400">Waiting for Pi Network approval</span>
              <div className="w-4 h-4 border-2 border-yellow-400 border-t-transparent rounded-full animate-spin"></div>
            </div>
            <div className="flex items-center justify-between text-gray-500">
              <span>Processing blockchain transaction</span>
              <Clock className="w-4 h-4" />
            </div>
          </div>
        </div>
      </div>

      <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-4">
        <div className="flex items-start space-x-3">
          <Info className="w-5 h-5 text-yellow-400 mt-0.5" />
          <div className="text-left">
            <p className="text-sm text-yellow-200">
              <strong>Please do not close this window.</strong> Your payment is being processed on the Pi Network blockchain. This may take a few moments.
            </p>
          </div>
        </div>
      </div>

      {paymentData && (
        <div className="text-xs text-gray-500 font-mono">
          Payment ID: {paymentData.identifier}
        </div>
      )}
    </div>
  );

  const renderSuccessStep = () => (
    <div className="text-center space-y-6">
      <div className="w-20 h-20 bg-gradient-to-r from-green-500 to-emerald-600 rounded-full flex items-center justify-center mx-auto">
        <CheckCircle className="w-10 h-10 text-white" />
      </div>
      
      <div>
        <h3 className="text-2xl font-bold text-green-400 mb-2">Payment Successful!</h3>
        <p className="text-gray-400">Your lottery entry has been confirmed</p>
      </div>

      <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-4">
        <div className="space-y-3">
          <div className="flex justify-between text-sm">
            <span className="text-gray-400">Amount Paid</span>
            <span className="text-white font-medium">{paymentDetails.amount} π</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-400">Lottery Entry</span>
            <span className="text-green-400 font-medium">Confirmed</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-400">Transaction</span>
            <span className="text-green-400 font-medium">Complete</span>
          </div>
        </div>
      </div>

      <div className="text-sm text-gray-400">
        You will be automatically redirected to the lottery page...
      </div>
    </div>
  );

  const renderErrorStep = () => (
    <div className="text-center space-y-6">
      <div className="w-20 h-20 bg-gradient-to-r from-red-500 to-red-600 rounded-full flex items-center justify-center mx-auto">
        <AlertCircle className="w-10 h-10 text-white" />
      </div>
      
      <div>
        <h3 className="text-2xl font-bold text-red-400 mb-2">Payment Failed</h3>
        <p className="text-gray-400">There was an issue processing your payment</p>
      </div>

      {errorMessage && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4">
          <p className="text-red-300 text-sm">{errorMessage}</p>
        </div>
      )}

      <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4">
        <div className="flex items-start space-x-3">
          <Info className="w-5 h-5 text-blue-400 mt-0.5" />
          <div className="text-left">
            <h5 className="font-medium text-blue-300 mb-1">What to do next:</h5>
            <ul className="text-sm text-blue-200 space-y-1">
              <li>• Check your Pi Network connection</li>
              <li>• Ensure you have sufficient Pi balance</li>
              <li>• Try again in a few moments</li>
              <li>• Contact support if the issue persists</li>
            </ul>
          </div>
        </div>
      </div>

      <div className="flex space-x-3">
        <button
          onClick={handleClose}
          className="flex-1 py-3 px-4 bg-white/10 hover:bg-white/20 border border-white/20 rounded-xl transition-all duration-300 font-medium"
        >
          Close
        </button>
        <button
          onClick={() => {
            setPaymentStep('review');
            setErrorMessage('');
          }}
          className="flex-1 py-3 px-4 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-xl hover:from-blue-600 hover:to-indigo-700 transition-all duration-300 font-medium"
        >
          Try Again
        </button>
      </div>
    </div>
  );

  return (
    <div className={`fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 ${className}`}>
      <div className="bg-slate-800 border border-white/20 rounded-3xl p-6 max-w-md w-full max-h-[90vh] overflow-y-auto shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-2">
            <div className="w-6 h-6 bg-gradient-to-r from-yellow-400 to-orange-500 rounded-full"></div>
            <span className="font-semibold text-white">Pi Payment</span>
          </div>
          {paymentStep !== 'processing' && (
            <button
              onClick={handleClose}
              className="p-2 hover:bg-white/10 rounded-lg transition-all duration-300"
            >
              <X className="w-5 h-5 text-gray-400" />
            </button>
          )}
        </div>

        {/* Content */}
        {paymentStep === 'review' && renderReviewStep()}
        {paymentStep === 'processing' && renderProcessingStep()}
        {paymentStep === 'success' && renderSuccessStep()}
        {paymentStep === 'error' && renderErrorStep()}
      </div>
    </div>
  );
};

export default PaymentModal;
