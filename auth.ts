import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";

export const { handlers, signIn, signOut, auth } = NextAuth({
    providers: [
        Credentials({
            name: "Admin Credentials",
            credentials: {
                username: { label: "Username", type: "text" },
                password: { label: "Password", type: "password" },
            },
            async authorize(credentials) {
                const adminUser = process.env.ADMIN_USERNAME?.trim();

                // Hash disimpan dalam base64 supaya tanda $ tidak dimakan dotenv-expand
                const adminHash = Buffer.from(
                    process.env.ADMIN_PASSWORD_HASH_B64?.trim() ?? "",
                    "base64"
                ).toString("utf8");

                const inputUser = (credentials?.username as string)?.trim();
                const inputPass = credentials?.password as string;

                console.log("--- DEBUG ADMIN LOGIN ---");
                console.log("Input Username:", inputUser);
                console.log("Env Username  :", adminUser);
                console.log("Env Hash      :", adminHash);

                if (!adminUser || !adminHash || !inputPass) {
                    console.log(">> REJECTED: Env atau Input kosong!");
                    return null;
                }

                if (inputUser !== adminUser) {
                    console.log(">> REJECTED: Username tidak cocok!");
                    return null;
                }

                const isValid = bcrypt.compareSync(inputPass, adminHash);
                console.log("Password Match Status:", isValid);

                if (isValid) {
                    console.log(">> SUCCESS: Login Berhasil!");
                    return { id: "1", name: "Admin", role: "admin" };
                }

                console.log(">> REJECTED: Password Hash Mismatch!");
                return null;
            },
        }),
    ],
    pages: {
        signIn: "/login",
    },
    callbacks: {
        async jwt({ token, user }) {
            if (user) token.role = (user as any).role;
            return token;
        },
        async session({ session, token }) {
            if (session.user) {
                (session.user as any).role = token.role as string;
            }
            return session;
        },
    },
});