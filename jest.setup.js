/**
 * Jest setup — mock native modules not available in Node tests.
 */
/* eslint-env jest */

jest.mock('expo-notifications', () => ({
  setNotificationHandler: jest.fn(),
  getPermissionsAsync: jest.fn(async () => ({ granted: true })),
  requestPermissionsAsync: jest.fn(async () => ({ granted: true })),
  setNotificationChannelAsync: jest.fn(async () => undefined),
  cancelScheduledNotificationAsync: jest.fn(async () => undefined),
  scheduleNotificationAsync: jest.fn(async () => undefined),
  SchedulableTriggerInputTypes: { DAILY: 'daily' },
  AndroidImportance: { DEFAULT: 3 },
  IosAuthorizationStatus: { PROVISIONAL: 2 },
}));

jest.mock('@react-native-community/datetimepicker', () => 'DateTimePicker');

jest.mock('expo-file-system', () => ({
  documentDirectory: 'file:///mock-doc/',
  getInfoAsync: jest.fn(async () => ({ exists: false })),
  makeDirectoryAsync: jest.fn(async () => undefined),
  copyAsync: jest.fn(async () => undefined),
  deleteAsync: jest.fn(async () => undefined),
}));

jest.mock('expo-file-system/legacy', () => ({
  documentDirectory: 'file:///mock-doc/',
  getInfoAsync: jest.fn(async () => ({ exists: false })),
  makeDirectoryAsync: jest.fn(async () => undefined),
  copyAsync: jest.fn(async () => undefined),
  deleteAsync: jest.fn(async () => undefined),
}));

jest.mock('expo-image-picker', () => ({
  requestMediaLibraryPermissionsAsync: jest.fn(async () => ({ granted: true })),
  requestCameraPermissionsAsync: jest.fn(async () => ({ granted: true })),
  launchImageLibraryAsync: jest.fn(async () => ({ canceled: true, assets: [] })),
  launchCameraAsync: jest.fn(async () => ({ canceled: true, assets: [] })),
}));

jest.mock('yandex-mobile-ads', () => ({
  MobileAds: {
    initialize: jest.fn(async () => undefined),
  },
  InterstitialAdLoader: {
    create: jest.fn(async () => ({
      loadAd: jest.fn(async () => ({
        show: jest.fn(async () => undefined),
      })),
    })),
  },
  BannerView: 'BannerView',
  BannerAdSize: {
    stickySize: jest.fn(async () => ({
      width: 320,
      height: 50,
    })),
  },
}));

jest.mock('@appmetrica/react-native-analytics', () => ({
  __esModule: true,
  default: {
    activate: jest.fn(),
    reportEvent: jest.fn(),
  },
}));
