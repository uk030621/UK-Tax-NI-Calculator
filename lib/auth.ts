import { MongoDBAdapter } from "@auth/mongodb-adapter";
import GoogleProvider from "next-auth/providers/google";
import type { NextAuthOptions } from "next-auth";
import clientPromise from "@/lib/mongodb";
import { DB_NAME } from "@/lib/db";

export const authOptions: NextAuthOptions = {
  adapter: MongoDBAdapter(clientPromise, { databaseName: DB_NAME }),
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID as string,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET as string,
    }),
  ],
  session: {
    strategy: "database",
  },
  callbacks: {
    // Sign-in itself is no longer gated by the allowlist — every Google
    // account is allowed to sign in and get a session. This changed
    // when pay-for-access was added: someone who ISN'T on the allowlist
    // yet needs to be able to sign in first, so the app knows their
    // Google-verified email, before they can be shown a "buy access"
    // option and pay to be added to it. Actual use of the app is still
    // fully gated — see the isAllowedEmail() checks in app/page.tsx and
    // every API route — this callback just no longer blocks the front
    // door.
    async session({ session, user }) {
      if (session.user) {
        session.user.id = user.id;
      }
      return session;
    },
  },
  pages: {
    signIn: "/",
    error: "/",
  },
};
