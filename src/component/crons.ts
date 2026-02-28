import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

crons.daily(
  "clean up expired chat data",
  { hourUTC: 4, minuteUTC: 0 },
  internal.lib.cleanupExpired,
  {},
);

export default crons;
