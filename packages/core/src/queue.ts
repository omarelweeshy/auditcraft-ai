import { Queue } from "bullmq";
export function connection() {
  const u = new URL(process.env.REDIS_URL ?? "redis://localhost:56379");
  return {
    host: u.hostname,
    port: Number(u.port || 6379),
    password: u.password || undefined,
    maxRetriesPerRequest: null,
  };
}
export const queueOptions = {
  attempts: 3,
  backoff: { type: "exponential", delay: 2000 },
  removeOnComplete: false,
  removeOnFail: false,
};
export function auditQueue() {
  return new Queue("auditcraft", {
    connection: connection(),
    defaultJobOptions: queueOptions,
  });
}
