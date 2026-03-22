'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';

interface PermissionStatus {
  microphone: PermissionState;
  camera: PermissionState;
  location: PermissionState;
}

type PermissionState = 'granted' | 'denied' | 'prompt' | 'unknown';

export default function SystemStatusPage() {
  const [permissions, setPermissions] = useState<PermissionStatus>({
    microphone: 'unknown',
    camera: 'unknown',
    location: 'unknown',
  });
  const [loading, setLoading] = useState(true);
  const [browserInfo, setBrowserInfo] = useState('');

  useEffect(() => {
    checkPermissions();
    detectBrowser();
  }, []);

  const checkPermissions = async () => {
    try {
      const mic = await navigator.permissions.query({ name: 'microphone' as PermissionName });
      const cam = await navigator.permissions.query({ name: 'camera' as PermissionName });
      const loc = await navigator.permissions.query({ name: 'geolocation' as PermissionName });

      setPermissions({
        microphone: mic.state,
        camera: cam.state,
        location: loc.state,
      });

      // Listen for changes
      mic.addEventListener('change', () => {
        setPermissions(p => ({ ...p, microphone: mic.state }));
      });
      cam.addEventListener('change', () => {
        setPermissions(p => ({ ...p, camera: cam.state }));
      });
      loc.addEventListener('change', () => {
        setPermissions(p => ({ ...p, location: loc.state }));
      });
    } catch (error) {
      console.error('Permission check failed:', error);
    } finally {
      setLoading(false);
    }
  };

  const detectBrowser = () => {
    const ua = navigator.userAgent;
    let browser = 'Unknown';
    if (ua.indexOf('Firefox') > -1) browser = 'Firefox';
    else if (ua.indexOf('Chrome') > -1) browser = 'Chrome';
    else if (ua.indexOf('Safari') > -1) browser = 'Safari';
    else if (ua.indexOf('Edge') > -1) browser = 'Edge';

    setBrowserInfo(`${browser} • ${navigator.language}`);
  };

  const requestMicrophonePermission = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      // Stop all tracks to release the microphone
      stream.getTracks().forEach(track => track.stop());
      checkPermissions();
    } catch (error: any) {
      const errorName = error?.name || 'Unknown';
      const errorMsg = error?.message || 'Unknown error';
      
      if (errorName === 'NotAllowedError') {
        alert(
          '❌ Microphone Access Blocked\n\n' +
          'To fix:\n' +
          '1. Click the lock 🔒 in the address bar\n' +
          '2. Find "Microphone" in permissions\n' +
          '3. Change to "Allow"\n' +
          '4. Reload the page\n\n' +
          'Then try again!'
        );
      } else if (errorName === 'NotFoundError') {
        alert('❌ No microphone found\n\nPlease connect a microphone to your device.');
      } else {
        console.error('Microphone request failed:', errorName, errorMsg);
        alert(`❌ Error: ${errorName}\n\n${errorMsg}`);
      }
    }
  };

  const resetPermissions = () => {
    if (typeof window !== 'undefined') {
      alert('Browser permissions reset. Reload the page and try again.');
      window.location.reload();
    }
  };

  const getPermissionColor = (state: PermissionState) => {
    switch (state) {
      case 'granted':
        return 'bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800';
      case 'denied':
        return 'bg-red-50 dark:bg-red-950 border-red-200 dark:border-red-800';
      case 'prompt':
        return 'bg-yellow-50 dark:bg-yellow-950 border-yellow-200 dark:border-yellow-800';
      default:
        return 'bg-gray-50 dark:bg-gray-900 border-gray-200 dark:border-gray-800';
    }
  };

  const getPermissionIcon = (state: PermissionState) => {
    switch (state) {
      case 'granted':
        return '✅';
      case 'denied':
        return '❌';
      case 'prompt':
        return '⚠️';
      default:
        return '❓';
    }
  };

  const getPermissionText = (state: PermissionState) => {
    switch (state) {
      case 'granted':
        return 'Allowed';
      case 'denied':
        return 'Blocked';
      case 'prompt':
        return 'Not asked yet';
      default:
        return 'Unknown';
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-12"
        >
          <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-3">
            🩸 SmartBlood System Status
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            {browserInfo && `${browserInfo} • `}Check permissions and configure your system
          </p>
        </motion.div>

        {/* Permission Cards */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8"
        >
          {/* Microphone */}
          <motion.div
            whileHover={{ scale: 1.02 }}
            className={`p-6 rounded-2xl border-2 transition-all shadow-lg ${getPermissionColor(
              permissions.microphone
            )}`}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">🎤 Microphone</h3>
              <span className="text-2xl">{getPermissionIcon(permissions.microphone)}</span>
            </div>
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-4">
              Status: <span className="font-bold">{getPermissionText(permissions.microphone)}</span>
            </p>
            {permissions.microphone !== 'granted' && (
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={requestMicrophonePermission}
                className="w-full px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg font-semibold transition-colors"
              >
                Enable Microphone
              </motion.button>
            )}
            {permissions.microphone === 'granted' && (
              <p className="text-xs text-green-600 dark:text-green-400">
                ✓ Ready for voice input
              </p>
            )}
          </motion.div>

          {/* Camera */}
          <motion.div
            whileHover={{ scale: 1.02 }}
            className={`p-6 rounded-2xl border-2 transition-all shadow-lg ${getPermissionColor(
              permissions.camera
            )}`}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">📹 Camera</h3>
              <span className="text-2xl">{getPermissionIcon(permissions.camera)}</span>
            </div>
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-4">
              Status: <span className="font-bold">{getPermissionText(permissions.camera)}</span>
            </p>
            <p className="text-xs text-gray-600 dark:text-gray-400">Not required for this version</p>
          </motion.div>

          {/* Location */}
          <motion.div
            whileHover={{ scale: 1.02 }}
            className={`p-6 rounded-2xl border-2 transition-all shadow-lg ${getPermissionColor(
              permissions.location
            )}`}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">📍 Location</h3>
              <span className="text-2xl">{getPermissionIcon(permissions.location)}</span>
            </div>
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-4">
              Status: <span className="font-bold">{getPermissionText(permissions.location)}</span>
            </p>
            <p className="text-xs text-gray-600 dark:text-gray-400">Optional for nearby hospitals</p>
          </motion.div>
        </motion.div>

        {/* Instructions */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-white dark:bg-gray-900 rounded-2xl p-8 shadow-lg border border-gray-200 dark:border-gray-800 mb-8"
        >
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">
            🔧 Setup Instructions
          </h2>

          <div className="space-y-6">
            {/* Browser Specific Instructions */}
            <div className="border-l-4 border-red-500 pl-4">
              <h3 className="font-bold text-gray-900 dark:text-white mb-3">
                ⚡ Enable Microphone Permission
              </h3>
              <div className="space-y-3 text-sm text-gray-700 dark:text-gray-300">
                <p>
                  <strong>Option 1: Automatic (Recommended)</strong>
                </p>
                <ol className="list-decimal list-inside space-y-2 ml-2">
                  <li>Click the <strong>"Enable Microphone"</strong> button above</li>
                  <li>Browser will ask for permission</li>
                  <li>Click <strong>"Allow"</strong></li>
                  <li>Microphone is ready! ✓</li>
                </ol>

                <p className="mt-4">
                  <strong>Option 2: Manual (If automatic doesn't work)</strong>
                </p>
                <ol className="list-decimal list-inside space-y-2 ml-2">
                  <li>Click the <strong>Lock 🔒</strong> icon in the address bar</li>
                  <li>Find <strong>"Microphone"</strong> option</li>
                  <li>Click <strong>"Allow"</strong> or change to <strong>"Allow"</strong></li>
                  <li>Reload the page</li>
                  <li>Try voice input in the chatbot</li>
                </ol>

                <p className="mt-4">
                  <strong>Option 3: Reset & Try Again</strong>
                </p>
                <ol className="list-decimal list-inside space-y-2 ml-2">
                  <li>Click <strong>"Reset Permissions"</strong> button below</li>
                  <li>Click <strong>Lock 🔒</strong> → <strong>"Microphone"</strong> → <strong>"Clear"</strong></li>
                  <li>Reload page and grant permission again</li>
                </ol>
              </div>
            </div>

            {/* Common Issues */}
            <div className="border-l-4 border-yellow-500 pl-4">
              <h3 className="font-bold text-gray-900 dark:text-white mb-3">
                ❓ Common Issues
              </h3>
              <ul className="space-y-2 text-sm text-gray-700 dark:text-gray-300">
                <li>
                  <strong>Still asking for permission?</strong> Use Option 3 above
                </li>
                <li>
                  <strong>Microphone not found?</strong> Check if microphone is connected and enabled in system settings
                </li>
                <li>
                  <strong>Can't hear yourself?</strong> Check browser audio input settings
                </li>
                <li>
                  <strong>Want to use it in offline mode?</strong> HTTPS required for microphone access
                </li>
              </ul>
            </div>

            {/* Info Box */}
            <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
              <p className="text-sm text-blue-900 dark:text-blue-100">
                <strong>ℹ️ Info:</strong> The microphone is used ONLY for voice input in the chatbot. Your audio is never recorded or stored. We only process the transcribed text.
              </p>
            </div>
          </div>
        </motion.div>

        {/* Quick Test */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-gradient-to-r from-red-50 to-red-100 dark:from-red-950 dark:to-red-900 rounded-2xl p-8 shadow-lg border border-red-200 dark:border-red-800 mb-8"
        >
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
            🎤 Test Microphone
          </h2>
          <p className="text-gray-700 dark:text-gray-300 mb-4">
            Once microphone is allowed, go to the chatbot and try:
          </p>
          <ol className="list-decimal list-inside space-y-2 text-gray-700 dark:text-gray-300 mb-6">
            <li>Click the 🎤 voice button in the chatbot</li>
            <li>Say something like "Hello"</li>
            <li>Your voice should be transcribed to text</li>
            <li>Message should be sent automatically</li>
          </ol>

          <motion.a
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            href="/"
            className="inline-block px-6 py-3 bg-red-600 hover:bg-red-700 text-white font-bold rounded-lg transition-colors"
          >
            Go to Chatbot →
          </motion.a>
        </motion.div>

        {/* System Actions */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="flex flex-col sm:flex-row gap-4"
        >
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={checkPermissions}
            className="flex-1 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg transition-colors"
          >
            🔄 Refresh Status
          </motion.button>

          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={resetPermissions}
            className="flex-1 px-6 py-3 bg-red-600 hover:bg-red-700 text-white font-bold rounded-lg transition-colors"
          >
            ⚠️ Reset Permissions
          </motion.button>

          <motion.a
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            href="/"
            className="flex-1 px-6 py-3 bg-green-600 hover:bg-green-700 text-white font-bold rounded-lg transition-colors text-center"
          >
            Home Page →
          </motion.a>
        </motion.div>

        {/* Footer Info */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="mt-12 text-center text-sm text-gray-600 dark:text-gray-400"
        >
          <p>SmartBlood © 2024 • Status Page v1.0</p>
          <p className="mt-2">
            Need help?{' '}
            <a href="#" className="text-red-600 dark:text-red-400 hover:underline">
              Contact Support
            </a>
          </p>
        </motion.div>
      </div>
    </div>
  );
}
