// Type exports for the support dashboard. Lives outside actions.ts
// because "use server" files may only export async functions.

export type SendMessageResult = {
  rootId: string;
  messageId: string;
  created_root: boolean;
};
