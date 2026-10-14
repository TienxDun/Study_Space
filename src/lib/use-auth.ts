/**
 * Re-export useAuth từ module auth để tương thích ngược với các file và test hiện có.
 * Thư mục nguồn auth: @/components/study/auth
 */
export { useAuth } from "@/components/study/auth";
export type { AuthUser, UseAuthReturn } from "@/components/study/auth";
