---
name: Auth repair scope
description: User constraints for signup fixes and production data preservation.
---

Repair the existing custom authentication system; do not add Replit's prebuilt Auth/login page as a substitute.

**Why:** The user explicitly restricted signup repairs to fixing the failure, and production contains real user data that must be preserved.

**How to apply:** Keep authentication replacement outside signup repair scope. Never drop, reset, truncate, or recreate production tables to resolve a schema mismatch.