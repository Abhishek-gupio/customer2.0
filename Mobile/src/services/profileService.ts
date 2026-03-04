import { api } from './api';

export type ProfileResponse = {
    id: string;
    fullName: string;
    phoneNumber: string;
    email?: string;
    createdAt?: string;
    profilePic?: string;
};

export type UpdateProfilePayload = {
    fullName?: string;
    email?: string;
    profilePic?: string;
    phoneNumber?: string;
};

/** Get logged-in customer profile */
export async function getProfile(): Promise<ProfileResponse> {
    const res = await api.get<any>('/v1/customer/profile');
    return res.data ?? res;
}

/** Update logged-in customer profile */
export async function updateProfile(
    payload: UpdateProfilePayload,
): Promise<ProfileResponse> {
    const res = await api.put<any>('/v1/customer/profile', payload);
    return res.data ?? res;
}