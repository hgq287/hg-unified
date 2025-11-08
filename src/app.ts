import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';

import routes from './routes/routes';
import config from './config';

import { ensureOAuthClient } from './utils/oauth.setup';

import HttpException from './exceptions/http_exception';

class App {
  async init(): Promise<any> {
    const app = express();

    // Ensure OAuth Client exists in DB
    await ensureOAuthClient();

    // Enable CORS for all routes
    app.use(cors());
    

    // Enable parsing for application/json (standard API requests)
    app.use(express.json()); 

    // Enable parsing for application/x-www-form-urlencoded (REQUIRED for /oauth/token)
    app.use(express.urlencoded({ extended: true }));
     
    // Middleware that transforms the raw string of req.body into json
    app.use(bodyParser.json());

    // Load API routes
    app.use(config.api.prefix, routes);

    /**
     * Health Check endpoints
     */
    app.get('/status', (req, res) => {
      res.status(200).end();
    });

    /**
     * Start Express server
     */
    app.listen(config.port, () => {
      console.log(
        "App is running at http://localhost:%d in %s mode",
        config.port,
        config.env
      );

      console.log("Press CTRL-C to stop\n");
    });
  }
}

export default App;