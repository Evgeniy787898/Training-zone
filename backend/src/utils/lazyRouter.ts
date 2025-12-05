import express, { type RequestHandler, type Router } from 'express';

type MaybeDefaultRouter = Router | { default: Router };

const resolveRouter = async (loader: () => Promise<MaybeDefaultRouter>): Promise<Router> => {
  const mod = await loader();
  return 'default' in mod ? mod.default : (mod as Router);
};

/**
 * Lazily loads an Express router on first use to avoid pulling heavy dependencies
 * (e.g., Swagger UI or large specs) into the main bundle until the route is hit.
 */
export const createLazyRouter = (loader: () => Promise<MaybeDefaultRouter>): Router => {
  const placeholder = express.Router();
  let cached: Router | null = null;

  const attach: RequestHandler = async (req, res, next) => {
    try {
      if (!cached) {
        cached = await resolveRouter(loader);
      }
      return cached(req, res, next);
    } catch (error) {
      return next(error);
    }
  };

  placeholder.use(attach);
  return placeholder;
};

