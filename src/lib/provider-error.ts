export function providerError(body: string) {
  try {
    const value = JSON.parse(body);
    return String(value.error?.message ?? value.message ?? value.error ?? body).replace(/lovack_[\w-]+/g, "[credencial protegida]").slice(0, 2000);
  } catch { return body.replace(/lovack_[\w-]+/g, "[credencial protegida]").slice(0, 2000); }
}