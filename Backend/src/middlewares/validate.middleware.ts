import { Request, Response, NextFunction } from "express";
import { z, ZodError } from "zod";
import { AppError } from "../utils/AppError";

/**
 * Middleware to validate request data using Zen schemas
 */
export const validate = (schema: z.ZodObject<any, any>) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      // If schema has 'body', 'query', or 'params' keys, validate the whole request
      const shape = schema.shape as any;
      const hasStrictStructure = shape.body || shape.query || shape.params;

      if (hasStrictStructure) {
        const validated = await schema.parseAsync({
          body: req.body,
          query: req.query,
          params: req.params,
        });
        req.body = (validated as any).body ?? req.body;
        req.query = (validated as any).query ?? req.query;
        req.params = (validated as any).params ?? req.params;
      } else {
        // Otherwise, assume it's a body schema
        req.body = await schema.parseAsync(req.body);
      }

      next();
    } catch (err) {
      if (err instanceof ZodError) {
        const message = err.issues
          .map((e: any) => `${e.path.join(".")}: ${e.message}`)
          .join(", ");
        
        return next(AppError.badRequest(`Validation failed: ${message}`, "VALIDATION_ERROR"));
      }
      next(err);
    }
  };
};
