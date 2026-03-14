module.exports = {
  dependencies: {
    'react-native-sms-android': {
      platforms: {
        android: null,
        ios: null,
      },
    },
    'react-native-share': {
      platforms: {
        android: {
          packageInstance: 'new RNSharePackage()',
          packageImportPath: 'import cl.json.RNSharePackage;',
        },
      },
    },
  },
  assets: ['./src/assets/fonts'],
};
