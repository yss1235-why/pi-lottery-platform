// ============================================
// Updated App.js with Legal Pages Routing
// frontend/src/App.js
// ============================================

import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import PiLotteryApp from './components/PiLotteryApp';
import AdminPanel from './components/AdminPanel';
import { PrivacyPolicy, TermsOfService } from './components/LegalPages';
import Footer from './components/Footer';
import './index.css';

function App() {
  return (
    <Router>
      <div className="App min-h-screen flex flex-col">
        <div className="flex-grow">
          <Routes>
            <Route path="/" element={<PiLotteryApp />} />
            <Route path="/admin" element={<AdminPanel />} />
            <Route path="/privacy-policy" element={<PrivacyPolicy />} />
            <Route path="/terms-of-service" element={<TermsOfService />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </div>
        <Footer />
      </div>
    </Router>
  );
}

export default App;

// ============================================
// Footer Component with Legal Links
// frontend/src/components/Footer.js
// ============================================

import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Shield, Scale, Mail, ExternalLink, Coins } from 'lucide-react';

const Footer = () => {
  const location = useLocation();
  
  // Don't show footer on admin pages
  if (location.pathname.startsWith('/admin')) {
    return null;
  }

  return (
    <footer className="bg-slate-900/80 backdrop-blur-lg border-t border-white/10 text-white">
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          
          {/* Brand Section */}
          <div className="space-y-4">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-gradient-to-r from-yellow-400 to-orange-500 rounded-full flex items-center justify-center">
                <Coins className="w-5 h-5 text-white" />
              </div>
              <h3 className="text-lg font-bold">Pi Lottery</h3>
            </div>
            <p className="text-gray-400 text-sm">
              Decentralized lottery platform built on the Pi Network ecosystem. 
              Fair, transparent, and secure lottery gaming.
            </p>
            <div className="flex items-center space-x-2 text-sm text-gray-400">
              <Shield className="w-4 h-4" />
              <span>Powered by Pi Network</span>
            </div>
          </div>

          {/* Legal Section */}
          <div className="space-y-4">
            <h4 className="font-semibold text-gray-300">Legal</h4>
            <div className="space-y-2">
              <Link 
                to="/terms-of-service" 
                className="flex items-center space-x-2 text-gray-400 hover:text-white transition-colors text-sm"
              >
                <Scale className="w-4 h-4" />
                <span>Terms of Service</span>
              </Link>
              <Link 
                to="/privacy-policy" 
                className="flex items-center space-x-2 text-gray-400 hover:text-white transition-colors text-sm"
              >
                <Shield className="w-4 h-4" />
                <span>Privacy Policy</span>
              </Link>
              <a 
                href="https://minepi.com/terms" 
                target="_blank" 
                rel="noopener noreferrer"
                className="flex items-center space-x-2 text-gray-400 hover:text-white transition-colors text-sm"
              >
                <ExternalLink className="w-4 h-4" />
                <span>Pi Network Terms</span>
              </a>
            </div>
          </div>

          {/* Support Section */}
          <div className="space-y-4">
            <h4 className="font-semibold text-gray-300">Support</h4>
            <div className="space-y-2">
              <a 
                href="mailto:support@pilottery.app" 
                className="flex items-center space-x-2 text-gray-400 hover:text-white transition-colors text-sm"
              >
                <Mail className="w-4 h-4" />
                <span>support@pilottery.app</span>
              </a>
              <a 
                href="mailto:legal@pilottery.app" 
                className="flex items-center space-x-2 text-gray-400 hover:text-white transition-colors text-sm"
              >
                <Scale className="w-4 h-4" />
                <span>legal@pilottery.app</span>
              </a>
              <a 
                href="mailto:privacy@pilottery.app" 
                className="flex items-center space-x-2 text-gray-400 hover:text-white transition-colors text-sm"
              >
                <Shield className="w-4 h-4" />
                <span>privacy@pilottery.app</span>
              </a>
            </div>
          </div>

          {/* Platform Info */}
          <div className="space-y-4">
            <h4 className="font-semibold text-gray-300">Platform</h4>
            <div className="space-y-2 text-sm text-gray-400">
              <div className="flex justify-between">
                <span>Platform Fee:</span>
                <span className="text-yellow-400">0.1 π</span>
              </div>
              <div className="flex justify-between">
                <span>Entry Fee:</span>
                <span className="text-blue-400">1.0 π</span>
              </div>
              <div className="flex justify-between">
                <span>Ad Value:</span>
                <span className="text-green-400">0.001 π</span>
              </div>
              <div className="mt-3 p-2 bg-white/5 rounded-lg">
                <p className="text-xs text-gray-400">
                  All transactions secured by Pi Network blockchain
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Section */}
        <div className="mt-8 pt-6 border-t border-white/10">
          <div className="flex flex-col md:flex-row justify-between items-center space-y-4 md:space-y-0">
            <div className="text-sm text-gray-400">
              © {new Date().getFullYear()} Pi Lottery Platform. All rights reserved.
            </div>
            <div className="flex items-center space-x-6 text-sm text-gray-400">
              <span>Built with Pi Network SDK</span>
              <span>•</span>
              <span>Version 1.0.0</span>
              <span>•</span>
              <span className="flex items-center space-x-1">
                <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                <span>All Systems Operational</span>
              </span>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;

// ============================================
// Legal Consent Modal Component
// frontend/src/components/LegalConsentModal.js
// ============================================

import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Shield, Scale, AlertCircle, Check } from 'lucide-react';

