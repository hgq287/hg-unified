import * as oauth2 from 'oauth2-server'; 
import prisma from '../../../config/prisma.client'; 

const model: any = { 

  getClient: async (clientId, clientSecret) => {
    const client = await prisma.oAuthClient.findUnique({
      where: { clientId: clientId },
    });
    if (!client) return null;

    if (!clientSecret || client.clientSecret === clientSecret) {
      return {
        id: client.clientId,
        grants: client.grants,
        redirectUris: client.redirectUris,
        user: client.userId ? { id: client.userId } : undefined,
      } as oauth2.Client; 
    }
    return null;
  },


  saveAuthorizationCode: async (code, client, user) => {

    if (!user || !user.id || isNaN(Number(user.id))) {
        console.error(`[SAVE FAILED] User object from server is invalid: ${JSON.stringify(user)}. Code not saved.`);
        return null;
    }

    const clientDb = await prisma.oAuthClient.findUnique({ 
        where: { clientId: client.id } 
    });
    
    if (!clientDb) {
        return null; 
    }

    try {
        const savedCode = await prisma.oAuthAuthorizationCode.create({
          data: {
            code: code.authorizationCode,
            expiresAt: code.expiresAt,
            scope: code.scope,
            redirectUri: code.redirectUri,
            clientId: clientDb.id, 
            userId: Number(user.id), 
          },
        });
        
        // Log successful save
        console.log(`[Save Debug] Code successfully SAVED: ${savedCode.code}`);

        return {
          authorizationCode: savedCode.code,
          expiresAt: savedCode.expiresAt,
          scope: code.scope,
          redirectUri: code.redirectUri,
          client: client,
          user: user,
        } as oauth2.AuthorizationCode;
        
    } catch (e) {
        console.error(`[SAVE FAILED] Authorization Code DB Write Failed. Full Error Details:`, e);
        return null; 
    }
  },

  getAuthorizationCode: async (authorizationCode) => {
    console.log(`[Retrieve Debug] Attempting to retrieve code: ${authorizationCode}`);
    
    const code = await prisma.oAuthAuthorizationCode.findUnique({
      where: { code: authorizationCode },
      include: { client: true, user: true }, 
    });

    if (!code) {
        console.error(`[Retrieve Error] Authorization code ${authorizationCode} NOT FOUND in database.`);
        return null;
    }
    
    // Check for Expiration (Critical part of the Invalid Grant error)
    if (code.expiresAt < new Date()) {
        console.error(`[Retrieve Error] Authorization code ${authorizationCode} HAS EXPIRED.`);
        await prisma.oAuthAuthorizationCode.delete({ where: { id: code.id } });
        return null;
    }
    
    return {
      authorizationCode: code.code,
      expiresAt: code.expiresAt,
      scope: code.scope,
      
      // Map the related client data - MUST use client.clientId for 'id'
      client: {
        id: code.client.clientId, 
        grants: code.client.grants,
        redirectUris: code.client.redirectUris,
      } as oauth2.Client,
      
      redirectUri: code.redirectUri,
      
      // Map the related user data - MUST use the simple { id: number } object
      user: { id: code.user.id }, 
    } as oauth2.AuthorizationCode;
  },


  // This method is called after a successful token exchange to immediately invalidate the code.
  revokeAuthorizationCode: async (code) => {
    console.log(`[Code Debug] Revoking authorization code: ${code.authorizationCode}`);
    const result = await prisma.oAuthAuthorizationCode.deleteMany({
      where: { code: code.authorizationCode },
    });
    // Return true if any records were deleted
    return result.count > 0;
  },
  
  // Access and Refresh Token Methods
  saveToken: async (token, client, user) => {
    const clientDb = (await prisma.oAuthClient.findUnique({ where: { clientId: client.id } }))!;
    
    // Save Access Token
    await prisma.oAuthAccessToken.create({
      data: {
        accessToken: token.accessToken,
        expiresAt: token.accessTokenExpiresAt,
        scope: token.scope,
        clientId: clientDb.id,
        userId: user.id,
      },
    });
    
    // Save Refresh Token (if provided)
    if (token.refreshToken) {
        await prisma.oAuthRefreshToken.deleteMany({
            where: {
                userId: user.id,
                clientId: clientDb.id,
            }
        });
        
        await prisma.oAuthRefreshToken.create({
          data: {
            refreshToken: token.refreshToken,
            expiresAt: token.refreshTokenExpiresAt,
            scope: token.scope,
            clientId: clientDb.id,
            userId: user.id,
          },
        });
    }

    return {
        accessToken: token.accessToken,
        accessTokenExpiresAt: token.accessTokenExpiresAt,
        refreshToken: token.refreshToken,
        refreshTokenExpiresAt: token.refreshTokenExpiresAt,
        scope: token.scope,
        client: client,
        user: user
    } as oauth2.Token;
  },
  
getAccessToken: async (accessToken) => {
    console.log(`[Token Debug] Attempting to retrieve Access Token: ${accessToken}`);
    
    const token = await prisma.oAuthAccessToken.findUnique({
      where: { accessToken },
      // MUST include client and user to satisfy the OAuth2 library's requirements
      include: { client: true, user: true }, 
    });

    if (!token) {
        console.error(`[Token Error] Access Token ${accessToken} NOT FOUND in database.`);
        return null;
    }
    
    // Check for Expiration
    if (token.expiresAt < new Date()) {
        console.error(`[Token Error] Access Token ${accessToken} HAS EXPIRED.`);
        // Optional: delete the expired token to clean up the database
        await prisma.oAuthAccessToken.delete({ where: { id: token.id } });
        return null;
    }
    
    console.log(`[Token Debug] Access Token retrieved and is valid.`);

    // Map the Prisma result back to the required OAuth2 format
    return {
      accessToken: token.accessToken,
      accessTokenExpiresAt: token.expiresAt,
      scope: token.scope,
      
      // Map the related client data - MUST use client.clientId for 'id'
      client: {
        id: token.client.clientId, // Must be the string clientId
        grants: token.client.grants,
        redirectUris: token.client.redirectUris,
      } as oauth2.Client,
      
      // Map the related user data - MUST use the simple { id: number } object
      user: { id: token.user.id }, 
    } as oauth2.Token;
  },

  revokeToken: async (token) => {
    await prisma.oAuthRefreshToken.deleteMany({
        where: { refreshToken: token.refreshToken }
    });
    await prisma.oAuthAccessToken.deleteMany({
        where: { userId: token.user.id, clientId: (await prisma.oAuthClient.findUnique({ where: { clientId: token.client.id } }))!.id }
    });
    return true; 
  },
  
  verifyScope: async () => true,
  getUser: async () => null as any, 
};

export default model;