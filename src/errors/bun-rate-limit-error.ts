export class BunRateLimitError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "BunRateLimitError";
  }
}
