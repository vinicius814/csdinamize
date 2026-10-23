// Optional telemetry must never change the outcome of the primary operation.
export async function recordAuxiliary(
  operation: () => PromiseLike<{ error: unknown }>,
  label: "last_access" | "chat_usage" | "routine_usage",
): Promise<boolean> {
  try {
    const { error } = await operation();
    if (error) throw error;
    return true;
  } catch {
    // Do not include user identifiers, content or provider error details.
    console.warn(`Optional record failed: ${label}`);
    return false;
  }
}