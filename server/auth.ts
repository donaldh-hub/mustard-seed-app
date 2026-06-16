import type { Express, Request, Response, NextFunction } from "express";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { OAuth2Client } from "google-auth-library";
import { Resend } from "resend";
import { storage, pool } from "./storage";
import rateLimit from "express-rate-limit";

const authRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many attempts. Please wait 15 minutes before trying again." },
});

/**
 * sendPasswordResetEmail — sends a reset link via Resend.
 * If RESEND_API_KEY is not configured, logs a clear config warning
 * and returns false (caller falls through to the safe generic response).
 */
async function sendPasswordResetEmail(
  toEmail: string,
  resetUrl: string
): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn(
      "[CONFIG_WARNING] RESEND_API_KEY is not set. " +
      "Password reset emails will not be delivered. " +
      "Set RESEND_API_KEY to enable real email delivery."
    );
    return false;
  }

  const fromEmail = process.env.FROM_EMAIL || "noreply@mustardseedapp.com";

  try {
    const resend = new Resend(apiKey);
    const { error } = await resend.emails.send({
      from: fromEmail,
      to: toEmail,
      subject: "Reset your Mustard Seed password",
      html: `
        <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
          <h2 style="color: #1c1917; font-size: 20px; margin-bottom: 8px;">Reset your password</h2>
          <p style="color: #57534e; font-size: 15px; line-height: 1.6; margin-bottom: 24px;">
            Someone requested a password reset for your Mustard Seed account.
            If this was you, click the button below. This link expires in 1 hour.
          </p>
          <a href="${resetUrl}"
            style="display: inline-block; background: #E8B828; color: #1c1917; font-weight: 700;
                   padding: 12px 28px; border-radius: 9999px; text-decoration: none; font-size: 15px;">
            Reset Password
          </a>
          <p style="color: #a8a29e; font-size: 13px; margin-top: 24px; line-height: 1.5;">
            If you didn't request this, you can safely ignore this email.<br/>
            This link will expire in 1 hour.
          </p>
        </div>
      `,
    });

    if (error) {
      console.error("[AUTH] Resend email error:", error.name, error.message);
      return false;
    }

    console.log(`[AUTH] Password reset email sent to ${toEmail.replace(/^(.{2}).*(@.*)$/, "$1***$2")}`);
    return true;
  } catch (err: any) {
    console.error("[AUTH] Resend unexpected error:", err?.message || err);
    return false;
  }
}

const PgSession = connectPgSimple(session);

declare module "express-session" {
  interface SessionData {
    userId: string;
  }
}

// DEV_FALLBACK_SECRET is intentionally weak — only allowed in non-production.
const DEV_FALLBACK_SECRET = "mustard-seed-dev-only-not-for-production";

export function setupSession(app: Express) {
  const isProd = process.env.NODE_ENV === "production";
  const provided = process.env.SESSION_SECRET;

  if (isProd && !provided) {
    // Hard stop: running in production without a real session secret is unsafe.
    // Using a known default allows session forgery.
    console.error(
      "[CONFIG_ERROR] SESSION_SECRET environment variable is not set. " +
      "The application cannot start safely in production without a real session secret. " +
      "Set SESSION_SECRET to a cryptographically random string of at least 32 characters."
    );
    process.exit(1);
  }

  if (!isProd && !provided) {
    console.warn(
      "[CONFIG_WARNING] SESSION_SECRET is not set. " +
      "Using a development fallback — this is NOT safe for production. " +
      "Set SESSION_SECRET before deploying."
    );
  }

  const sessionSecret = provided || DEV_FALLBACK_SECRET;

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
        secure: isProd,
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

  app.post("/api/auth/register", authRateLimit, async (req, res) => {
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

  app.post("/api/auth/login", authRateLimit, async (req, res) => {
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

  app.post("/api/auth/forgot-password", authRateLimit, async (req, res) => {
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

      const baseUrl = process.env.APP_BASE_URL || `${req.protocol}://${req.get("host")}`;
      const resetUrl = `${baseUrl}/auth?reset=${token}`;
      // Relative path — works regardless of public hostname; frontend navigates relative to its own origin.
      const devResetPath = `/auth?reset=${token}`;

      // Attempt real email delivery via Resend. Failure is logged server-side
      // but never exposed to the client (safe generic response in all cases).
      const emailSent = await sendPasswordResetEmail(email.toLowerCase().trim(), resetUrl);

      if (!emailSent && process.env.NODE_ENV !== "production") {
        // Dev convenience: surface relative reset path in the response so developers can
        // test the reset flow without a live email provider.
        console.log(`[AUTH_DEV] Reset URL for ${email}: ${resetUrl}`);
        return res.json({
          message: "If an account exists with this email, a reset link has been sent.",
          devResetUrl: devResetPath,
        });
      }

      return res.json({
        message: "If an account exists with this email, a reset link has been sent.",
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
