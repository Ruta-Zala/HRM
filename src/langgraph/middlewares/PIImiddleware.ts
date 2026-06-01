import { piiMiddleware } from "langchain";

export const emailPiiMiddleware = piiMiddleware("email", {
  strategy: "redact",
  applyToInput: true,
  applyToOutput: true,
});
