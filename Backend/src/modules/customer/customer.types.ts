export interface UpdateProfileBody {
  email?: string;
  fullName?: string;
  profilePic?: string;
}

export interface RegisterDeviceBody {
  platform: string;
  deviceToken?: string;
  deviceInfo?: string;
}
