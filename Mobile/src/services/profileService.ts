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

/** Upload profile picture (multipart). Uses backend storage (S3 or local per env). Returns updated profile. */
export async function uploadProfilePicture(formData: FormData): Promise<ProfileResponse> {
    const res = await api.upload<{ data?: ProfileResponse }>('/v1/customer/profile/picture', formData);
    return (res as any)?.data ?? res;
}

export type ProfileStatsResponse = {
    vehicles: number;
    expenses: number;
    documents: number;
};

/** Get profile Quick Stats (real counts: vehicles, expenses, documents). */
export async function getProfileStats(): Promise<ProfileStatsResponse> {
    const res = await api.get<{ data?: ProfileStatsResponse }>('/v1/customer/profile/stats');
    const raw = (res as any)?.data ?? res;
    return {
        vehicles: Number(raw?.vehicles ?? 0),
        expenses: Number(raw?.expenses ?? 0),
        documents: Number(raw?.documents ?? 0),
    };
}