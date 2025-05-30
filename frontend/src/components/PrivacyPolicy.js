// ============================================
// Privacy Policy Component
// frontend/src/components/PrivacyPolicy.js
// ============================================

import React from 'react';
import { ArrowLeft, Shield, Eye, Lock, Database, Globe } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const PrivacyPolicy = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 text-white">
      <div className="container mx-auto px-4 py-6 max-w-4xl">
        
        {/* Header */}
        <header className="flex items-center justify-between mb-8 p-4 bg-white/5 backdrop-blur-lg rounded-2xl border border-white/10">
          <button 
            onClick={() => navigate('/')}
            className="flex items-center space-x-2 text-gray-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            <span>Back to Lottery</span>
          </button>
          <div className="flex items-center space-x-3">
            <Shield className="w-8 h-8 text-blue-400" />
            <h1 className="text-2xl font-bold">Privacy Policy</h1>
          </div>
        </header>

        {/* Privacy Policy Content */}
        <div className="bg-white/5 backdrop-blur-lg rounded-3xl p-8 border border-white/10">
          
          {/* Introduction */}
          <section className="mb-8">
            <div className="flex items-center space-x-3 mb-4">
              <Eye className="w-6 h-6 text-green-400" />
              <h2 className="text-xl font-bold">Introduction</h2>
            </div>
            <p className="text-gray-300 leading-relaxed">
              Welcome to the Pi Ecosystem Lottery App. We are committed to protecting your privacy and ensuring 
              the security of your personal information. This Privacy Policy explains how we collect, use, disclose, 
              and safeguard your information when you use our decentralized lottery platform integrated with Pi Network.
            </p>
            <p className="text-gray-300 leading-relaxed mt-4">
              <strong>Effective Date:</strong> {new Date().toLocaleDateString()}<br />
              <strong>Last Updated:</strong> {new Date().toLocaleDateString()}
            </p>
          </section>

          {/* Information We Collect */}
          <section className="mb-8">
            <div className="flex items-center space-x-3 mb-4">
              <Database className="w-6 h-6 text-blue-400" />
              <h2 className="text-xl font-bold">Information We Collect</h2>
            </div>
            
            <div className="space-y-6">
              <div className="bg-white/5 rounded-xl p-4">
                <h3 className="font-semibold text-yellow-400 mb-2">Personal Information</h3>
                <ul className="text-gray-300 space-y-1 text-sm">
                  <li>• Pi Network wallet address for authentication and transactions</li>
                  <li>• Username and profile preferences from Pi Network</li>
                  <li>• Email address (if provided for notifications)</li>
                  <li>• Transaction history including lottery entries and prize distributions</li>
                </ul>
              </div>

              <div className="bg-white/5 rounded-xl p-4">
                <h3 className="font-semibold text-blue-400 mb-2">Lottery Participation Data</h3>
                <ul className="text-gray-300 space-y-1 text-sm">
                  <li>• Entry records including tickets purchased and timestamps</li>
                  <li>• Prize information and payout history</li>
                  <li>• Statistical data such as win rates and participation frequency</li>
                </ul>
              </div>

              <div className="bg-white/5 rounded-xl p-4">
                <h3 className="font-semibold text-purple-400 mb-2">Technical Information</h3>
                <ul className="text-gray-300 space-y-1 text-sm">
                  <li>• Device information including browser type and operating system</li>
                  <li>• Usage data such as app interaction patterns and session duration</li>
                  <li>• Network information including IP address and general location</li>
                  <li>• Performance data and error logs for platform improvement</li>
                </ul>
              </div>
            </div>
          </section>

          {/* How We Use Your Information */}
          <section className="mb-8">
            <div className="flex items-center space-x-3 mb-4">
              <Lock className="w-6 h-6 text-green-400" />
              <h2 className="text-xl font-bold">How We Use Your Information</h2>
            </div>
            
            <div className="grid md:grid-cols-2 gap-6">
              <div className="bg-white/5 rounded-xl p-4">
                <h3 className="font-semibold text-green-400 mb-3">Primary Purposes</h3>
                <ul className="text-gray-300 space-y-2 text-sm">
                  <li>• Operating the lottery platform and processing participation</li>
                  <li>• Handling Pi cryptocurrency payments and prize distributions</li>
                  <li>• Managing your account and wallet connections</li>
                  <li>• Conducting fair drawings and distributing prizes</li>
                </ul>
              </div>

              <div className="bg-white/5 rounded-xl p-4">
                <h3 className="font-semibold text-blue-400 mb-3">Secondary Purposes</h3>
                <ul className="text-gray-300 space-y-2 text-sm">
                  <li>• Analyzing usage patterns to enhance user experience</li>
                  <li>• Detecting fraud and maintaining platform integrity</li>
                  <li>• Sending important updates and winner announcements</li>
                  <li>• Meeting legal obligations and regulatory requirements</li>
                </ul>
              </div>
            </div>
          </section>

          {/* Data Security */}
          <section className="mb-8">
            <div className="flex items-center space-x-3 mb-4">
              <Shield className="w-6 h-6 text-red-400" />
              <h2 className="text-xl font-bold">Data Security</h2>
            </div>
            
            <div className="bg-gradient-to-r from-red-500/10 to-orange-500/10 rounded-xl p-6 border border-red-500/20">
              <h3 className="font-semibold text-red-400 mb-3">Security Measures</h3>
              <div className="grid md:grid-cols-2 gap-4 text-sm text-gray-300">
                <div>
                  <p className="font-medium text-white mb-2">Technical Safeguards:</p>
                  <ul className="space-y-1">
                    <li>• End-to-end encryption for all sensitive data</li>
                    <li>• Secure Firebase security rules</li>
                    <li>• Regular security audits and vulnerability testing</li>
                  </ul>
                </div>
                <div>
                  <p className="font-medium text-white mb-2">Access Controls:</p>
                  <ul className="space-y-1">
                    <li>• Strict access limitations for authorized personnel</li>
                    <li>• Multi-factor authentication for admin accounts</li>
                    <li>• Continuous monitoring and threat detection</li>
                  </ul>
                </div>
              </div>
              <div className="mt-4 p-3 bg-yellow-500/20 rounded-lg border border-yellow-500/30">
                <p className="text-yellow-200 text-sm">
                  <strong>Important:</strong> We never store your Pi wallet private keys or seed phrases. 
                  All wallet interactions use secure Pi SDK protocols requiring your explicit authorization.
                </p>
              </div>
            </div>
          </section>

          {/* Your Rights */}
          <section className="mb-8">
            <div className="flex items-center space-x-3 mb-4">
              <Globe className="w-6 h-6 text-purple-400" />
              <h2 className="text-xl font-bold">Your Privacy Rights</h2>
            </div>
            
            <div className="bg-white/5 rounded-xl p-6">
              <div className="grid md:grid-cols-3 gap-6 text-sm">
                <div>
                  <h3 className="font-semibold text-purple-400 mb-2">Access & Control</h3>
                  <ul className="text-gray-300 space-y-1">
                    <li>• View and update profile information</li>
                    <li>• Access complete lottery history</li>
                    <li>• Request data export</li>
                    <li>• Account deletion requests</li>
                  </ul>
                </div>
                <div>
                  <h3 className="font-semibold text-blue-400 mb-2">Communication</h3>
                  <ul className="text-gray-300 space-y-1">
                    <li>• Control lottery notifications</li>
                    <li>• Opt-out of promotional messages</li>
                    <li>• Manage winner announcements</li>
                  </ul>
                </div>
                <div>
                  <h3 className="font-semibold text-green-400 mb-2">Regional Rights</h3>
                  <ul className="text-gray-300 space-y-1">
                    <li>• GDPR (EU/UK) compliance</li>
                    <li>• CCPA (California) rights</li>
                    <li>• Local privacy law compliance</li>
                  </ul>
                </div>
              </div>
            </div>
          </section>

          {/* Contact Information */}
          <section className="mb-6">
            <h2 className="text-xl font-bold mb-4">Contact Information</h2>
            <div className="bg-gradient-to-r from-blue-500/10 to-purple-500/10 rounded-xl p-6 border border-blue-500/20">
              <p className="text-gray-300 mb-4">
                For questions about this Privacy Policy or our privacy practices:
              </p>
              <div className="grid md:grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="font-semibold text-blue-400">Privacy Inquiries:</p>
                  <p className="text-gray-300">Email: privacy@pilottery.app</p>
                  <p className="text-gray-300">Response time: Within 30 days</p>
                </div>
                <div>
                  <p className="font-semibold text-purple-400">GDPR Inquiries:</p>
                  <p className="text-gray-300">Email: dpo@pilottery.app</p>
                  <p className="text-gray-300">Data Protection Officer</p>
                </div>
              </div>
            </div>
          </section>

          {/* Last Updated */}
          <div className="text-center pt-6 border-t border-white/10">
            <p className="text-gray-400 text-sm">
              This Privacy Policy was last updated on {new Date().toLocaleDateString()}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