const LegalConsentModal = ({ isOpen, onAccept, onDecline }) => {
  const [hasReadTerms, setHasReadTerms] = useState(false);
  const [hasReadPrivacy, setHasReadPrivacy] = useState(false);

  if (!isOpen) return null;

  const canAccept = hasReadTerms && hasReadPrivacy;

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-slate-800 border border-white/20 rounded-2xl p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        
        {/* Header */}
        <div className="flex items-center space-x-3 mb-6">
          <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
            <Shield className="w-6 h-6 text-white" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">Legal Agreement Required</h2>
            <p className="text-gray-400 text-sm">Please review and accept our terms to continue</p>
          </div>
        </div>

        {/* Important Notice */}
        <div className="bg-orange-500/10 border border-orange-500/30 rounded-xl p-4 mb-6">
          <div className="flex items-start space-x-3">
            <AlertCircle className="w-5 h-5 text-orange-400 mt-0.5 flex-shrink-0" />
            <div className="text-sm">
              <p className="text-orange-200 font-semibold mb-2">Important Notice:</p>
              <ul className="text-orange-100 space-y-1">
                <li>• You must be at least 18 years old to use this platform</li>
                <li>• Lottery participation involves financial risk</li>
                <li>• All transactions are processed through Pi Network</li>
                <li>• Your personal data will be handled according to our privacy policy</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Terms Checkboxes */}
        <div className="space-y-4 mb-6">
          <div className="flex items-start space-x-3">
            <button
              onClick={() => setHasReadTerms(!hasReadTerms)}
              className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-all duration-200 ${
                hasReadTerms 
                  ? 'bg-green-500 border-green-500' 
                  : 'border-gray-400 hover:border-gray-300'
              }`}
            >
              {hasReadTerms && <Check className="w-3 h-3 text-white" />}
            </button>
            <div className="flex-1">
              <label className="text-gray-300 text-sm cursor-pointer">
                I have read and agree to the{' '}
                <Link 
                  to="/terms-of-service" 
                  target="_blank"
                  className="text-blue-400 hover:text-blue-300 underline"
                >
                  Terms of Service
                </Link>
              </label>
            </div>
          </div>

          <div className="flex items-start space-x-3">
            <button
              onClick={() => setHasReadPrivacy(!hasReadPrivacy)}
              className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-all duration-200 ${
                hasReadPrivacy 
                  ? 'bg-green-500 border-green-500' 
                  : 'border-gray-400 hover:border-gray-300'
              }`}
            >
              {hasReadPrivacy && <Check className="w-3 h-3 text-white" />}
            </button>
            <div className="flex-1">
              <label className="text-gray-300 text-sm cursor-pointer">
                I have read and understand the{' '}
                <Link 
                  to="/privacy-policy" 
                  target="_blank"
                  className="text-blue-400 hover:text-blue-300 underline"
                >
                  Privacy Policy
                </Link>
              </label>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex space-x-3">
          <button
            onClick={onAccept}
            disabled={!canAccept}
            className={`flex-1 py-3 px-4 rounded-xl font-medium transition-all duration-300 ${
              canAccept
                ? 'bg-gradient-to-r from-green-500 to-emerald-600 text-white hover:from-green-600 hover:to-emerald-700'
                : 'bg-gray-600 text-gray-400 cursor-not-allowed'
            }`}
          >
            Accept and Continue
          </button>
          <button
            onClick={onDecline}
            className="flex-1 py-3 px-4 bg-white/10 hover:bg-white/20 border border-white/20 rounded-xl font-medium text-white transition-all duration-300"
          >
            Decline
          </button>
        </div>

        {/* Additional Info */}
        <div className="mt-4 text-center">
          <p className="text-gray-400 text-xs">
            By accepting, you confirm that you are at least 18 years old and understand the risks involved in lottery participation.
          </p>
        </div>
      </div>
    </div>
  );
};

export default LegalConsentModal;

// ============================================
// Hook for Managing Legal Consent
// frontend/src/hooks/useLegalConsent.js
// ============================================

import { useState, useEffect } from 'react';

export function useLegalConsent() {
  const [hasConsented, setHasConsented] = useState(false);
  const [showConsentModal, setShowConsentModal] = useState(false);

  useEffect(() => {
    // Check if user has previously consented
    const consent = localStorage.getItem('pi-lottery-legal-consent');
    const consentData = consent ? JSON.parse(consent) : null;
    
    // Check if consent is still valid (e.g., not older than 1 year)
    if (consentData && consentData.timestamp) {
      const oneYearAgo = Date.now() - (365 * 24 * 60 * 60 * 1000);
      if (consentData.timestamp > oneYearAgo) {
        setHasConsented(true);
        return;
      }
    }
    
    // Show consent modal if no valid consent found
    setShowConsentModal(true);
  }, []);

  const acceptConsent = () => {
    const consentData = {
      accepted: true,
      timestamp: Date.now(),
      version: '1.0',
      userAgent: navigator.userAgent
    };
    
    localStorage.setItem('pi-lottery-legal-consent', JSON.stringify(consentData));
    setHasConsented(true);
    setShowConsentModal(false);
  };

  const declineConsent = () => {
    setShowConsentModal(false);
    // Redirect to Pi Network or show alternative message
    window.location.href = 'https://minepi.com';
  };

  return {
    hasConsented,
    showConsentModal,
    acceptConsent,
    declineConsent
  };
}
