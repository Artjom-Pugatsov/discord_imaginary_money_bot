export interface CheckUserIsOwner {
    (userId: string): boolean;
}

export interface CheckUserInServer {
    (userId: string): boolean;
}
