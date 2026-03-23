// import React from 'react';
// import { Text, StyleSheet, View, StyleProp, TextStyle } from 'react-native';
// import { widthPercentageToDP as wp, heightPercentageToDP as hp } from 'react-native-responsive-screen';
// import { useResponsive } from '../hooks/useResponsive';

// const PRIMARY_COLOR = '#3730A5';
// interface GreetingProps {
//   name: string;
//   style?: StyleProp<TextStyle>;
// }

// const Greeting: React.FC<GreetingProps> = ({ name, style }) => {
//   const { screenHeight } = useResponsive();
  
//   const getTimeBasedGreeting = () => {
//     const currentHour = new Date().getHours();
//     if (currentHour < 12) return 'Good morning!!';
//     if (currentHour < 17) return 'Good afternoon!!';
//     return 'Good evening!!';
//   };

//   const greeting = getTimeBasedGreeting();

//   // Detect resolution based on screen height
//   const getResolution = () => {
//     if (screenHeight <= 600) return '480p';
//     if (screenHeight <= 800) return '720p';
//     if (screenHeight <= 1200) return '1080p';
//     return '1440p';
//   };

//   const resolution = getResolution();
//   const is480p = resolution === '480p';
//   const is720p = resolution === '720p';
//   const is1080p = resolution === '1080p';
//   const is1440p = resolution === '1440p';

//   return (
//     <View style={styles.container}>
//       <Text
//         accessible
//         accessibilityRole="text"
//         style={[
//           styles.text,
//           is480p && styles.text480p,
//           is720p && styles.text720p,
//           is1080p && styles.text1080p,
//           is1440p && styles.text1440p,
//           style,
//         ]}
//         numberOfLines={1}
//       >
//         {greeting}
//       </Text>
//     </View>
//   );
// };

// export default Greeting;

// const styles = StyleSheet.create({
//   container: {
//     width: '100%',
//     alignItems: 'center',  
//   },
//   text: {
//     fontSize: hp('2.5%'),
//     fontWeight: '600',
//     color: PRIMARY_COLOR,
//     textAlign: 'center',    // ensure centered text alignment
//     marginTop: hp('2%'),    // gentle top spacing; adjusted per resolution below
//   },
//   text480p: {
//     fontSize: hp('2.7%'),
//     marginTop: hp('1%'),
//   },
//   text720p: {
//     fontSize: hp('2.8%'),
//     marginTop: hp('1.5%'),
//   },
//   text1080p: {
//     fontSize: hp('2.5%'),
//     marginTop: hp('2%'),
//   },
//   text1440p: {
//     fontSize: hp('2.8%'),
//     marginTop: hp('2.5%'),
//   },
// });


// Greeting.tsx (updated — supports real-time updates)
import React, { useEffect, useMemo, useState } from 'react';
import { Text, StyleSheet, View, StyleProp, TextStyle } from 'react-native';
import { widthPercentageToDP as wp, heightPercentageToDP as hp } from 'react-native-responsive-screen';
import { useResponsive } from '../hooks/useResponsive';

const PRIMARY_COLOR = '#3730A5';
interface GreetingProps {
  name?: string;
  style?: StyleProp<TextStyle>;
}

const Greeting: React.FC<GreetingProps> = ({ name, style }) => {
  const { screenHeight } = useResponsive();
  const [greeting, setGreeting] = useState<string>(() => getTimeBasedGreeting(new Date()));

  // compute greeting from a Date object
  function getTimeBasedGreeting(date: Date) {
    const currentHour = date.getHours();
    if (currentHour < 12) return 'Good Morning!!';
    if (currentHour < 17) return 'Good Afternoon!!';
    return 'Good Evening!!';
  }

  // compute milliseconds until next boundary (next hour or next boundary at 12:00 or 17:00)
  const msUntilNextBoundary = useMemo(() => {
    const now = new Date();
    const minutes = now.getMinutes();
    const seconds = now.getSeconds();
    const ms = now.getMilliseconds();
    // boundaries are 12:00 and 17:00 plus each hour we may cross 12/17,
    // but easiest reliable approach: update at next minute, and if crossing boundary it'll re-evaluate.
    // We'll schedule at next minute for simplicity and reliability across platforms.
    return (60 - minutes) * 60 * 1000 - seconds * 1000 - ms;
  }, [/* no deps — computed per render; effect uses it */]);

  useEffect(() => {
    // update right away (in case device time changed while component mounted)
    setGreeting(getTimeBasedGreeting(new Date()));

    // Schedule a timer to update at next minute boundary, then every minute.
    // This is efficient enough and ensures greeting updates within 60s of boundary.
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    let intervalId: ReturnType<typeof setInterval> | null = null;

    // set a one-off timeout to align to next minute
    timeoutId = setTimeout(() => {
      setGreeting(getTimeBasedGreeting(new Date()));

      // then set an interval to update every 60s
      intervalId = setInterval(() => {
        setGreeting(getTimeBasedGreeting(new Date()));
      }, 60 * 1000);
    }, msUntilNextBoundary > 0 ? msUntilNextBoundary : 60 * 1000);

    return () => {
      if (timeoutId) clearTimeout(timeoutId);
      if (intervalId) clearInterval(intervalId);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // run on mount only

  // Detect resolution based on screen height (kept your original logic)
  const getResolution = () => {
    if (screenHeight <= 600) return '480p';
    if (screenHeight <= 800) return '720p';
    if (screenHeight <= 1200) return '1080p';
    return '1440p';
  };

  const resolution = getResolution();
  const is480p = resolution === '480p';
  const is720p = resolution === '720p';
  const is1080p = resolution === '1080p';
  const is1440p = resolution === '1440p';

  return (
    <View style={styles.container}>
      <Text
        accessible
        accessibilityRole="text"
        style={[
          styles.text,
          is480p && styles.text480p,
          is720p && styles.text720p,
          is1080p && styles.text1080p,
          is1440p && styles.text1440p,
          style,
        ]}
        numberOfLines={1}
      >
        {greeting}
      </Text>
    </View>
  );
};

export default Greeting;

const styles = StyleSheet.create({
  container: {
    width: '100%',
    alignItems: 'center',
  },
  text: {
    fontSize: hp('2.5%'),
    fontWeight: '600',
    color: PRIMARY_COLOR,
    textAlign: 'center',
    marginTop: hp('2%'),
  },
  text480p: {
    fontSize: hp('2.7%'),
    marginTop: hp('1%'),
  },
  text720p: {
    fontSize: hp('2.8%'),
    marginTop: hp('1.5%'),
  },
  text1080p: {
    fontSize: hp('2.5%'),
    marginTop: hp('2%'),
  },
  text1440p: {
    fontSize: hp('2.8%'),
    marginTop: hp('2.5%'),
  },
});
