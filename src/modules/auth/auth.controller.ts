import { NextFunction, Request, Response, Router } from 'express';

import OAuthServer from 'express-oauth-server';

import oauthModel from './oauth/oauth.model';
import auth from './auth';
import { sharedAuth } from './auth.shared';
import { createUser, getUserProfile, login, updateUserProfile } from './auth.service';

const router = Router();

const oauth = new OAuthServer({
  model: oauthModel,
  grants: ['authorization_code', 'refresh_token'], 
  accessTokenLifetime: 60 * 60, // 1 hour
  refreshTokenLifetime: 60 * 60 * 24 * 7, // 1 week
});

/**
 * @route {GET} /oauth/authorize
 */
router.get('/oauth/authorize', auth.optional, async (req: Request, res: Response, next: NextFunction) => {
  
  // Ensure the ID is explicitly converted to a number.
  const authenticatedUserId = Number(req.auth?.user?.id); 
  
  // Also check for NaN after conversion, which happens if the value was null/undefined/non-numeric.
  if (!authenticatedUserId || isNaN(authenticatedUserId)) { 
    return res.status(401).send('Redirect to login page required. Please sign in first.');
  }

  // Pass the now-verified integer ID to the OAuth server
  (req as any).oauth = { user: { id: authenticatedUserId } }; 
  
  return oauth.authorize({
    authenticateHandler: {
      handle: (request: any, response: any) => {
        return (request as any).oauth.user;
      },
    },
    allowEmptyScope: true,
  })(req, res, next);
});


/**
 * @route {POST} /oauth/token
 * Purpose: Exchanges the authorization code or refresh token for a new access token.
 */
router.post('/oauth/token', oauth.token());


/**
 * Sign Up
 * @route {POST} /signup
 */
router.post('/signup', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const payload = req.body;
    const user = await createUser({ ...payload, demo: false });
    res.status(201).json({ user });
  } catch (error) {
    next(error);
  }
});

/**
 * Sign In
 * @route {POST} /signin
 */
router.post('/signin', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const payload = req.body;
    const user = await login(payload);
    res.json({ user });
  } catch (error) {
    next(error);
  }
});


/**
 * Get user-profile
 * @route {GET} /user/profile
 */
router.get('/user/profile', sharedAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).authenticatedUserId; 

    if (!userId) {
        return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    const user = await getUserProfile(userId);
    res.status(200).json({ success: true, data: { user } });
  } catch (error) {
    next(error);
  }
});

/**
 * Update user-profile
 * @auth required (via Shared Middleware)
 * @route {PUT} /user/profile
 */
router.put('/user/profile', sharedAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).authenticatedUserId; 
    
    if (!userId) {
        return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    const user = await updateUserProfile(req.body, userId);
    res.json({ user });
  } catch (error) {
    next(error);
  }
});

/**
 * Get Author Infomation
 * @route {GET} /author
 */
router.get('/author', async (req: Request, res: Response, next: NextFunction) => {
  try {
    return res.json({ 'Author': 'Hung Q.' }).status(200);
  } catch(e) {
    console.error(e.message);
    return next(e);
  }
});

export default router;