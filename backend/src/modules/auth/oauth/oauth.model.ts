import * as bcrypt from 'bcryptjs';
import * as oauth2 from 'oauth2-server'; 
import prisma from '../../../config/prisma.client'; 

const model: any = { 

  getUser: async (username, password, client) => {
    const email = username; 
    const user = await prisma.user.findUnique({
        where: { email },
        select: { id: true, email: true, password: true }, 
    });

    if (!user) {
        return null; 
    }

    const match = await bcrypt.compare(password, user.password);

    if (match) {
        return { id: user.id } as oauth2.User; 
    }

    return null; 
  },

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
        console.error("[SAVE ERROR] Invalid user information provided for saving authorization code.");
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
    const result = await prisma.oAuthAuthorizationCode.deleteMany({
      where: { code: code.authorizationCode },
    });
    
    // Return true if any records were deleted
    return result.count > 0;
  },
  
  saveToken: async (token, client, user) => {
    console.log(`[Token Debug] Saving token for client: ${client.id} and user: ${user ? user.id : 'NO USER'}`);
    const clientDb = await prisma.oAuthClient.findUnique({
        where: { clientId: client.id }
    });

    if (!clientDb) {
        console.error("Client not found for token saving.");
        return null;
    }

    try {
        const savedToken = await prisma.oAuthAccessToken.create({
          data: {
            accessToken: token.accessToken,
            expiresAt: token.expiresAt,
            scope: token.scope,
            clientId: clientDb.id,
            userId: user ? Number(user.id) : null,
          },
        });

        if (token.refreshToken && user) {
            await prisma.oAuthRefreshToken.create({
                data: {
                    refreshToken: token.refreshToken,
                    expiresAt: token.expiresAt,
                    scope: token.scope,
                    clientId: clientDb.id,
                    userId: Number(user.id),
                }
            });
        }
        
        return {
            accessToken: savedToken.accessToken,
            expiresAt: savedToken.expiresAt,
            scope: savedToken.scope,
            client: client,
            user: user, 
        } as oauth2.Token;

    } catch (e) {
        console.error(`[SAVE TOKEN FAILED] Database Write Failed:`, e);
        return null;
    }
  },
  
  getAccessToken: async (accessToken) => {
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
        await prisma.oAuthAccessToken.delete({ where: { id: token.id } });
        return null;
    }

    return {
      accessToken: token.accessToken,
      accessTokenExpiresAt: token.expiresAt,
      scope: token.scope,
      
      client: {
        id: token.client.clientId, // Must be the string clientId
        grants: token.client.grants,
        redirectUris: token.client.redirectUris,
      } as oauth2.Client,

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
  
  verifyScope: async (scope, token) => { 
      return true; 
  },
};

export default model;