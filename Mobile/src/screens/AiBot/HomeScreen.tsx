// import React, { useEffect } from "react";
// import { View, StyleSheet } from "react-native";
// import Svg, { Circle, Defs, RadialGradient, Stop } from "react-native-svg";
// // import Animated, {
// //   useSharedValue,
// //   useAnimatedStyle,
// //   withTiming,
// //   withRepeat,
// //   Easing,
// // } from "react-native-reanimated";

// const SIZE = 180;

// export default function AnimatedOrb() {
//   const scale = useSharedValue(1);
//   const rotation = useSharedValue(0);

//   useEffect(() => {
//     // Breathing pulse
//     scale.value = withRepeat(
//       withTiming(1.08, {
//         duration: 3000,
//         easing: Easing.inOut(Easing.ease),
//       }),
//       -1,
//       true
//     );

//     // Slow rotation
//     rotation.value = withRepeat(
//       withTiming(360, {
//         duration: 20000,
//         easing: Easing.linear,
//       }),
//       -1
//     );
//   }, []);

//   const animatedStyle = useAnimatedStyle(() => ({
//     transform: [
//       { scale: scale.value },
//       { rotate: `${rotation.value}deg` },
//     ],
//   }));

//   return (
//     <View style={styles.container}>
//       <Animated.View style={[styles.glow, animatedStyle]}>
//         <Svg width={SIZE} height={SIZE}>
//           <Defs>
//             <RadialGradient id="grad" cx="50%" cy="50%" r="50%">
//               <Stop offset="0%" stopColor="#5DA9FF" stopOpacity="0.9" />
//               <Stop offset="60%" stopColor="#1B3A6F" stopOpacity="0.8" />
//               <Stop offset="100%" stopColor="#020617" stopOpacity="1" />
//             </RadialGradient>
//           </Defs>

//           <Circle
//             cx={SIZE / 2}
//             cy={SIZE / 2}
//             r={SIZE / 2}
//             fill="url(#grad)"
//           />
//         </Svg>
//       </Animated.View>
//     </View>
//   );
// }

// const styles = StyleSheet.create({
//   container: {
//     alignItems: "center",
//     justifyContent: "center",
//   },

//   glow: {
//     width: SIZE,
//     height: SIZE,
//     borderRadius: SIZE / 2,
//     shadowColor: "#5DA9FF",
//     shadowOpacity: 0.8,
//     shadowRadius: 40,
//     elevation: 20, // Android glow
//   },
// });

import { StyleSheet, Text, View } from 'react-native'
import React from 'react'

const HomeScreen = () => {
  return (
    <View>
      <Text>HomeScreen</Text>
    </View>
  )
}

export default HomeScreen

const styles = StyleSheet.create({})