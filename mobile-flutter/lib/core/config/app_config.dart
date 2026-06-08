/// App-wide configuration — mirrors Mobile/src/config/index.ts exactly.
/// All URL values are read from dart-define at build time with sensible defaults.
library app_config;

const bool _forceProduction = true;

const String _prodApiUrl = 'https://customerapi.gupio.tech';
const String _devApiUrl = 'http://10.0.2.2:8000'; // FastAPI port

/// Base API URL — no trailing slash.
const String apiBaseUrl = bool.fromEnvironment('FLUTTER_DEV', defaultValue: false) && !_forceProduction
    ? _devApiUrl
    : _prodApiUrl;

/// Socket.io base URL.
const String socketBaseUrl = apiBaseUrl;

/// Google Sign-In web client ID (same as React Native GOOGLE_WEB_CLIENT_ID).
const String googleWebClientId =
    '1024404965563-segb2pqhssinho0a4m74nq4d9e0tg569.apps.googleusercontent.com';

/// Build an absolute URL for a relative path (uploads, profile pics, etc.).
String getAbsoluteUrl(String? path) {
  if (path == null || path.isEmpty) return '';
  if (path.startsWith('http://') || path.startsWith('https://')) return path;
  final base = apiBaseUrl.replaceAll(RegExp(r'/$'), '');
  return path.startsWith('/') ? '$base$path' : '$base/$path';
}
