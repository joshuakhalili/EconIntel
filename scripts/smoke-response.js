// HTML is sampled for shell markers; JSON must remain whole to be parseable.
export async function smokeResponseBody(response) {
  const json = /application\/json/i.test(response.headers.get('content-type') ?? '');
  const limit = json ? 4 * 1024 * 1024 : 20_000;
  const chunks = [];
  let bytes = 0;
  for await (const chunk of response.body ?? []) {
    if (bytes + chunk.byteLength > limit) {
      if (json) throw new Error('Smoke JSON response exceeds 4 MiB limit');
      chunks.push(chunk.subarray(0, limit - bytes));
      break;
    }
    chunks.push(chunk);
    bytes += chunk.byteLength;
  }
  return Buffer.concat(chunks).toString('utf8');
}