// ============================================
// Terms of Service Component
// frontend/src/components/TermsOfService.js
// ============================================

import React from 'react';
import { ArrowLeft, FileText, Scale, AlertTriangle, Shield } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const TermsOfService = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 text-white">
      <div className="container mx-auto px-4 py-6 max-w-4xl">
        
        {/* Header */}
        <header className="flex items-center justify-between mb-8 p-4 bg-white/5 backdrop-blur-lg rounded-2xl border border-white/10">
          <button 
            onClick={() => navigate('/')}
            className="flex items-center space-x-2 text-gray-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            <span>Back to Lottery</span>
          </button>
          <div className="flex items-center space-x-3">
            <Scale className="w-8 h-8 text-purple-400" />
            <h1 className="text-2xl font-bold">Terms of Service</h1>
          </div>
        </header>

        {/* Terms of Service Content */}
        <div className="bg-white/5 backdrop-blur-lg rounded-3xl p-8 border border-white/10">
          
          {/* Introduction */}
          <section className="mb-8">
            <div className="flex items-center space-x-3 mb-4">
              <FileText className="w-6 h-6 text-blue-400" />
              <h2 className="text-xl font-bold">Acceptance of Terms</h2>
            </div>
            <div className="bg-blue-500/10 rounded-xl p-6 border border-blue-500/20">
              <p className="text-gray-300 leading-relaxed">
                By accessing or using the Pi Ecosystem Lottery App, you agree to be bound by these Terms of Service. 
                If you do not agree to these Terms, you may not access or use our Service.
              </p>
              <div className="mt-4 p-3 bg-yellow-500/20 rounded-lg border border-yellow-500/30">
                <p className="text-yellow-200 text-sm">
                  <strong>Age Requirement:</strong> You must be at least 18 years old to use this Service.
                </p>
              </div>
            </div>
          </section>

          {/* Service Description */}
          <section className="mb-8">
            <div className="flex items-center space-x-3 mb-4">
              <Shield className="w-6 h-6 text-green-400" />
              <h2 className="text-xl font-bold">Service Description</h2>
            </div>
            
            <div className="space-y-4">
              <div className="bg-white/5 rounded-xl p-4">
                <h3 className="font-semibold text-green-400 mb-2">Platform Overview</h3>
                <p className="text-gray-300 text-sm">
                  The Pi Ecosystem Lottery App is a decentralized lottery platform that allows users to 
                  participate in lottery drawings using Pi cryptocurrency and advertisement viewing.
                </p>
              </div>

              <div className="bg-white/5 rounded-xl p-4">
                <h3 className="font-semibold text-blue-400 mb-3">Core Features</h3>
                <div className="grid md:grid-cols-2 gap-4 text-sm text-gray-300">
                  <ul className="space-y-1">
                    <li>• Multiple lottery types (Daily, Weekly, Monthly)</li>
                    <li>• Pi cryptocurrency payment processing</li>
                    <li>• Advertisement-based free entries</li>
                  </ul>
                  <ul className="space-y-1">
                    <li>• Transparent prize distribution</li>
                    <li>• Real-time lottery updates</li>
                    <li>• Secure wallet integration</li>
                  </ul>
                </div>
              </div>

              <div className="bg-white/5 rounded-xl p-4">
                <h3 className="font-semibold text-purple-400 mb-3">Entry Fees and Prizes</h3>
                <div className="text-sm text-gray-300 space-y-2">
                  <p><strong>Entry Fee:</strong> 1.0 π per lottery ticket (except ad lottery)</p>
                  <p><strong>Platform Fee:</strong> 0.1 π per ticket (deducted from entry fee)</p>
                  <p><strong>Prize Pool:</strong> 0.9 π per participant contributes to total prize pool</p>
                  <p><strong>Ad Lottery:</strong> Free entry via 30-second advertisement viewing</p>
                </div>
              </div>
            </div>
          </section>

          {/* User Obligations */}
          <section className="mb-8">
            <div className="flex items-center space-x-3 mb-4">
              <AlertTriangle className="w-6 h-6 text-orange-400" />
              <h2 className="text-xl font-bold">User Obligations and Conduct</h2>
            </div>
            
            <div className="bg-gradient-to-r from-orange-500/10 to-red-500/10 rounded-xl p-6 border border-orange-500/20">
              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <h3 className="font-semibold text-green-400 mb-3">You MUST:</h3>
                  <ul className="text-gray-300 space-y-1 text-sm">
                    <li>• Maintain security of your Pi wallet and credentials</li>
                    <li>• Provide accurate information during registration</li>
                    <li>• Notify us of any unauthorized account access</li>
                    <li>• Comply with all applicable laws and regulations</li>
                    <li>• Participate only with funds you can afford to lose</li>
                  </ul>
                </div>
                <div>
                  <h3 className="font-semibold text-red-400 mb-3">You MUST NOT:</h3>
                  <ul className="text-gray-300 space-y-1 text-sm">
                    <li>• Use the service for illegal or unauthorized purposes</li>
                    <li>• Attempt to manipulate lottery results</li>
                    <li>• Create multiple accounts to circumvent limits</li>
                    <li>• Use automated systems, bots, or scripts</li>
                    <li>• Interfere with proper functioning of the service</li>
                  </ul>
                </div>
              </div>
            </div>
          </section>

          {/* Lottery Operations */}
          <section className="mb-8">
            <div className="flex items-center space-x-3 mb-4">
              <FileText className="w-6 h-6 text-yellow-400" />
              <h2 className="text-xl font-bold">Lottery Operations</h2>
            </div>
            
            <div className="grid md:grid-cols-3 gap-4">
              <div className="bg-white/5 rounded-xl p-4">
                <h3 className="font-semibold text-yellow-400 mb-2">Fair Play</h3>
                <ul className="text-gray-300 space-y-1 text-sm">
                  <li>• Verifiable random number generation</li>
                  <li>• No manipulation or bias in results</li>
                  <li>• Pure chance-based winner selection</li>
                </ul>
              </div>
              <div className="bg-white/5 rounded-xl p-4">
                <h3 className="font-semibold text-blue-400 mb-2">Prize Distribution</h3>
                <ul className="text-gray-300 space-y-1 text-sm">
                  <li>• Calculated based on total prize pool</li>
                  <li>• Requires administrative confirmation</li>
                  <li>• Winners notified via platform</li>
                </ul>
              </div>
              <div className="bg-white/5 rounded-xl p-4">
                <h3 className="font-semibold text-purple-400 mb-2">Unclaimed Prizes</h3>
                <ul className="text-gray-300 space-y-1 text-sm">
                  <li>• 90-day claim period</li>
                  <li>• Forfeited prizes return to future pools</li>
                  <li>• No extensions beyond 90 days</li>
                </ul>
              </div>
            </div>
          </section>

          {/* Fees and Payments */}
          <section className="mb-8">
            <div className="flex items-center space-x-3 mb-4">
              <Scale className="w-6 h-6 text-green-400" />
              <h2 className="text-xl font-bold">Fees and Payments</h2>
            </div>
            
            <div className="bg-green-500/10 rounded-xl p-6 border border-green-500/20">
              <div className="grid md:grid-cols-2 gap-6 text-sm">
                <div>
                  <h3 className="font-semibold text-green-400 mb-3">Entry Fees</h3>
                  <ul className="text-gray-300 space-y-2">
                    <li>• <strong>Standard entry fee:</strong> 1.0 π per ticket</li>
                    <li>• <strong>Platform fee:</strong> 0.1 π per ticket</li>
                    <li>• <strong>Prize contribution:</strong> 0.9 π per ticket</li>
                    <li>• <strong>Ad lottery:</strong> Free via advertisement viewing</li>
                  </ul>
                </div>
                <div>
                  <h3 className="font-semibold text-red-400 mb-3">Important Notes</h3>
                  <ul className="text-gray-300 space-y-2">
                    <li>• <strong>No refunds:</strong> All fees are final once paid</li>
                    <li>• <strong>Pi Network fees:</strong> Additional blockchain fees may apply</li>
                    <li>• <strong>Prize payments:</strong> Made directly to your Pi wallet</li>
                    <li>• <strong>Processing time:</strong> Subject to Pi Network confirmation</li>
                  </ul>
                </div>
              </div>
            </div>
          </section>

          {/* Disclaimers */}
          <section className="mb-8">
            <div className="flex items-center space-x-3 mb-4">
              <AlertTriangle className="w-6 h-6 text-red-400" />
              <h2 className="text-xl font-bold">Disclaimers and Limitations</h2>
            </div>
            
            <div className="bg-gradient-to-r from-red-500/10 to-orange-500/10 rounded-xl p-6 border border-red-500/20">
              <div className="space-y-4 text-sm text-gray-300">
                <div>
                  <h3 className="font-semibold text-red-400 mb-2">Service Availability</h3>
                  <p>The service is provided "as is" without warranties. We do not guarantee continuous access. 
                  Technical issues or Pi Network problems may affect availability.</p>
                </div>
                <div>
                  <h3 className="font-semibold text-orange-400 mb-2">Investment Disclaimer</h3>
                  <p>Lottery participation is not an investment and involves risk of loss. Past results do not 
                  guarantee future outcomes. You may lose all funds used for entries.</p>
                </div>
                <div>
                  <h3 className="font-semibold text-yellow-400 mb-2">Limitation of Liability</h3>
                  <p>We are not liable for indirect, incidental, special, or consequential damages arising 
                  from your use of the service, to the maximum extent permitted by law.</p>
                </div>
              </div>
            </div>
          </section>

          {/* Contact Information */}
          <section className="mb-6">
            <h2 className="text-xl font-bold mb-4">Contact Information</h2>
            <div className="bg-gradient-to-r from-blue-500/10 to-purple-500/10 rounded-xl p-6 border border-blue-500/20">
              <p className="text-gray-300 mb-4">
                For questions about these Terms of Service:
              </p>
              <div className="text-sm text-gray-300">
                <p><strong>Email:</strong> legal@pilottery.app</p>
                <p><strong>Support:</strong> support@pilottery.app</p>
                <p><strong>Response Time:</strong> Within 48 hours</p>
              </div>
            </div>
          </section>

          {/* Acceptance */}
          <div className="text-center pt-6 border-t border-white/10">
            <p className="text-gray-400 text-sm">
              By using the Pi Ecosystem Lottery App, you acknowledge that you have read, understood, 
              and agree to be bound by these Terms of Service.
            </p>
            <p className="text-gray-500 text-xs mt-2">
              Last updated: {new Date().toLocaleDateString()}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export { PrivacyPolicy, TermsOfService };
