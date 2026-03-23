module.exports = {
  preset: 'react-native',
  transform: {
    '^.+\\.(js|ts|tsx)$': 'babel-jest',
  },
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
  setupFiles: [
    './node_modules/react-native-gesture-handler/jestSetup.js'
  ],
  moduleNameMapper: {
    '\\.(png|jpg|jpeg|svg)$': '<rootDir>/__mocks__/fileMock.js',
  },
  testPathIgnorePatterns: ['/node_modules/', '/android/', '/ios/'],
  transformIgnorePatterns: [
    'node_modules/(?!(react-native|@react-native|@react-navigation|@react-native-community|react-clone-referenced-element|@react-native-async-storage|@react-native-picker|@react-native-masked-view|@react-native-segmented-control|@react-native-polyfills|@react-native/.*|react-native-reanimated|react-native-safe-area-context|react-native-screens|react-native-svg|react-native-vector-icons)/)'
  ],
};
