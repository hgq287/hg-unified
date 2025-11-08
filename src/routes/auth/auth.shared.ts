import { Request, Response, NextFunction } from 'express';
import oauthModel from './oauth.model';
import auth from './auth'; 

const getTokenFromHeaders = (req: Request): string | null => {
  if (
    (req.headers.authorization && req.headers.authorization.split(' ')[0] === 'Token') ||
    (req.headers.authorization && req.headers.authorization.split(' ')[0] === 'Bearer')
  ) {
    return req.headers.authorization.split(' ')[1];
  }
  return null;
};

/**
 * Shared Authentication Middleware
 */
export const sharedAuth = async (req: Request, res: Response, next: NextFunction) => {
    const accessToken = getTokenFromHeaders(req);
    
    if (!accessToken) {
        return auth.required(req, res, next);
    }

    try {
        const tokenObject = await oauthModel.getAccessToken(accessToken);

        if (tokenObject && tokenObject.accessTokenExpiresAt > new Date()) {
            // SUCCESS: OAuth token is valid. Set user on a custom property and skip JWT check.
            (req as any).authenticatedUserId = tokenObject.user.id;
            
            // OPTIONAL: Also set req.user to be compatible with other standard middleware
            (req as any).user = tokenObject.user; 
            
            return next();
        }
    } catch (e) {
        // OAuth check failed (token malformed, internal error). Proceed to JWT fallback.
        console.warn(`[SharedAuth] OAuth token check failed: ${e.message}`);
    }
    
    // Use the existing internal JWT middleware for validation.
    auth.required(req, res, (err) => {
        if (err) {
            // Both checks failed. Let the error bubble up to the Express error handler.
            return next(err);
        }
        
        // SUCCESS: Internal JWT token is valid. Set user ID on the custom property.
        (req as any).authenticatedUserId = (req as any).auth?.user?.id;
        
        next();
    });
};