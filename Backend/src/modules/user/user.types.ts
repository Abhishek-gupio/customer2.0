export interface CreateUserBody {
  email: string;
  name?: string;
}

export interface UpdateUserBody {
  name?: string;
}

export interface UserResponse {
  id: string;
  email: string;
  name: string | null;
  createdAt: Date;
  updatedAt: Date;
}
