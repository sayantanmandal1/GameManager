export interface User {
  id: string;
  username: string;
  avatar: string;
  createdAt: Date;
}

export interface GuestUser {
  id: string;
  username: string;
  avatar: string;
}
