import type { Express, Request, Response, NextFunction } from "express";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { OAuth2Client } from "google-auth-library";
import { storage, pool } from "./storage";

const PgSession = connectPgSimple(session);

declare module "express-session" {
  interface SessionData {
    userId: string;
  }
}

export function setupSession(app: Express) {
  const sessionSecret = process.env.SESSION_SECRET || "mustard-seed-dev-secret-change-in-production";

  app.use(
    session({
      store: new PgSession({
        pool,
        tableName: "user_sessions",
        createTableIfMissing: true,
      }),
      secret: sessionSecret,
      resave: false,
      saveUninitialized: false,
      cookie: {
        maxAge: 30 * 24 * 60 * 60 * 1000,
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
      },
    })
  );
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (req.session?.userId) {
    return next();
  }
  return res.status(401).json({ message: "Unauthorized" });
}

export function registerAuthRoutes(app: Express) {
  const googleClient = process.env.GOOGLE_CLIENT_ID
    ? new OAuth2Client(process.env.GOOGLE_CLIENT_ID)
    : null;

  app.get("/api/config", (_req, res) => {
    res.json({
      googleClientId: process.env.GOOGLE_CLIENT_ID || null,
    });
  });

  app.get("/api/auth/me", async (req, res) => {
    const userId = req.session?.userId;
    if (!userId) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    try {
      const user = await storage.getUser(userId);
      if (!user) {
        req.session.destroy(() => {});
        return res.status(401).json({ message: "User not found" });
      }
      const assessment = await storage.getLatestAssessment(userId);
      const { passwordHash, ...safeUser } = user as any;
      return res.json({ ...safeUser, isOnboarded: !!assessment || !!(user as any).assessmentCompleted });
    } catch (err) {
      return res.status(500).json({ message: "Server error" });
    }
  });

  app.post("/api/auth/register", async (req, res) => {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ message: "Name, email, and password are required" });
    }

    const emailLower = email.toLowerCase().trim();

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailLower)) {
      return res.status(400).json({ message: "Invalid email address" });
    }

    if (password.length < 8) {
      return res.status(400).json({ message: "Password must be at least 8 characters" });
    }

    try {
      const existing = await storage.getUserByEmail(emailLower);
      if (existing) {
        return res.status(409).json({ message: "An account with this email already exists" });
      }

      const passwordHash = await bcrypt.hash(password, 12);

      const user = await storage.createUser({
        name: name.trim(),
        email: emailLower,
        emailVerified: false,
        passwordHash,
        authProvider: "email",
        lastLoginAt: new Date(),
        subscriptionTier: "lite",
        subscriptionState: "PREMIUM_TRIAL_ACTIVE",
        trialStartedAt: new Date(),
        trialExpiresAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
      } as any);

      req.session.userId = user.id;

      await storage.logAuthEvent(user.id, "signup_success", "email");

      const { passwordHash: _, ...safeUser } = user as any;
      return res.status(201).json(safeUser);
    } catch (err: any) {
      console.error("[AUTH] register error:", err);
      return res.status(500).json({ message: "Registration failed. Please try again." });
    }
  });

  app.post("/api/auth/login", async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: "Email and password are required" });
    }

    const emailLower = email.toLowerCase().trim();

    try {
      const user = await storage.getUserByEmail(emailLower);

      if (!user) {
        return res.status(401).json({ message: "Invalid email or password" });
      }

      if (!user.passwordHash) {
        return res.status(401).json({ message: "This account uses Google Sign-In. Please sign in with Google." });
      }

      const valid = await bcrypt.compare(password, user.passwordHash);
      if (!valid) {
        return res.status(401).json({ message: "Invalid email or password" });
      }

      await storage.updateUser(user.id, { lastLoginAt: new Date() } as any);

      req.session.userId = user.id;

      await storage.logAuthEvent(user.id, "login_success", "email");

      const { passwordHash, ...safeUser } = user as any;
      return res.json(safeUser);
    } catch (err) {
      console.error("[AUTH] login error:", err);
      return res.status(500).json({ message: "Login failed. Please try again." });
    }
  });

  app.post("/api/auth/google", async (req, res) => {
    const { credential } = req.body;

    if (!credential) {
      return res.status(400).json({ message: "Google credential is required" });
    }

    if (!googleClient || !process.env.GOOGLE_CLIENT_ID) {
      return res.status(503).json({ message: "Google Sign-In is not configured" });
    }

    try {
      const ticket = await googleClient.verifyIdToken({
        idToken: credential,
        audience: process.env.GOOGLE_CLIENT_ID,
      });

      const payload = ticket.getPayload();
      if (!payload) {
        return res.status(401).json({ message: "Invalid Google credential" });
      }

      const { sub: googleId, email, name, picture } = payload;

      if (!email) {
        return res.status(400).json({ message: "Google account has no email" });
      }

      let user = await storage.getUserByGoogleId(googleId!);

      if (!user) {
        user = await storage.getUserByEmail(email);
        if (user) {
          await storage.updateUser(user.id, {
            googleId,
            authProvider: "google",
            profileImage: picture,
            lastLoginAt: new Date(),
          } as any);
          user = (await storage.getUser(user.id))!;
        } else {
          user = await storage.createUser({
            name: name || email.split("@")[0],
            email: email.toLowerCase(),
            emailVerified: true,
            authProvider: "google",
            googleId,
            profileImage: picture,
            lastLoginAt: new Date(),
            subscriptionTier: "lite",
            subscriptionState: "PREMIUM_TRIAL_ACTIVE",
            trialStartedAt: new Date(),
            trialExpiresAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
          } as any);
          await storage.logAuthEvent(user.id, "signup_success", "google");
        }
      } else {
        await storage.updateUser(user.id, {
          profileImage: picture,
          lastLoginAt: new Date(),
        } as any);
        user = (await storage.getUser(user.id))!;
      }

      req.session.userId = user.id;

      await storage.logAuthEvent(user.id, "login_success", "google");

      const { passwordHash, ...safeUser } = user as any;
      return res.json(safeUser);
    } catch (err: any) {
      console.error("[AUTH] google error:", err);
      return res.status(401).json({ message: "Google sign-in failed. Please try again." });
    }
  });

  app.post("/api/auth/logout", async (req, res) => {
    const userId = req.session?.userId;
    req.session.destroy(async (err) => {
      if (err) {
        console.error("[AUTH] logout error:", err);
      }
      if (userId) {
        await storage.logAuthEvent(userId, "logout");
      }
      res.clearCookie("connect.sid");
      return res.json({ message: "Logged out" });
    });
  });

  app.post("/api/auth/forgot-password", async (req, res) => {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ message: "Email is required" });
    }

    try {
      const user = await storage.getUserByEmail(email.toLowerCase().trim());

      if (!user || !user.passwordHash) {
        return res.json({ message: "If an account exists with this email, a reset link has been sent." });
      }

      const token = crypto.randomBytes(32).toString("hex");
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

      await storage.createPasswordResetToken(user.id, token, expiresAt);
      await storage.logAuthEvent(user.id, "password_reset_requested", "email");

      const resetUrl = `${req.protocol}://${req.get("host")}/auth?reset=${token}`;

      console.log(`[AUTH] Password reset requested for ${email}. Reset URL: ${resetUrl}`);

      return res.json({
        message: "If an account exists with this email, a reset link has been sent.",
        ...(process.env.NODE_ENV !== "production" ? { devResetUrl: resetUrl } : {}),
      });
    } catch (err) {
      console.error("[AUTH] forgot-password error:", err);
      return res.status(500).json({ message: "Request failed. Please try again." });
    }
  });

  app.post("/api/auth/reset-password", async (req, res) => {
    const { token, password } = req.body;

    if (!token || !password) {
      return res.status(400).json({ message: "Token and new password are required" });
    }

    if (password.length < 8) {
      return res.status(400).json({ message: "Password must be at least 8 characters" });
    }

    try {
      const record = await storage.getPasswordResetToken(token);

      if (!record) {
        return res.status(400).json({ message: "Invalid or expired reset link" });
      }

      if (record.usedAt) {
        return res.status(400).json({ message: "This reset link has already been used" });
      }

      if (new Date() > record.expiresAt) {
        return res.status(400).json({ message: "This reset link has expired. Please request a new one." });
      }

      const passwordHash = await bcrypt.hash(password, 12);
      await storage.updateUser(record.userId, { passwordHash } as any);
      await storage.markPasswordResetTokenUsed(token);

      return res.json({ message: "Password updated successfully. You can now sign in." });
    } catch (err) {
      console.error("[AUTH] reset-password error:", err);
      return res.status(500).json({ message: "Reset failed. Please try again." });
    }
  });
}
