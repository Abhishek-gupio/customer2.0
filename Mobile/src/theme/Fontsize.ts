import {
  widthPercentageToDP as wp,
  heightPercentageToDP as hp,
} from "react-native-responsive-screen";

export interface Fontsize{
    header:number,
    subHeader:number,
    text:Number,
}

export const fontSizes: Fontsize=
    {
        header: hp(3.4),
        subHeader: hp(1.8),
        text: hp(1.6)
    }