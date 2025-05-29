import React, { useState, useEffect, useRef } from 'react';
import { 
  X, Play, Pause, Volume2, VolumeX, SkipForward, 
  CheckCircle, AlertCircle, Clock, Award, Eye,
  Maximize, Minimize, RotateCcw, Zap
} from 'lucide-react';

const AdWatchModal = ({ 
  lotteryType, 
  onComplete, 
  onCancel, 
  isProcessing = false,
  className = ''
}) => {
  const [adStep, setAdStep] = useState('instructions'); // instructions, watching, verification, success, error
  const [timeRemaining, setTimeRemaining] = useState(30);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [adProgress, setAdProgress] = useState(0);
  const [canSkip, setCanSkip] = useState(false);
  const [verification, setVerification] = useState({
    question: '',
    options: [],
    correctAnswer: '',
    userAnswer: ''
  });
  const [adNetwork, setAdNetwork] = useState('Demo Ad Network');
  const [rewardAmount, setRewardAmount] = useState(0.001);
  const [errorMessage, setErrorMessage] = useState('');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [viewCount, setViewCount] = useState(0);

  const videoRef = useRef(null);
  const timerRef = useRef(null);

  useEffect(() => {
    if (lotteryType) {
      setRewardAmount(lotteryType.adValue || 0.001);
    }
    generateVerificationQuestion();
  }, [lotteryType]);

  useEffect(() => {
    if (adStep === 'watching' && isPlaying) {
      timerRef.current = setInterval(() => {
        setTimeRemaining(prev => {
          const newTime = Math.max(0, prev - 1);
          const progress = ((30 - newTime) / 30) * 100;
          setAdProgress(progress);
          
          // Allow skip after 25 seconds
          if (newTime <= 5) {
            setCanSkip(true);
          }
          
          // Auto-complete when time reaches 0
          if (newTime === 0) {
            handleAdComplete();
          }
          
          return newTime;
        });
      }, 1000);
    } else {
      clearInterval(timerRef.current);
    }

    return () => clearInterval(timerRef.current);
  }, [adStep, isPlaying]);

  const generateVerificationQuestion = () => {
    const questions = [
      {
        question: "What was the main product advertised?",
        options: ["Smartphone", "Headphones", "Laptop", "Tablet"],
        correctAnswer: "Headphones"
      },
      {
        question: "What color was prominently featured in the ad?",
        options: ["Red", "Blue", "Green", "Yellow"],
        correctAnswer: "Blue"
      },
      {
        question: "What was the special offer mentioned?",
        options: ["50% off", "Buy 1 Get 1", "Free shipping", "30% off"],
        correctAnswer: "30% off"
      }
    ];
    
    const randomQuestion = questions[Math.floor(Math.random() * questions.length)];
    setVerification({ ...randomQuestion, userAnswer: '' });
  };

  const handleStartWatching = () => {
    setAdStep('watching');
    setIsPlaying(true);
    setViewCount(prev => prev + 1);
  };

  const handlePlayPause = () => {
    setIsPlaying(!isPlaying);
  };

  const handleMuteToggle = () => {
    setIsMuted(!isMuted);
  };

  const handleAdComplete = () => {
    setIsPlaying(false);
    setAdStep('verification');
  };

  const handleSkipAd = () => {
    if (canSkip) {
      handleAdComplete();
    }
  };

  const handleVerificationSubmit = () => {
    if (verification.userAnswer === verification.correctAnswer) {
      setAdStep('success');
      setTimeout(() => {
        const adData = {
          completionId: `ad_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          network: adNetwork,
          watchDuration: 30,
          rewardAmount: rewardAmount,
          verification: true,
          timestamp: new Date().toISOString()
        };
        onComplete(adData);
      }, 2000);
    } else {
      setErrorMessage('Incorrect answer. Please watch the ad more carefully.');
      setAdStep('error');
    }
  };

  const handleRestart = () => {
    setAdStep('instructions');
    setTimeRemaining(30);
    setAdProgress(0);
    setIsPlaying(false);
    setCanSkip(false);
    setErrorMessage('');
    generateVerificationQuestion();
  };

  const handleFullscreenToggle = () => {
    setIsFullscreen(!isFullscreen);
  };

  const renderInstructionsStep = () => (
    <div className="space-y-6">
      <div className="text-center">
        <div className="w-16 h-16 bg-gradient-to-r from-green-500 to-emerald-500 rounded-full flex items-center justify-center mx-auto mb-4">
          <Play className="w-8 h-8 text-white" />
        </div>
        <h3 className="text-2xl font-bold text-white mb-2">Watch Ad for Free Entry</h3>
        <p className="text-gray-400">Earn a lottery ticket by watching a 30-second advertisement</p>
      </div>

      {/* Lottery Details */}
      <div className="bg-white/5 rounded-xl p-4 border border-white/10">
        <h4 className="font-semibold text-white mb-3">Entry Details</h4>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-400">Lottery Type</span>
            <span className="text-white font-medium">{lotteryType?.name}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400">Ad Duration</span>
            <span className="text-white font-medium">30 seconds</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400">Reward Value</span>
            <span className="text-green-400 font-medium">{rewardAmount} π</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400">Entry Fee</span>
            <span className="text-green-400 font-medium">FREE</span>
          </div>
        </div>
      </div>

      {/* Instructions */}
      <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4">
        <div className="flex items-start space-x-3">
          <Eye className="w-5 h-5 text-blue-400 mt-0.5" />
          <div>
            <h5 className="font-medium text-blue-300 mb-2">How it works:</h5>
            <ul className="text-sm text-blue-200 space-y-1">
              <li>• Watch the full 30-second advertisement</li>
              <li>• Keep the window active and focused</li>
              <li>• Answer a simple verification question</li>
              <li>• Receive your free lottery entry</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Ad Network Info */}
      <div className="bg-white/5 rounded-xl p-4 border border-white/10">
        <div className="flex items-center justify-between mb-2">
          <span className="text-gray-400 text-sm">Ad Network</span>
          <span className="text-white font-medium">{adNetwork}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-gray-400 text-sm">Your Views Today</span>
          <span className="text-green-400 font-medium">{viewCount}/5</span>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex space-x-3">
        <button
          onClick={onCancel}
          className="flex-1 py-3 px-4 bg-white/10 hover:bg-white/20 border border-white/20 rounded-xl transition-all duration-300 font-medium"
        >
          Cancel
        </button>
        <button
          onClick={handleStartWatching}
          className="flex-1 py-3 px-4 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-xl hover:from-green-600 hover:to-emerald-700 transition-all duration-300 font-medium flex items-center justify-center space-x-2"
        >
          <Play className="w-4 h-4" />
          <span>Start Watching</span>
        </button>
      </div>
    </div>
  );

  const renderWatchingStep = () => (
    <div className="space-y-4">
      {/* Video Player Simulation */}
      <div className={`relative bg-black rounded-xl overflow-hidden ${isFullscreen ? 'h-80' : 'h-48'}`}>
        <div className="absolute inset-0 bg-gradient-to-br from-purple-600 to-blue-600 flex items-center justify-center">
          <div className="text-center text-white">
            <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <Zap className="w-8 h-8" />
            </div>
            <h4 className="text-xl font-bold mb-2">Demo Advertisement</h4>
            <p className="text-sm opacity-80">Premium Wireless Headphones - 30% Off!</p>
          </div>
        </div>
        
        {/* Video Controls Overlay */}
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-4">
          <div className="flex items-center space-x-4">
            <button
              onClick={handlePlayPause}
              className="p-2 bg-white/20 hover:bg-white/30 rounded-full transition-all duration-300"
            >
              {isPlaying ? <Pause className="w-4 h-4 text-white" /> : <Play className="w-4 h-4 text-white" />}
            </button>
            
            <button
              onClick={handleMuteToggle}
              className="p-2 bg-white/20 hover:bg-white/30 rounded-full transition-all duration-300"
            >
              {isMuted ? <VolumeX className="w-4 h-4 text-white" /> : <Volume2 className="w-4 h-4 text-white" />}
            </button>
            
            <div className="flex-1">
              <div className="bg-white/20 rounded-full h-1">
                <div 
                  className="bg-green-400 h-1 rounded-full transition-all duration-1000"
                  style={{ width: `${adProgress}%` }}
                ></div>
              </div>
            </div>
            
            <button
              onClick={handleFullscreenToggle}
              className="p-2 bg-white/20 hover:bg-white/30 rounded-full transition-all duration-300"
            >
              {isFullscreen ? <Minimize className="w-4 h-4 text-white" /> : <Maximize className="w-4 h-4 text-white" />}
            </button>
          </div>
        </div>
        
        {/* Skip Button */}
        {canSkip && (
          <div className="absolute top-4 right-4">
            <button
              onClick={handleSkipAd}
              className="px-3 py-1 bg-black/60 hover:bg-black/80 text-white text-sm rounded-lg transition-all duration-300 flex items-center space-x-1"
            >
              <SkipForward className="w-3 h-3" />
              <span>Skip Ad</span>
            </button>
          </div>
        )}
      </div>

      {/* Progress Info */}
      <div className="bg-white/5 rounded-xl p-4 border border-white/10">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center space-x-2">
            <Clock className="w-5 h-5 text-orange-400" />
            <span className="text-white font-medium">
              {timeRemaining > 0 ? `${timeRemaining}s remaining` : 'Ad Complete!'}
            </span>
          </div>
          <div className="text-sm text-gray-400">
            {Math.round(adProgress)}% watched
          </div>
        </div>
        
        <div className="bg-white/10 rounded-full h-2">
          <div 
            className="bg-gradient-to-r from-orange-400 to-green-400 h-2 rounded-full transition-all duration-1000"
            style={{ width: `${adProgress}%` }}
          ></div>
        </div>
      </div>

      {/* Watching Requirements */}
      <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-4">
        <div className="flex items-start space-x-3">
          <Eye className="w-5 h-5 text-yellow-400 mt-0.5" />
          <div>
            <p className="text-sm text-yellow-200">
              <strong>Keep this window active!</strong> The ad must be watched completely to earn your lottery entry.
            </p>
          </div>
        </div>
      </div>
    </div>
  );

  const renderVerificationStep = () => (
    <div className="space-y-6">
      <div className="text-center">
        <div className="w-16 h-16 bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full flex items-center justify-center mx-auto mb-4">
          <CheckCircle className="w-8 h-8 text-white" />
        </div>
        <h3 className="text-2xl font-bold text-white mb-2">Verification Required</h3>
        <p className="text-gray-400">Answer this question to confirm you watched the ad</p>
      </div>

      <div className="bg-white/5 rounded-xl p-4 border border-white/10">
        <h4 className="font-semibold text-white mb-4">{verification.question}</h4>
        <div className="space-y-2">
          {verification.options.map((option, index) => (
            <button
              key={index}
              onClick={() => setVerification(prev => ({ ...prev, userAnswer: option }))}
              className={`w-full p-3 text-left rounded-lg transition-all duration-300 ${
                verification.userAnswer === option
                  ? 'bg-blue-500/30 border border-blue-500/50 text-blue-200'
                  : 'bg-white/5 hover:bg-white/10 border border-white/10'
              }`}
            >
              {option}
            </button>
          ))}
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

      <div className="flex space-x-3">
        <button
          onClick={handleRestart}
          className="flex-1 py-3 px-4 bg-white/10 hover:bg-white/20 border border-white/20 rounded-xl transition-all duration-300 font-medium flex items-center justify-center space-x-2"
        >
          <RotateCcw className="w-4 h-4" />
          <span>Watch Again</span>
        </button>
        <button
          onClick={handleVerificationSubmit}
          disabled={!verification.userAnswer}
          className={`flex-1 py-3 px-4 rounded-xl font-medium transition-all duration-300 ${
            verification.userAnswer
              ? 'bg-gradient-to-r from-green-500 to-emerald-600 text-white hover:from-green-600 hover:to-emerald-700'
              : 'bg-gray-600 text-gray-400 cursor-not-allowed'
          }`}
        >
          Submit Answer
        </button>
      </div>
    </div>
  );

  const renderSuccessStep = () => (
    <div className="text-center space-y-6">
      <div className="w-20 h-20 bg-gradient-to-r from-green-500 to-emerald-600 rounded-full flex items-center justify-center mx-auto">
        <Award className="w-10 h-10 text-white" />
      </div>
      
      <div>
        <h3 className="text-2xl font-bold text-green-400 mb-2">Entry Earned!</h3>
        <p className="text-gray-400">Your free lottery ticket has been confirmed</p>
      </div>

      <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-4">
        <div className="space-y-3">
          <div className="flex justify-between text-sm">
            <span className="text-gray-400">Ad Watched</span>
            <span className="text-green-400 font-medium">✓ Complete</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-400">Verification</span>
            <span className="text-green-400 font-medium">✓ Passed</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-400">Reward Earned</span>
            <span className="text-green-400 font-medium">{rewardAmount} π</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-400">Lottery Entry</span>
            <span className="text-green-400 font-medium">✓ Confirmed</span>
          </div>
        </div>
      </div>

      <div className="text-sm text-gray-400">
        Redirecting to lottery page...
      </div>
    </div>
  );

  const renderErrorStep = () => (
    <div className="text-center space-y-6">
      <div className="w-20 h-20 bg-gradient-to-r from-red-500 to-red-600 rounded-full flex items-center justify-center mx-auto">
        <AlertCircle className="w-10 h-10 text-white" />
      </div>
      
      <div>
        <h3 className="text-2xl font-bold text-red-400 mb-2">Verification Failed</h3>
        <p className="text-gray-400">Please watch the ad carefully and try again</p>
      </div>

      {errorMessage && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4">
          <p className="text-red-300 text-sm">{errorMessage}</p>
        </div>
      )}

      <div className="flex space-x-3">
        <button
          onClick={onCancel}
          className="flex-1 py-3 px-4 bg-white/10 hover:bg-white/20 border border-white/20 rounded-xl transition-all duration-300 font-medium"
        >
          Cancel
        </button>
        <button
          onClick={handleRestart}
          className="flex-1 py-3 px-4 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-xl hover:from-blue-600 hover:to-indigo-700 transition-all duration-300 font-medium"
        >
          Try Again
        </button>
      </div>
    </div>
  );

  return (
    <div className={`fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 ${className}`}>
      <div className="bg-slate-800 border border-white/20 rounded-3xl p-6 max-w-lg w-full max-h-[90vh] overflow-y-auto shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-2">
            <div className="w-6 h-6 bg-gradient-to-r from-green-400 to-emerald-500 rounded-full"></div>
            <span className="font-semibold text-white">Free Ad Entry</span>
          </div>
          {adStep !== 'watching' && !isProcessing && (
            <button
              onClick={onCancel}
              className="p-2 hover:bg-white/10 rounded-lg transition-all duration-300"
            >
              <X className="w-5 h-5 text-gray-400" />
            </button>
          )}
        </div>

        {/* Content */}
        {adStep === 'instructions' && renderInstructionsStep()}
        {adStep === 'watching' && renderWatchingStep()}
        {adStep === 'verification' && renderVerificationStep()}
        {adStep === 'success' && renderSuccessStep()}
        {adStep === 'error' && renderErrorStep()}
      </div>
    </div>
  );
};

export default AdWatchModal;
