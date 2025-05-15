import { z } from "zod";

export const RequestPayloadSchema = z.object({
  url: z.string().url(),
  headers: z.record(z.string()).optional(),
});

// Make sure TypeScript treats the fields as optional with defaults
export type RequestPayload = {
  url: string;
  headers?: Record<string, string>;
};
