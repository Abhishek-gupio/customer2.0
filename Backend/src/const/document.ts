export enum DocumentType {
    RC = "RC",
    INSURANCE = "INSURANCE",
    PUC = "PUC",
    FASTAG = "FASTAG",
    DL = "DL",
    OTHER = "OTHER",
}

export enum VerificationStatus {
    PENDING = "PENDING",
    VERIFIED = "VERIFIED",
    REJECTED = "REJECTED",
}

export enum DocumentSource {
    UPLOAD = "UPLOAD",
    DIGILOCKER = "DIGILOCKER",
    PARIVAHAN = "PARIVAHAN",
}

export enum DigiLockerStatus {
    CONNECTED = "CONNECTED",
    DISCONNECTED = "DISCONNECTED",
    EXPIRED = "EXPIRED",
    REVOKED = "REVOKED",
}
